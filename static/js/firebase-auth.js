function FirebaseAuth(cfg) {
  this.onAuthStateChanged = []; // callbacks to fire when auth state changes
  if (cfg.onAuthStateChanged)
    this.onAuthStateChanged.push(cfg.onAuthStateChanged);

  this.loginWidgetSelector = cfg.loginWidgetSelector;

  this.init();
}
FirebaseAuth.prototype.init = function() {
  // [START gae_config]
  // Obtain the following from the "Add Firebase to your web app" dialogue
  // Initialize Firebase
  // TODO this.firebaseConfig = {
  // TODO   apiKey: "",
  // TODO   authDomain: "",
  // TODO   projectId: "",
  // TODO   storageBucket: "",
  // TODO   messagingSenderId: "",
  // TODO   appId: "",
  // TODO   measurementId: ""
  // TODO };
  // [END gae_config]

  if (!this.firebaseConfig)
    return;
  
  // This is passed into the backend to authenticate the user.
  this.userIdToken = null;

  firebase.initializeApp(this.firebaseConfig);
  firebase.analytics();

  var fba = this;
  $(document).ready(function() {
    fba.configureLogin();
    fba.configureLoginWidget();
    fba.keepaliveToken();
  });
}

FirebaseAuth.prototype.addOnAuthStateChanged = function(cb) {
  this.onAuthStateChanged.push(cb);
}

FirebaseAuth.prototype.keepaliveToken = function() {
  var fba = this;

  setTimeout(function() {
    var user = fba.getUser();
    if (user)
      user.getIdToken(/*forceRefresh*/true).then(function(idToken) {
        fba.userIdToken = idToken;
      });

    fba.keepaliveToken();
  }, 30000);
}

// Firebase log-in
FirebaseAuth.prototype.configureLogin = function() {
  var fba = this;

  // [START onAuthStateChanged]
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      user.getIdToken().then(function(idToken) {
        fba.userIdToken = idToken;
        fba.onAuthStateChanged.forEach(function(cb) {
          cb(true);
        });
      });
    } else {
      fba.onAuthStateChanged.forEach(function(cb) {
        cb(false);
      });
    }
  // [END onAuthStateChanged]
  });
}

// wait for auth to intialize to exec cb, until timeout
FirebaseAuth.prototype.withAuth = function(cb, timeout, onTimeout) {
  var fba = this;
  if (!timeout)
    timeout = 10000;
  const iterInterval = 100; // ms
  var iterCount = 0;

  var loop = setInterval(function() {
    if (!fba.userIdToken)
    {
      if (iterCount * iterInterval > timeout)
      {
        clearInterval(loop);
        //console.log("no auth timeout");
        //console.log(cb);
        if (onTimeout)
          onTimeout();
        return;
      }
      iterCount++;
      return;
    }

    clearInterval(loop);
    cb();
  }, iterInterval);
}

FirebaseAuth.prototype.getUser = function() {
  return firebase.auth().currentUser;
}

FirebaseAuth.prototype.logout = function() {
  firebase.auth().signOut();
  //location.reload();
}

// [START configureLoginWidget]
// Firebase log-in widget
FirebaseAuth.prototype.configureLoginWidget = function() {
  var fba = this;
  var uiConfig = {
    //'signInSuccessUrl': window.location.href,
    signInFlow: 'popup',
    callbacks: {
      'signInSuccessWithAuthResult': function(result, url) { 
        return false;
      },
    },
    'credentialHelper': firebaseui.auth.CredentialHelper.NONE,
    'signInOptions': [
      // Leave the lines as is for the providers you want to offer your users.
      //firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      //firebase.auth.FacebookAuthProvider.PROVIDER_ID,
      //firebase.auth.TwitterAuthProvider.PROVIDER_ID,
      //firebase.auth.GithubAuthProvider.PROVIDER_ID,
      firebase.auth.EmailAuthProvider.PROVIDER_ID
    ],
    // Terms of service url
    'tosUrl': '/tos',
  };

  this.authUI = new firebaseui.auth.AuthUI(firebase.auth());
  if ($(this.loginWidgetSelector).length)
    this.authUI.start(this.loginWidgetSelector, uiConfig);
}
// [END configureLoginWidget]

// [START httpGet]
FirebaseAuth.prototype.httpGet = function(url, cb) {
  var fba = this;
  this.withAuth(function() {
    $.ajax(url, {
      // Set header for the XMLHttpRequest to get data 
      // from the web server for userIdToken
      headers: {
        'Authorization': 'Bearer ' + fba.userIdToken
      }
    })
    .fail(function(xhr, txtStatus) {
      console.error(txtStatus);
    })
    .then(function(data) {
      if (cb)
        cb(data);
    });
  });
}
// [END httpGet]

// [START httpPost]
FirebaseAuth.prototype.httpPost = function(
  url, data, cb) {
  var fba = this;
  this.withAuth(function() {
    //console.log("firebase-auth.httpPost " + JSON.stringify(data));
    // Send note data to backend for account
    // associated with userIdToken
    $.ajax(url, {
      headers: {
        'Authorization': 'Bearer ' + fba.userIdToken
      },
      method: 'POST',
      data: JSON.stringify(data),
      contentType : 'application/json'
    })
    .fail(function(xhr, txtStatus) {
      console.error(txtStatus);
    })
    .then(function(data) {
      if (cb)
        cb(data);
    });
  });
}
// [END httpPost]
