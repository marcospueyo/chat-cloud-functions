const functions = require('firebase-functions');
const moment = require('moment');

// The Firebase Admin SDK to access the Firebase Realtime Database. 
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

var events = require('events');

const uuid = require('uuid');

exports.addMessage = functions.https.onRequest((req, res) => {
    var paramsOK = req.body.text && req.body.room_id && req.body.sender_id
        && req.body.id;

    if (paramsOK) {
        getUser(req.body.sender_id)
        .then(function (user) {
            var message = createMessage(req.body.id, req.body.text, currentDate(),
                req.body.room_id, user.id, user.name);
            return addMessage(message);
        }, function (err) {
            console.log(err);
            res.status(500).send('Write ERROR');
        })
        .then(function (result) {
            console.log('Message saved successfully');
            res.status(201).send('Message saved successfully');
        }, function (err) {
            console.log(err);
            res.status(500).send('Write ERROR');
        });
    }
    else {
        res.status(400).send('Parameter ERROR');
    }
});

exports.addOwner = functions.https.onRequest((req, res) => {
   var paramsOK = req.body.id && req.body.email && req.body.phone
       && req.body.display_name && req.body.property_name;
   if (paramsOK) {
       var owner = createOwner(req.body.id, req.body.email, req.body.phone,
           req.body.display_name, req.body.property_name);
        setOwner(owner).then(function (result) {
            console.log(result);
            res.status(201).send('Owner created');
        }, function (err) {
            console.log(err);
            res.status(500).send('Write ERROR');
        });
   }
   else {
       res.status(400).send('Parameter ERROR');
   }
});

exports.addUser = functions.https.onRequest((req, res) => {
    var paramsOK = req.body.id && req.body.email && req.body.display_name
        && req.body.phone;
    if (paramsOK) {
        var user = createrUser(req.body.id, req.body.display_name,
            req.body.phone, req.body.email);
        setUser(user).then(function (result) {
            console.log(result);
            res.status(201).send('User created');
        }, function (err) {
            console.log(err);
            res.status(500).send('Write ERROR');
        });
    }
    else {
        res.status(400).send('Parameter ERROR');
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
    var owner;
    var user;
    var room;
    if (paramsOK) {
        getOwner(req.body.id_owner)
        .then(function (result) {
            owner = result;
            return getUser(req.body.id_user);
        }, function (err) {
            console.log(err);
            res.status(500).send('Write ERROR');
        })
        .then(function (result) {
            user = result;
            return addGuestToOwner(owner.id, user.id);
        }, function (err) {
            console.log(err);
            res.status(500).send('Write ERROR');
        })
        .then(function (result) {
            console.log(result);
            return setUserStayInterval(user.id, req.body.start_date,
                req.body.end_date);
        }, function (err) {
            console.log(err);
            res.status(500).send('Write ERROR');
        })
        .then(function (result) {
            console.log(result);
            room = createRoom(req.body.start_date, req.body.end_date, user, owner);
            return setRoom(room);
        }, function (err) {
            console.log(err);
            res.status(500).send('Write ERROR');
        })
        .then(function (result) {
            console.log(result);
            return setUserRelatedRoom(user.id, room.id);
        }, function (err) {
            console.log(err);
            res.status(500).send('Write ERROR');
        })
        .then(function (result) {
            console.log(result);
            res.status(201).send({message: 'Stay created', room:room});
        }, function (err) {
            console.log(err);
            res.status(500).send('Write ERROR');
        });
    }
    else {
        res.status(400).send('Parameter ERROR');
    }
    });

exports.testmethod = functions.https.onRequest((req, res) => {
    var room = getRoom(req.body.room_id);
    room.then(function (result) {
        console.log(result);
        res.status(200).send('ok');
    }, function (err) {
        console.log(err);
        res.status(400).send('error');
    });

});

function createOwner(id, email, phone, name, property_name) {
    var owner = {
        id: id,
        email: email,
        phone: phone,
        name: name,
        property_name: property_name
    };
    return owner;
}

function createRoom(date_start, date_end, guest, owner) {
    var room = {
        id: uuid.v4(),
        date_start: date_start,
        date_end: date_end,
        guest_id: guest.id,
        date_last_msg: currentDate(),
        guest_name: guest.name,
        last_msg_str: 'mock msg',
        property_name: owner.property_name,
        message_count: 0
    };
    return room;
}

function createrUser(id, name, phone, email) {
    var user = {
        id: id,
        name: name,
        phone: phone,
        email: email,
        start_date: "1970-01-01T00:00:00+0000",
        end_date: "1970-01-01T00:00:00+0000",
        related_room_id: "__UNDEFINED__"
    };
    return user;
}

function createMessage(id, text, date, room_id, sender_id, sender_name) {
    var message = {
        id: id,
        text: text,
        date: date,
        room_id: room_id,
        sender_id: sender_id,
        sender_name: sender_name
    };
    return message;
}


function currentDate() {
	var currentDate = moment().utc().format("YYYY-MM-DDTHH:mm:ssZZ");
	return currentDate;
}

function getRoom(id) {
    var promise = new Promise(function (resolve, reject) {
        var ref = getRefForRoomID(id);
        ref.once('value', function (snap) {
            resolve(snap.val());
        }, function (err) {
            console.log('The read failed: ' + err.code);
            reject(Error(err.code));
        });
    });
    return promise;
}

function getOwner(id) {
    var promise = new Promise(function (resolve, reject) {
        var ref = getRefForOwnerID(id);
        ref.once('value', function (snap) {
            resolve(snap.val());
        }, function (err) {
            console.log('The read failed: ' + err.code);
            reject(Error(err.code));
        });
    });
    return promise;
}

function getUser(id) {
    var promise = new Promise(function (resolve, reject) {
        var ref = getRefForUserID(id);
        ref.once("value", function(snap) {
            resolve(snap.val());
        }, function (err) {
            console.log('The read failed: ' + err.code);
            reject(Error(err.code));
        });
    });
    return promise;
}

function setOwner(owner) {
    var promise = new Promise(function (resolve, reject) {
        var ref = getRefForOwnerID(owner.id);
        ref.set(owner, function(error) {
            if (error) {
                reject(Error(error.code));
            }
            else {
                resolve('ok');
            }
        });
    });
    return promise;
}

function setRoom(room) {
    var promise = new Promise(function (resolve, reject) {
        var ref = getRefForRoomID(room.id);
        ref.set(room, function (error) {
            if (error) {
                reject(Error(error.code));
            }
            else {
                resolve('ok');
            }
        });
    });
    return promise;
}

function addGuestToOwner(ownerID, guestID) {
    var promise = new Promise(function (resolve, reject) {
        var guestlistRef = getRefForOwnerID(ownerID).child('guests').child(guestID);
        guestlistRef.set(guestID, function (error) {
            if (error) {
                reject(Error(error.code));
            }
            else {
                resolve('ok');
            }
        });
    });
    return promise;
}

function setUserStayInterval(userID, startDate, endDate) {
    var promise = new Promise(function (resolve, reject) {
        var userRef = getRefForUserID(userID);
        userRef.update(
            {start_date: startDate,
                end_date: endDate}, function (error) {
                if (error) {
                    reject(Error(error.code));
                }
               else {
                    resolve('ok');
                }
            });
    });
    return promise;
}

function setUserRelatedRoom(userID, roomID) {
    var promise = new Promise(function (resolve, reject) {
        var userRef = getRefForUserID(userID).child('related_room_id');
        userRef.set(roomID, function (error) {
            if (error) {
                reject(Error(error.code));
            }
            else {
                resolve('ok');
            }
        });
    });
    return promise;
}

function setUser(user) {
    var promise = new Promise(function (resolve, reject) {
        var ref = getRefForUserID(user.id);
        ref.set(user, function (error) {
            if (error) {
                reject(Error(error.code));
            }
            else {
                resolve('ok');
            }
        });
    });
    return promise;
}

function addMessage(message) {
    var promise = new Promise(function (resolve, reject) {
        var ref = getRefForMessage(message.room_id, message.id);
        ref.set(message, function (error) {
            if (error) {
                reject(Error(error.code));
            }
            else {
                resolve('ok');
            }
        })
    });
    return promise;
}

function getRefForMessage(roomID, messageID) {
    return admin.database().ref('/messages').child(roomID).child(messageID);
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

function getRefForRoomID(id) {
    return admin.database().ref('/rooms').child(id);

}
