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

const serverPort = 8443;

////////////////////////////////////////////////
// LOCAL
// const serverIpAddress = 'localhost';
// const socketIoServer = '127.0.0.1';
////////////////////////////////////////////////

////////////////////////////////////////////////
// PRODUCTION
const serverIpAddress = '0.0.0.0';
const socketIoServer = 'fit5.fit-uet.tk';
////////////////////////////////////////////////

const kurento_uri = 'ws://localhost:8888/kurento';
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

	socket.on('create_or_join', function (message) {
		let room = message.room;
		socket.room = room;
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
	});

	// create out of connection
	// 1
	socket.on('kurento_create_pipeline', function (message) {
		let sdpOffer = message.sdpOffer;
		kurento(kurento_uri, (error, kurentoClient) => {
			if (error) {
				console.log(error);
			}
			else {
				kurentoClient.create('MediaPipeline', (error, pipeline) => {
					socket.pipeline = pipeline;
					pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {

						socket.webRtcEndpoint = webRtcEndpoint;
						// Relay icecandidate from kurento server to client
						webRtcEndpoint.on('IceCandidate', event => {
							socket.emit('icecandidate_exchange', JSON.stringify(event.candidate));
						});

						// received sdpOffer and response sdpAnswer
						webRtcEndpoint.processOffer(sdpOffer, (error, sdpAnswer) => {
							if (error) {
								console.log(error);
							}
							else {
								socket.emit('kurento_answer', JSON.stringify(sdpAnswer));
							}
						});

						// Search icecandidate available
						webRtcEndpoint.gatherCandidates(error => {
							if (error) {
								console.log(error);
							}
						});
					});
				});
			}
		});
	});

	// new client joined
	socket.on('create_new_endpoint', function (message) {
		let sdpOffer = message.sdpOffer;
		let participantID = message.participantID;				// ID of new client
		let participantOffer = message.participantOffer;		// sdpOffer of new client
		let client = io.sockets.clients.filter(c => c.participantID == participantID)[0];

		/*
		 * Create endpoint for new client
		 * this as a presenter
		 */
		socket.pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
			webRtcEndpoint.on('IceCandidate', event => {
				client.emit('icecandidate_exchange', JSON.stringify(event.candidate));
			});

			webRtcEndpoint.gatherCandidates(error => {
				if (error) {
					console.log(error);
				};
			});

			webRtcEndpoint.processOffer(participantOffer, (error, sdpAnswer) => {
				client.emit('kurento_answer', JSON.stringify(sdpAnswer));
				socket.webRtcEndpoint.connect(webRtcEndpoint, error => {
					if (error) {
						console.log(error);
					}
				});
			});
		});

		// this as a viewer
		client.pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
			webRtcEndpoint.on('IceCandidate', event => {
				socket.emit('icecandidate_exchange', JSON.stringify(event.candidate));
			});

			webRtcEndpoint.gatherCandidates(error => {
				if (error) {
					console.log(error);
				}
			});

			webRtcEndpoint.processOffer(sdpOffer, (error, sdpAnswer) => {
				if (error) {
					console.log(error);
				}
				else {
					socket.emit('kurento_answer', JSON.stringify(sdpAnswer));
					client.webRtcEndpoint.connect(webRtcEndpoint, error => {
						if (error) {
							console.log(error);
						}
					});
				}
			});
		});
	});

	// notify for create in of connection
	// 2
	socket.on('broadcast_stream', function (message) {
		io.sockets.clients.broadcast(socket.room).emit('new_client_joined', JSON.stringify({
			participantID: socket.participantID,
			sdpOffer: message.sdpOffer
		}));
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
