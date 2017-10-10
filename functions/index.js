const functions = require('firebase-functions');

const moment = require('moment');


// The Firebase Admin SDK to access the Firebase Realtime Database. 
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

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

function currentDate() {
	var currentDate = moment().utc().format("YYYY-MM-DDTHH:mm:ss.SSSZZ");
	return currentDate;
}
