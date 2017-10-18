const functions = require('firebase-functions');
const moment = require('moment');

// The Firebase Admin SDK to access the Firebase Realtime Database. 
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

var events = require('events');

exports.addMessage = functions.https.onRequest((req, res) => {
  const data = 
  { text: req.body.text, 
  	room_id:req.body.room_id, 
  	sender_name:req.body.sender_name, 
  	date:currentDate(), 
  	sender_id:req.body.sender_id, 
  	id:req.body.id};

  var messageRef = admin.database().ref('/messages').child(req.body.room_id).child(req.body.id);
  messageRef.set(data, function(error) {
  	if (error) {
  		console.log('Error saving message', error.message)
		res.status(500).send('Error saving message');
  	}
  	else {
  		console.log('Message saved successfully');
  		res.status(201).send('Message saved successfully');
  	}
  });
});

exports.addOwner = functions.https.onRequest((req, res) => {
   var paramsOK = req.body.id && req.body.email && req.body.phone
       && req.body.display_name && req.body.property_name;
   if (paramsOK) {
        var owner = mapOwnerFromBody(req.body);
        var eventEmitter = new events.EventEmitter();
        eventEmitter.on(owner.id, function(success) {
            console.log("Listener fired. Success: " + success);
            if (success) {
                res.status(201).send('Owner created');
            }
            else {
                res.status(500).send('Write ERROR');
            }
        });
        setOwner(owner, eventEmitter);
   }
   else {
       res.status(400).send('Parameter ERROR');
   }
});

exports.addUser = functions.https.onRequest((req, res) => {
    var paramsOK = req.body.id && req.body.email && req.body.display_name && req.body.phone;
    if (paramsOK) {
        var user = mapUserFromBody(req.body);
        var eventEmitter = new events.EventEmitter();
        eventEmitter.on(user.id, function(success) {
            if (success) {
                res.status(201).send('User created');
            }
            else {
                res.status(500).send('Write ERROR');
            }
        });
        setUser(user, eventEmitter);
    }
    else {
        res.status(500).send('Parameter ERROR');
    }

});

exports.addStay = functions.https.onRequest((req, res) => {
    /*
    * Add user_id to owner's guestlist
    * Update user start_date and end_date attrs
    * Create new room
     */
    var paramsOK = req.body.id_user && req.body.id_owner
        && req.body.start_date && req.body.end_date;
    if (paramsOK) {
        res.status(200).send('Parameters OK');
    }
    else {
        res.status(500).send('Parameter ERROR');
    }
    });

exports.testmethod = functions.https.onRequest((req, res) => {
    var eventEmitter = new events.EventEmitter();
    const id = req.body.room_id;
    eventEmitter.on(id, function(room) {
        console.log("listener fired. Room:", room);
        eventEmitter.on("testguestid", function(owner) {
            console.log("listener fired. Owner:", owner);
            eventEmitter.removeAllListeners(id);
            eventEmitter.removeAllListeners("testguestid");
            res.status(200).send(owner);
        });
        getOwner("testguestid", eventEmitter);
    });
    getRoom(id, eventEmitter);
    });

function mapOwnerFromBody(body) {
    var owner = {
        id: body.id,
        email: body.email,
        phone: body.phone,
        name: body.display_name,
        property_name: body.property_name
    };
    return owner;
}

function mapUserFromBody(body) {
    var user = {
        id: body.id,
        name: body.display_name,
        phone: body.phone,
        email: body.email,
        start_date: "1970-01-01T00:00:00+0000",
        end_date: "1970-01-01T00:00:00+0000",
        related_room_id: "__UNDEFINED__"
    };
    return user;
}


function currentDate() {
	var currentDate = moment().utc().format("YYYY-MM-DDTHH:mm:ssZZ");
	return currentDate;
}

function getRoom(roomID, eventEmitter) {
    console.log('getRoom id:', roomID);
    var ref = getRefForRoomID(roomID);
    ref.once("value", function(snap) {
        //console.log("getRoom value:", snap.val());
        eventEmitter.emit(roomID, snap.val());
        return snap.val();
    }, function(errorObject) {
        console.log("The read failed: " + errorObject.code);
        return null;
    });
}

function getOwner(id, eventEmitter) {
    var ref = getRefForOwnerID(id);
    ref.once("value", function(snap) {
        eventEmitter.emit(id, snap.val());
    });
}

function getUser(id, eventEmitter) {
    var ref = getRefForUserID(id);
    ref.once("value", function(snap) {
        eventEmitter.emit(id, snap.val());
    });
}

function setOwner(owner, eventEmitter) {
    var ref = getRefForOwnerID(owner.id);
    ref.set(owner, function(error) {
       if (error) {
           console.log("Owner could not be saved. " + error);
           eventEmitter.emit(owner.id, false);
       }
       else {
           console.log("Owner saved successfully.");
           eventEmitter.emit(owner.id, true);
       }
    });
}

function setUser(user, eventEmitter) {
    var ref = getRefForUserID(user.id);
    ref.set(user, function (error) {
        if (error) {
            console.log("User could not be saved. " + error);
            eventEmitter.emit(user.id, false);
        }
        else {
            console.log("User saved successfully.");
            eventEmitter.emit(user.id, true);
        }
    });
}

function getRefForRoomID(roomID) {
    return admin.database().ref('/rooms').child(roomID);
}

function getRefForOwnerID(id) {
    return admin.database().ref('/owners').child(id);
}

function getRefForUserID(id) {
    return admin.database().ref('/users').child(id);
}
