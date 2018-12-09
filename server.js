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

const io = require('socket.io').listen(sslServ);

const sdpOfferCache = {};


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

	socket.on('cli2kms', function(message) {
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
									}
								});
								// Search icecandidate available
								webRtcEndpoint.gatherCandidates(error => {
									if (error) {
										console.error(error);
										return;
									}
								});

								io.sockets.clients(socket.room).forEach(client => {
									if (client.participantID != socket.participantID) {
										// old user as viewer
										// 2.5
										socket.pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
											client.streamInput[socket.participantID] = webRtcEndpoint;
											webRtcEndpoint.on('OnIceCandidate', event => {
												let candidate = kurento.getComplexType('IceCandidate')(event.candidate);
												socket.emit('kms2cli', {
													type: 'candidate',
													candidate: candidate,
													from: client.participantID
												});
											});
											socket.webRtcEndpoint.connect(webRtcEndpoint, error => {
												console.error(error);
											});
											webRtcEndpoint.generateOffer((error, sdp) => {
												if (error) {
													console.error(error);
												}
												else {
													client.emit('kms2cli', {
														type: 'offer',
														sdp: sdp,
														from: socket.participantID
													});
												}
											})
											webRtcEndpoint.gatherCandidates(error => {
												console.error(error);
											});
										});
									} else {
										// new user as viewer
										// 3
										client.pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
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
											webRtcEndpoint.generateOffer((error, sdp) => {
												socket.emit('kms2cli', {
													type: 'offer',
													sdp: sdp,
													from: client.participantID
												});
											});
											webRtcEndpoint.gatherCandidates(error => {
												console.error(error);
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
					client.streamInput[client.participantID].processAnswer(message.sdp);
				});
				// if (socket.participantID == message.from) {
				// 	console.log('CAC');
				// 	socket.webRtcEndpoint.processAnswer(message.sdp);
				// }
				break;
			case 'candidate':
				if (message.from == socket.participantID && socket.webRtcEndpoint) {
					socket.webRtcEndpoint.addIceCandidate(message.candidate);
				}
				else if (socket.streamInput[message.from]) {
					socket.streamInput[message.from].addIceCandidate(message.candidate);
				}
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
		} else {
			io.sockets.in(room).emit('join', room);
			socket.join(room);
			socket.emit('joined', room);
		}

		socket.emit('create_or_join_success');
	});

	socket.on('send_message', function(message) {
		let room = socket.room;
		io.sockets.clients(room).forEach(client => {
			if (client.participantID != socket.participantID) {
				client.emit('new_message', JSON.stringify({
					participantID: socket.participantID,
					message: message
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
