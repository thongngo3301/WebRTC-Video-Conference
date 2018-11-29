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
