import datetime, os, time
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify

import firebase_admin
from firebase_admin import credentials, firestore

from myutils import AuthUtil, DatastoreUtil

# load env vars
BASEDIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASEDIR, '.env'))

import stripe
stripe.api_key = os.environ["STRIPE_SKEY"]

# Initialize Flask app
# If `entrypoint` is not defined in app.yaml, App Engine will look for an app
# called `app` in `main.py`.
app = Flask(__name__)

# Initialize Firestore DB
firebaseKeyfile = os.environ.get("FIREBASE_KEYFILE", "")
if os.path.exists(firebaseKeyfile):
  cred = credentials.Certificate(firebaseKeyfile)
  firebase_admin.initialize_app(cred)
  db = firestore.client()

@app.route('/')
def hello():
  """Return a friendly HTTP greeting."""

  return render_template('hello.html', 
      message='Hello!'
  )

@app.route('/register')
def register():
  response = {}

  try:
    uhelper = UserHelper(request)
    if uhelper.user:
      # only update if stale to minimize DB writes
      isStale = False
      delta = datetime.datetime.now(datetime.timezone.utc) - uhelper.udict['login']
      if delta.days > 1:
        isStale = True

      if isStale:
        uhelper.uref.update(uhelper.auth)
    else:
      # new user
      uhelper.uref.set(uhelper.auth)

    response = {
      "status": "success",
      "uid": uhelper.auth['uid']
    }
  except Exception as error:
    response = {
      "status": "error",
      "error": str(error)
    }

  return jsonify(response)

@app.route('/account')
def account():
  return render_template('account.html')

@app.route('/subscribe')
def subscribe():
  return render_template('subscribe.html', stripe_pkey=os.environ["STRIPE_PKEY"])

@app.route('/subscribe/session')
def subscribeSession():
  response = {}

  try:
    uhelper = UserHelper(request)
    if uhelper.is_premium_member:
      raise RuntimeError("subscribed") # already subscribed

    plan = request.args.get('plan', "premium-monthly")
    productKey = os.environ["STRIPE_PRODUCT_KEY_PREMIUM_M"]
    if plan == "premium-yearly":
      productKey = os.environ["STRIPE_PRODUCT_KEY_PREMIUM_Y"]

    session = stripe.checkout.Session.create(
      payment_method_types=['card'],
      line_items=[{'price': productKey, 'quantity': 1}],
      mode='subscription',
      allow_promotion_codes=True,
      subscription_data={ 
        'trial_period_days': 30,
        'metadata': { }
      },
      customer_email=uhelper.auth['email'],
      client_reference_id=uhelper.auth['uid'],
      success_url=request.host_url + "welcome",
      cancel_url=request.host_url + "subscribe")

    response = {
      "status": "success",
      "id": session.id
    }
  except Exception as error:
    response = {
      "status": "error",
      "error": str(error)
    }

  return jsonify(response)

@app.route('/stripehook', methods=["POST"])
def stripehook():
  rawData = request.get_data()

  eventFilter = ["checkout.session.completed", 
   "customer.subscription.created",
   "customer.subscription.deleted"]
  if request.json['type'] not in eventFilter:
    return "", 200

  try:
    event = stripe.Webhook.construct_event(rawData, 
      request.headers['Stripe-Signature'], os.environ["STRIPE_WEBHOOK_SKEY"])
  except ValueError as e:
    # Invalid payload
    return "Invalid payload", 400
  except stripe.error.SignatureVerificationError as e:
    # Invalid signature
    return "Invalid signature", 400

  if event['type'] == 'checkout.session.completed':
    # activate subscription
    uid = event['data']['object']['client_reference_id']
    custId = event['data']['object']['customer']
    subId = event['data']['object']['subscription']
    print("activate %s %s %s" % (uid, custId, subId))

    cname = DatastoreUtil.make_collection("users")
    userRef = db.collection(cname).document(uid)
    user = userRef.get()
    if not user.exists:
      return "Unknown user", 400

    userRef.update({
      'stripe_cust_id': custId,
      'stripe_sub_id': subId,
      'sub_active': [1]
    })

    print("activate success %s %s %s" % (uid, custId, subId))
  elif event['type'] == 'customer.subscription.created':
    # not used
    custId = event['data']['object']['customer']
    subId = event['data']['object']['id']
    print("customer created")
  elif event['type'] == 'customer.subscription.deleted':
    # deactivate subscription
    custId = event['data']['object']['customer']
    subId = event['data']['object']['id']
    print("deactivate %s %s" % (custId, subId))

    cname = DatastoreUtil.make_collection("users")
    usersRef = db.collection(cname)
    users = usersRef.where('stripe_cust_id', '==', custId).stream()
    for user in users:
      user.reference.update({ 'sub_active': [] })

    print("deactivate success %s %s" % (custId, subId))

  return "", 200

@app.route('/subscriber/portal')
def subscriberPortal():
  response = {}

  try:
    uhelper = UserHelper(request)

    session = stripe.billing_portal.Session.create(
      customer=uhelper.udict['stripe_cust_id'],
      return_url=request.host_url + "subscribe")
    
    response = {
      "status": "success",
      "url": session.url
    }
  except Exception as error:
    response = {
      "status": "error",
      "error": str(error)
    }

  return jsonify(response)

@app.route('/subscriber/access')
def subscriberAccess():
  response = {}

  try:
    uhelper = UserHelper(request)

    # TODO: add any other subscriber-only info below, e.g. Discord link
    discordUrl = ''
    if uhelper.is_premium_member:
      discordUrl = 'https://discord.gg'

    response = {
      "status": "success",
      "sub_active": uhelper.is_premium_member,
      "discord": discordUrl
    }
  except Exception as error:
    response = {
      "status": "error",
      "error": str(error)
    }

  return jsonify(response)

@app.route('/lessons')
def lessons():
  return render_template('lessons/index.html')

@app.route('/lesson/<path:path>')
def lesson(path):
  try:
    uhelper = UserHelper(request)
    if uhelper.is_premium_member:
      return render_template('lessons/'+path+".html")
  except:
    pass

  return ""

@app.route('/welcome')
def welcome():
  return render_template('welcome.html')

####### Helper functions ###########

# construct user object from Request + auth info
class UserHelper:
  def __init__(self, request):
    self.user = None
    self.uref = None
    self.udict = {}
    self.is_premium_member = False

    try:
      self.auth = AuthUtil.get_auth(request)
      cname = DatastoreUtil.make_collection("users")
      self.uref = db.collection(cname).document(self.auth['uid'])
      self.user = self.uref.get()
      if self.user.exists:
        self.udict = self.user.to_dict()
        if 'sub_active' in self.udict and 1 in self.udict['sub_active']:
          self.is_premium_member = True
      else:
        self.user = None
    except:
      pass
    
####################################

if __name__ == '__main__':
    # This is used when running locally only. When deploying to Google App
    # Engine, a webserver process such as Gunicorn will serve the app. This
    # can be configured by adding an `entrypoint` to app.yaml.
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8888)), debug=True)
