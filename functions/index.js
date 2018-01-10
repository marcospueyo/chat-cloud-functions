'use strict';

const functions = require('firebase-functions');
const moment = require('moment');
const cors = require('cors')({origin: true});

// The Firebase Admin SDK to access the Firebase Realtime Database. 
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

var events = require('events');

const uuid = require('uuid');

exports.addMessage = functions.https.onRequest((req, res) => {
    if (req.method === 'PUT') {
        res.status(403).send('Forbidden!');
    }
    cors(req, res, () => {
        var paramsOK = req.body.text && req.body.room_id && req.body.sender_id
            && req.body.id;
        var message;
        if (paramsOK) {
            getUser(req.body.sender_id)
            .then(function (user) {
                message = createMessage(req.body.id, req.body.text, currentDate(),
                    req.body.room_id, user.id, user.name);
                return addMessage(message);
            }, function (err) {
                console.log(err);
                res.status(500).send('Write ERROR');
            })
            .then(function (result) {
                console.log('Message saved successfully');
                return updateRoom(message)
            }, function (err) {
                console.log(err);
                res.status(500).send('Write ERROR');
            })
            .then(function (result) {
                console.log(result);
                res.status(201).send({response: 'Message saved successfully'});
            }, function (err) {
                console.log(err);
                res.status(500).send('Write ERROR');
            });
        }
        else {
            res.status(400).send('Parameter ERROR');
        }
    });
});

exports.updateMessageCount = functions.database.ref('/messages/{roomID}/{messageID}')
    .onWrite(event => {
        var roomID = event.params.roomID;
        const message = event.data.val();
        const senderID = message.sender_id;
        var room;
        console.info('updateMessageCount', event.params.roomID);
        const roomRef = getRefForRoomID(event.params.roomID).child('message_count');
        return roomRef.transaction(current => {
            if (event.data.exists() && !event.data.previous.exists()) {
                return (current || 0) + 1;
            }
            else if (!event.data.exists() && event.data.previous.exists()) {
                return (current || 0) - 1;
            }
            })
            .then(() => {
                return getRoom(roomID);
            }).then(function (result) {
                room = result;
                return getRoomParticipants(roomID);
            }, function (err) {
                console.log(err);
            })
            .then(function (result) {
                console.log(result);
                return notifyParticipants(senderID, result, message, room);
            })
            .then(function (result) {
                console.log(result);
                console.log('Message count updated.')
            }, function (err) {
                console.log(err);
            });
});

exports.updateReadCount = functions.https.onRequest((req, res) => {
    if (req.method === 'PUT') {
        res.status(403).send('Forbidden!');
    }
    cors(req, res, () => {
        var paramsOk = req.body.user_id && req.body.room_id && req.body.count;
        if (paramsOk) {
            getUser(req.body.user_id)
            .then(result => {
                return getRoom(req.body.room_id);
            }, error => {
                console.log(error);
                res.status(500).send('User doesn\'t exist ERROR');
            })
            .then(result => {
                return setReadCount(req.body.room_id, req.body.user_id, req.body.count);
            }, error => {
                console.log(error);
                res.status(500).send('Room doesn\'t exist ERROR');
            })
            .then(result => {
                console.log(result);
                res.status(201).send({response: 'Read count updated successfully'});
            }, error => {
                console.log(error);
                res.status(500).send('Write ERROR');
            });
        } else {
            res.status(400).send('Parameter ERROR');
        }
    });
});

exports.addOwner = functions.https.onRequest((req, res) => {
    if (req.method === 'PUT') {
        res.status(403).send('Forbidden!');
    }
    cors(req, res, () => {
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
});

exports.addUser = functions.https.onRequest((req, res) => {
    if (req.method === 'PUT') {
        res.status(403).send('Forbidden!');
    }
    cors(req, res, () => {
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
});

exports.tokenRefresh = functions.https.onRequest((req, res) => {
    if (req.method === 'PUT') {
        res.status(403).send('Forbidden!');
    }
    cors(req, res, () => {
       var paramsOK = req.body.id && req.body.token;
       if (paramsOK) {
           setUserToken(req.body.id, req.body.token)
               .then(function (result) {
               console.log(result);
               res.status(200).send({message: 'Token saved'});
           }, function (err) {
                   console.log(err);
                   res.status(500).send('Write ERROR');
               });
       }
       else {
           res.status(400).send('Parameter ERROR');
       }
    });

});

exports.addStay = functions.https.onRequest((req, res) => {
    if (req.method === 'PUT') {
        res.status(403).send('Forbidden!');
    }
    cors(req, res, () => {
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
                return addParticipation(room.id, user.id);
            }, function (err) {
                console.log(err);
                res.status(500).send('Write ERROR');
            })
            .then(function (result) {
                console.log(result);
                return addParticipation(room.id, owner.id);
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
                return setGuestRelatedRoom(user.id, owner.id, room.id);
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
});

exports.getRooms = functions.https.onRequest((req, res) => {
    if (req.method === 'PUT') {
        res.status(403).send('Forbidden!');
    }
    cors(req, res, () => {
        getRoomsForOwner(req.body.owner_id).then(function (result) {
            console.log('getRooms result ' + result);
            res.status(200).send(result);
        }, function (err) {
            console.log(err);
            res.status(400).send('error');
        });
    });
});

exports.getParticipations = functions.https.onRequest((req, res) => {
    if (req.method === 'PUT') {
        res.status(403).send('Forbidden!');
    }
    cors(req, res, () => {
        getParticipationsForOwner(req.body.owner_id).then(result => {
            console.log('getParticipations result ' + result);
            res.status(200).send(result);
        }, err => {
            console.log(err);
            res.status(400).send('error');
        });
    });
});

exports.getGuests = functions.https.onRequest((req, res) => {
    if (req.method === 'PUT') {
        res.status(403).send('Forbidden!');
    }
    cors(req, res, () => {
        getGuestsForOwner(req.body.owner_id).then(function (result) {
            console.log('getGuests result ' + result);
            res.status(200).send(result);
        }, function (err) {
            console.log(err);
            res.status(400).send('error');
        });
    });
});

exports.getGuestRoom = functions.https.onRequest((req, res) => {
    if (req.method === 'PUT') {
        res.status(403).send('Forbidden!');
    }
    cors(req, res, () => {
        var roomID;
        getRoomForGuest(req.body.guest_id).then(function (result) {
            console.log('getRoomForGuest result ' + result);
            roomID = result;
            return getRoom(roomID);
        }, function (err) {
            console.log(err);
            res.status(400).send('error');
        }).then(function (result) {
            console.log("getRoom result " + result);
            res.status(200).send(result);
        }, function (err) {
            console.log(err);
            res.status(400).send('error');
        });
    });
});

exports.testmethod = functions.https.onRequest((req, res) => {
    if (req.method === 'PUT') {
        res.status(403).send('Forbidden!');
    }
    cors(req, res, () => {
        const roomID = '807048e1-2ae7-4015-bcec-abfc509291f2';
        const senderID = 'zwe85qHCEhY0PLaRIb6RtWzmeor2';
        const message = createMessage('dfhdih', 'test msgs', '2017-12-01T10:12:37+0000', roomID, senderID, 'test sender name');
        var room;
        getRoom(roomID)
        .then(function (result) {
            room = result;
            return getRoomParticipants(roomID);
        }, function (err) {
            console.log(err);
            res.status(400).send('error');
        })
        .then(function (result) {
            console.log(result);
            return notifyParticipants(senderID, result, message, room);
        }, function (err) {
            console.log(err);
            res.status(400).send('error');
        }).then(function (result) {
            console.log(result);
            res.status(200).send(result);
        }, function (err) {
            console.log(err);
            res.status(400).send('error');
        });
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

function getRoomForGuest(guestID) {
    var promise = new Promise(function(resolve, reject) {
        var ref = getRefForUserID(guestID).child('related_room_id');
        var roomID;
        ref.once('value', function (snap) {
            roomID = snap.val();
            resolve(roomID);
        }, function (err) {
            console.log('The read failed: ' + err.code);
            reject(Error(err.code));
        });
    });
    return promise;
}

function getGuestsForOwner(ownerID) {
    var promise = new Promise(function (resolve, reject) {
        var ref = getRefForOwnerID(ownerID).child('guests');
        var guests = [];
        var fetchedGuests = [];
        ref.once('value', function (snap) {
            snap.forEach(function (child) {
                guests.push(child.key);
            });
            getSetOfGuests(guests, fetchedGuests).then(() => resolve(fetchedGuests));
        }, function (err) {
            console.log('The read failed: ' + err.code);
            reject(Error(err.code));
        });
    });
    return promise;
}

function getRoomParticipants(roomID) {
    return new Promise(function (resolve, reject) {
        var ref = getRefForRoomParticipations(roomID);
        var participants = [];
        ref.once('value', snap => {
            snap.forEach(child => {
               participants.push(child.key);
            });
            resolve(participants);
        }, err => {
            console.log('The read failed: ' + err.code);
            reject(Error(err.code));
        });
    });
}

function notifyParticipants(senderID, participantIDArray, message, room) {
    var promise = new Promise(function (resolve, reject) {
        // participantArray.forEach
        var users = [];
        getSetOfGuests(participantIDArray, users)
            .then(function () {
                users.forEach(function (item) {
                    if (item.hasOwnProperty('token') && item.id != senderID) {
                        notifySingleUser(item.token, message, room);
                    }
                });
                resolve('ok');
            });

    });
    return promise;
}

function notifySingleUser(token, message, room) {
    console.log('Notify token ' + token);

    var payload = {
        data: {
            room_id: room.id,
            property_name: room.property_name,
            sender_name: message.sender_name,
            text: message.text
        }
    };

    //iOS COMPLIANT
    // var payload = {
    //     notification: {
    //      title: "Nuevo mensaje",
    //      body: message.sender_name + ": " + message.text
    //      }
    // };

    //iOS COMPLIANT
    // var payload = {
    //     notification: {
    //          title: "Nuevo mensaje",
    //          body: message.sender_name + ": " + message.text
    //          },
    //     data: {
    //         room_id: room.id,
    //         property_name: room.property_name,
    //         sender_name: message.sender_name,
    //         text: message.text
    //     }
    // };

    var options = {
        priority: "high",
        timeToLive: 60 * 60 * 24
    };

    admin.messaging().sendToDevice(token, payload, options)
    .then(function (response) {
        console.log("Successfully sent message:", response);
    }).catch(function(error) {
        console.log("Error sending message:", error);
    });
}

function getRoomsForOwner(ownerID) {
    var promise = new Promise(function (resolve, reject) {
        var ref = getRefForOwnerID(ownerID).child('guests');
        var rooms = [];
        var fetchedRooms = [];
        ref.once('value', function (snap) {
            snap.forEach(function (child) {
                rooms.push(child.val());
            });
            getSetOfRooms(rooms, fetchedRooms).then(() => resolve(fetchedRooms));
        }, function (err) {
            console.log('The read failed: ' + err.code);
            reject(Error(err.code));
        });
    });
    return promise;
}

function getParticipationsForOwner(ownerID) {
    return new Promise((resolve, reject) => {
        var ref = getRefForOwnerID(ownerID).child('guests');
        var rooms = [];
        var participations = [];
        ref.once('value', snap => {
            snap.forEach(child => {
                rooms.push(child.val());
            });
            getSetOfParticipations(rooms, ownerID, participations)
            .then(() => resolve(participations));
        }, err => {
            console.log('The read failed: ' + err.code);
            reject(Error(err.code));
        });
    });
}

function getSetOfRooms(arr, fetchedRooms) {
    return arr.reduce((promise, item) => {
        return promise.then((result) => {
            console.log('item ' + item);
            return getRoom(item).then(result => fetchedRooms.push(result));
        }).catch(console.error);
        }, Promise.resolve());
}

function getSetOfParticipations(rooms, user_id, participations) {
    return rooms.reduce((promise, room_id) => {
        return promise.then((result) => {
            return getParticipation(room_id, user_id).then(result => {
                if (result != null) {
                    participations.push(result);
                }
            });
        }).catch(console.error);
    }, Promise.resolve());
}

function getSetOfGuests(arr, fetchedGuests) {
    return arr.reduce((promise, item) => {
            return promise.then((result) => {
                console.log('item ' + item);
                return getUser(item).then(result => fetchedGuests.push(result));
            }).catch(console.error);
        }, Promise.resolve());
}

// function getSetOfTokens(participantArray, fetchedTokens) {
//     return arr.reduce((promise, item) => {
//         return promise.then((result) => {
//             console.log('item ' + item);
//             return getUser(item).then(result => fetchedTokens.push(result.token));
//         })
//         }, Promise.resolve());
// }

function exampleFunc(item, cb) {
    console.log('done with', item);
    return cb(item);
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

function getParticipation(roomID, userID) {
    return new Promise((resolve, reject) => {
        var ref = getRefForRoomParticipations(roomID).child(userID);
        ref.once('value', snap => {
            resolve(snap.val());
        }, err => {
            console.log('The read failed: ' + err.code);
            reject(Error(err.code));
        });
    });
}

function getMessageCountForRoom(id) {
    var promise = new Promise(function (resolve, reject) {
        var ref = getRefForRoomMessages(id);
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

function setReadCount(roomID, userID, count) {
    return new Promise((resolve, reject) => {
        var ref = getRefForRoomParticipations(roomID).child(userID).child('read_count');
        getRefForRoomID(roomID).child('message_count').once('value').then(snapshot => {
            if (snapshot.val() < count) {
                count = snapshot.val();
            }
            ref.set(parseInt(count), error => {
                if (error) {
                    reject(Error(error.code));
                } else {
                    resolve('ok');
                }
            });
        });
    });
}

function addParticipation(roomID, userID) {
    return new Promise((resolve, reject) => {
        var ref = getRefForRoomParticipations(roomID).child(userID);
        ref.set({
            room_id: roomID,
            user_id: userID,
            read_count: 0
        }, error => {
            if (error) {
                reject(Error(error.code));
            } else {
                resolve('ok');
            }
        });
    });
}

function updateRoom(message) {
    //message_count: 0 + 1
    var room = {
        date_last_msg: currentDate(),
        last_msg_str: message.text
    };
    var promise = new Promise(function (resolve, reject) {
        var ref = getRefForRoomID(message.room_id);
        ref.update(room, function (error) {
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

function addGuestToOwner(ownerID, guestID) {
    var promise = new Promise(function (resolve, reject) {
        var guestlistRef = getRefForOwnerID(ownerID).child('guests').child(guestID);
        guestlistRef.set('__UNDEFINED__', function (error) {
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

function setGuestRelatedRoom(guestID, ownerID, roomID) {
    var promise = new Promise(function (resolve, reject) {
        var ref = getRefForOwnerID(ownerID).child('guests').child(guestID);
        ref.set(roomID, function (error) {
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

function setUserToken(id, token) {
    var promise = new Promise(function (resolve, reject) {
        var ref = getRefForUserID(id).child('token');
        ref.set(token, function (error) {
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

function getRefForMessageTable() {
    return admin.database().ref('/messages');
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

function getRefForRoomMessages(roomID) {
    return getRefForMessageTable().child(roomID);
}

function getRefForRoomParticipations(roomID) {
    return admin.database().ref('/participations').child(roomID);
}
