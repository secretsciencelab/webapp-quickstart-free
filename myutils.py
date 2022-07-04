import base64
import datetime
import firebase_admin.auth
import google.oauth2.id_token
import os

class SystemUtil:
  @staticmethod
  def is_local():
    if os.getenv('GAE_ENV', '').startswith('standard'):
      # Production in the standard environment
      return False
    else:
      # Local execution.
      return True

class AuthUtil:
  HTTP_REQUEST = google.auth.transport.requests.Request()

  @staticmethod
  def get_auth(request):
    if 'Authorization' not in request.headers:
      raise Exception("Unauthorized")

    id_token = request.headers['Authorization'].split(' ').pop()
    claims = google.oauth2.id_token.verify_firebase_token(
             id_token, AuthUtil.HTTP_REQUEST)
    if not claims:
      raise Exception("Unauthorized")

    uid = claims['sub']
    user = firebase_admin.auth.get_user(uid)

    obj = {
      'login': datetime.datetime.utcnow(),
      'uid': uid,
      'email': user.email,
      'name': user.display_name,
      'country': request.headers.get('X-AppEngine-Country', ""),
      'region': request.headers.get('X-AppEngine-Region', ""),
      'city': request.headers.get('X-AppEngine-City', ""),
      'latlong': request.headers.get('X-AppEngine-CityLatLong', ""),
      'agent': request.headers.get('user-agent', ""),
      'ip': request.headers.get('X-Forwarded-For', "")
    }

    return obj

  @staticmethod
  def get_uid_by_email(email):
    try: 
      user = firebase_admin.auth.get_user_by_email(email) 
      return user.uid
    except:
      user = firebase_admin.auth.create_user(email=email)
      return user.uid

class DatastoreUtil:
  @staticmethod
  def make_collection(collection):
    if SystemUtil.is_local():
      return "DEV_" + collection

    return collection

def unix_time(dt):
  # time since epoch in seconds
  epoch = datetime.datetime(1970,1,1, tzinfo=datetime.timezone.utc)
  return (dt - epoch) / datetime.timedelta(seconds=1)
