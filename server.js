/**
 * Server module.
 *
 *
 */

'use strict';

const nodestatic = require('node-static');
const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');
const kurento = require('kurento-client');

const serverPort = 8443;

////////////////////////////////////////////////
// LOCAL
// const serverIpAddress = '0.0.0.0';
// const socketIoServer = 'https://localhost';
// const socketIoServer = 'https://192.168.16.211';
const kurento_uri = 'ws://192.168.0.20:8888/kurento';
////////////////////////////////////////////////

////////////////////////////////////////////////
// PRODUCTION
const serverIpAddress = '0.0.0.0';
const socketIoServer = 'fit5.fit-uet.tk';
// const kurento_uri = 'ws://localhost:8888/kurento';
////////////////////////////////////////////////

const pkey = fs.readFileSync('keys/key.pem');
const pcert = fs.readFileSync('keys/cert.pem');
const options = {
	key: pkey,
	cert: pcert
}
////////////////////////////////////////////////
// SETUP SERVER
////////////////////////////////////////////////

const app = express();

require('./router')(app, socketIoServer);

// Static content (css, js, .png, etc) is placed in /public
app.use(express.static(__dirname + '/public'));

// Location of our views
app.set('views', __dirname + '/views');

// Use ejs as our rendering engine
app.set('view engine', 'ejs');

// Tell Server that we are actually rendering HTML files through EJS.
app.engine('html', require('ejs').renderFile);

const sslServ = https.createServer(options, app).listen(serverPort, serverIpAddress, function () {
	console.log("Express is running on port " + serverPort);
});

// const server = app.listen(serverPort, serverIpAddress, function () {
// 	console.log("Express is running on port " + serverPort);
// });

//random name
const usersDB = {
	roonName: [
		{
			userName: "x",
			participantID: "1"
		},
	]
}
const nameTemplates = [
	'Chó', 'Mèo', 'Lợn', 'Gà', 'DOGE', 'Quạ', 'Chồn chồn', 'Gấu', 'Chim cánh cụt', 'Khung long', 'Tê tê', 'Chuồn chuồn', 'Cá sẫu', 'Cá đẹp', 'Cá mập', 'Mèo', 'Tu hú', 'Chim sẻ', 'Cu gáy', 'Chim cu', 'Đà điểu', 'Lười', 'Tinh tinh', 'Đười ươi'
]
const names = {
	roomName: [
		'Chó', 'Mèo', 'Lợn', 'Gà', 'DOGE', 'Quạ', 'Chồn chồn', 'Gấu', 'Chim cánh cụt', 'Khung long', 'Tê tê', 'Chuồn chuồn', 'Cá sẫu', 'Cá đẹp', 'Cá mập', 'Mèo', 'Tu hú', 'Chim sẻ', 'Cu gáy', 'Chim cu', 'Đà điểu', 'Lười', 'Tinh tinh', 'Đười ươi'
	]
}

function getRandomName(tmpName, roomName) {
	if (names[roomName]) {
		const namesTmp = names[roomName].slice();
		tmpName.forEach(element => {
			namesTmp.splice(namesTmp.indexOf(element.userName), 1);
		});
		const name = namesTmp[Math.floor(Math.random() * namesTmp.length)]
		return name;
	} else {
		names[roomName] = [
			'Chó', 'Mèo', 'Lợn', 'Gà', 'DOGE', 'Quạ', 'Chồn chồn', 'Gấu', 'Chim cánh cụt', 'Khung long', 'Tê tê', 'Chuồn chuồn', 'Cá sẫu', 'Cá đẹp', 'Cá mập', 'Mèo', 'Tu hú', 'Chim sẻ', 'Cu gáy', 'Chim cu', 'Đà điểu', 'Lười', 'Tinh tinh', 'Đười ươi'
		]
		const namesTmp = names[roomName].slice();
		tmpName.forEach(element => {
			namesTmp.splice(namesTmp.indexOf(element.userName), 1);
		});
		const name = namesTmp[Math.floor(Math.random() * namesTmp.length)]
		return name;
	}

}


//end
const io = require('socket.io').listen(sslServ);

const sdpOfferCache = {};
let candidatesQueue = {};

////////////////////////////////////////////////
// EVENT HANDLERS
////////////////////////////////////////////////

io.sockets.on('connection', function (socket) {

	function log() {
		let array = [">>> Message from server: "];
		for (let i = 0; i < arguments.length; i++) {
			array.push(arguments[i]);
		}
		socket.emit('log', array);
	}

	socket.on('message', function (message) {
		log('Got message: ', message);
		socket.broadcast.to(socket.room).emit('message', message);
	});

	socket.on('disconnect', function () {
		socket.broadcast.to(socket.room).emit('message', {
			type: 'bye',
			from: socket.participantID
		});
	});

	socket.on('cli2kms', function (message) {
		switch (message.type) {
			// 1
			case 'offer':
				kurento(kurento_uri, (error, kurentoClient) => {
					if (error) {
						console.error(error);
					}
					else {
						kurentoClient.create('MediaPipeline', (error, pipeline) => {
							socket.pipeline = pipeline;
							pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
								socket.webRtcEndpoint = webRtcEndpoint;
								// Relay icecandidate from kurento server to client
								webRtcEndpoint.on('OnIceCandidate', event => {
									let candidate = kurento.getComplexType('IceCandidate')(event.candidate);
									socket.emit('kms2cli', {
										type: 'candidate',
										candidate: candidate
									});
								});
								// received sdpOffer and response sdpAnswer
								// console.log('offer sdp', message.sdp);
								webRtcEndpoint.processOffer(message.sdp, (error, sdpAnswer) => {
									if (error) {
										console.error(error);
									}
									else {
										// 2
										socket.emit('kms2cli', {
											type: 'answer',
											sdp: sdpAnswer
										});
										// Search icecandidate available
										webRtcEndpoint.gatherCandidates(error => {
											if (error) {
												console.error(error);
												return;
											}
										});
									}
								});

								let numOfUserInRoom = io.sockets.clients(socket.room).length;
								if (numOfUserInRoom <= 1) return;
								io.sockets.clients(socket.room).forEach(client => {
									if (client.participantID != socket.participantID) {
										// old user as viewer
										// 2.5
										client.pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
											// client.streamInput[socket.participantID] = webRtcEndpoint;
											socket.streamInput[client.participantID] = webRtcEndpoint;
											webRtcEndpoint.on('OnIceCandidate', event => {
												let candidate = kurento.getComplexType('IceCandidate')(event.candidate);
												socket.emit('kms2cli', {
													type: 'candidate',
													candidate: candidate,
													from: client.participantID
												});
											});
											client.webRtcEndpoint.connect(webRtcEndpoint, error => {
												console.error(error);
											});
											// webRtcEndpoint.connect(client.webRtcEndpoint, err => console.error(err));
											webRtcEndpoint.generateOffer((error, sdp) => {
												socket.emit('kms2cli', {
													type: 'offer',
													sdp: sdp,
													from: client.participantID
												});
												webRtcEndpoint.gatherCandidates(error => {
													console.error(error);
												});
											});
										});

										// new user as viewer
										// 3
										socket.pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
											// socket.streamInput[client.participantID] = webRtcEndpoint;
											client.streamInput[socket.participantID] = webRtcEndpoint;
											webRtcEndpoint.on('OnIceCandidate', event => {
												let candidate = kurento.getComplexType('IceCandidate')(event.candidate);
												client.emit('kms2cli', {
													type: 'candidate',
													candidate: candidate,
													from: socket.participantID
												});
											});
											socket.webRtcEndpoint.connect(webRtcEndpoint, error => {
												console.error(error);
											});
											webRtcEndpoint.generateOffer((error, sdp) => {
												client.emit('kms2cli', {
													type: 'offer',
													sdp: sdp,
													from: socket.participantID
												});
												webRtcEndpoint.gatherCandidates(error => {
													console.error(error);
												});
											});
										});
									}
								});
							});
						});
					}
				});
				break;
			case 'answer':
				io.sockets.clients(socket.room).forEach(client => {
					if (client.participantID == message.from && client.streamInput && client.streamInput[message.to]) {
						client.streamInput[message.to].processAnswer(message.sdp);
					}
				});
				break;
			case 'candidateUplink':
				if (socket.webRtcEndpoint) {
					socket.webRtcEndpoint.addIceCandidate(message.candidate);
				}
				// else {
				// 	if (!candidatesQueue[socket.room]) {
				// 		candidatesQueue[socket.room] = [];
				// 	}
				// 	candidatesQueue[socket.room].push(message.candidate);
				// }
				break;
			case 'candidateDownlink':
				io.sockets.clients(socket.room).forEach(client => {
					if (client.participantID == message.from && client.streamInput && client.streamInput[message.to]) {
						client.streamInput[message.to].addIceCandidate(message.candidate);
					}
					// else {
					// 	if (!candidatesQueue[socket.room]) {
					// 		candidatesQueue[socket.room] = [];
					// 	}
					// 	candidatesQueue[socket.room].push(message.candidate);
					// }
				});
				break;
		}
	});

	socket.on('create_or_join', function (message) {
		let room = message.room;
		socket.room = room;
		socket.streamInput = {};
		let participantID = message.from;
		socket.participantID = participantID;
		configNameSpaceChannel(participantID);

		let numClients = io.sockets.clients(room).length;

		log('Room ' + room + ' has ' + numClients + ' client(s)');
		log('Request to create or join room', room);

		if (numClients == 0) {
			socket.join(room);
			socket.emit('created', room);
			usersDB[room] = [];
			//random name
			const userTmp = usersDB[room].find(e => e.participantID === socket.participantID);
			console.log(userTmp);
			if (userTmp) {
				socket.userName = userTmp.userName;
				console.log("old");
			} else {
				console.log("new");
				socket.userName = getRandomName(usersDB[room], room);
				usersDB[room].push(socket);
			}
		} else {
			//random name
			const userTmp = usersDB[room].find(e => e.participantID === socket.participantID);
			console.log(userTmp);
			if (userTmp) {
				socket.userName = userTmp.userName;
				console.log("old");
			} else {
				console.log("new");
				socket.userName = getRandomName(usersDB[room], room);
				usersDB[room].push(socket);
			}

			io.sockets.in(room).emit('join', room);
			socket.join(room);
			socket.emit('joined', room);
		}

		socket.emit('create_or_join_success');
	});

	socket.on('send_message', function (message) {
		let room = socket.room;
		io.sockets.clients(room).forEach(client => {
			if (client.participantID != socket.participantID) {
				client.emit('new_message', JSON.stringify({
					participantID: socket.participantID,
					message: message,
					userName: socket.userName
				}));
			}
		});
	});

	// Setup a communication channel (namespace) to communicate with a given participant (participantID)
	function configNameSpaceChannel(participantID) {
		let socketNamespace = io.of('/' + participantID);

		socketNamespace.on('connection', function (socket) {
			socket.on('message', function (message) {
				// Send message to everyone BUT sender
				socket.broadcast.emit('message', message);
			});
		});
	}
});
