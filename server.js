/**
 * Server module.
 *
 *
 */

'use strict';

const nodestatic = require('node-static');
const express = require('express');
const path = require('path');

const serverPort = process.env.OPENSHIFT_NODEJS_PORT || 1337
const serverIpAddress = process.env.OPENSHIFT_NODEJS_IP || 'localhost'
const socketIoServer = '127.0.0.1';
const kurento_uri = 'ws://localhost:8888/kurento';

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
const server = app.listen(serverPort, serverIpAddress, function () {
	console.log("Express is running on port " + serverPort);
});

const io = require('socket.io').listen(server);


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

	socket.on('create or join', function (message) {
		let room = message.room;
		socket.room = room;
		let participantID = message.from;
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
	
	socket.on('kurento create offer', function(data) {
		let sdpOffer = data.sdpOffer;
		kurento(kurento_uri, (error, kurentoClient) => {
			kurentoClient.create('MediaPipeline', (error, pipeline) => {
				if (error) {
					console.log(error);
				}
				else {
					socket.pipeline = pipeline;
					pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
						if (error) {
							console.log(error);
						}
						else {
							// Define handler received icecandidate
							webRtcEndpoint.on('OnIceCandidate', (event) => {
								// received icecandidate from server and send to client
								socket.emit('icecandidate exchange', JSON.stringify(event.candidate));
							});

							// Define handler create sdpAnswer
							webRtcEndpoint.processOffer(sdpOffer, (error, sdpAnswer) => {
								if (error) {
									console.log(error);
								}
								else {
									socket.emit('kurento answer offer', JSON.stringify(sdpAnswer));
								}
							});

							// Search icecandidate available
							webRtcEndpoint.gatherCandidates(error => {
								if (error) {
									console.log(error);
								}
							});

							socket.webRtcEndpoint = webRtcEndpoint;
						}
					});
				}
			});
		});
	});

	// create connect many to many
	socket.on('start stream', function (data) {
		let sdpOffer = data.sdpOffer;		
		let otherClients = io.sockets.clients(socket.room);
		
		otherClients.forEach(client => {
			// As presenter
			socket.pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
				if (error) {
					console.log(error);
				}
				else {
					if (client.presenters === undefined) {
						client.presenters = [];
					}
					client.presenters.push(webRtcEndpoint);
					webRtcEndpoint.on('IceCandidate', event => {
						socket.emit('icecandidate exchange', JSON.stringify(event.candidate));
					});
					webRtcEndpoint.processOffer(sdpOffer, (error, sdpAnswer) => {
						socket.webRtcEndpoint.connect(webRtcEndpoint, error => {
							if (error) {
								console.log(error);
							}
							else {
								client.emit('candidate exchange', JSON.stringify(event.candidate));
							}
						})
					})
				}
			});

			// As viewer
			client.pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
				if (error) {
					console.log(error);
				}
				else {
					
				}
			})
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
