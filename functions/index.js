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
       res.status(200).send('Parameters OK');
   }
   else {
       res.status(500).send('Parameter ERROR');
   }
});

exports.addUser = functions.https.onRequest((req, res) => {
    var paramsOK = req.body.id && req.body.email && req.body.display_name && req.body.phone;
    if (paramsOK) {
        res.status(200).send('Parameters OK');
    }
    else {
        res.status(500).send('Parameter ERROR');
    }

});

exports.addStay = functions.https.onRequest((req, res) => {
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

function getRefForRoomID(roomID) {
    return admin.database().ref('/rooms').child(roomID);
}

function getRefForOwnerID(id) {
    return admin.database().ref('/owners').child(id);
}
