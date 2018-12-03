'use strict';

let MeetingSfu = function (socketioHost, __id) {
    let exports = {};

    let _isInitiator = false;
    let _localStream;
    let _remoteStream;
    let _turnReady;
    let _pcConfig = {
        'iceServers': [
            { url: 'stun:118.70.171.246:3478' },
            {
                url: 'turn:118.70.171.246:3478',
                username: 'onlysea212',
                credential: 'Thisispassword123'
            }
        ]
    };
    let _constraints = { video: true, audio: true };
    let _defaultChannel;
    let _privateAnswerChannel;
    let _offerChannels = {};
    let _opc = {};
    let _apc = {};
    let _sendChannel = {};
    let _room;
    let _myID = __id;
    let _onRemoteVideoCallback;
    let _onLocalVideoCallback;
    let _onDataChannelMessageCallback;
    let _onParticipantHangupCallback;
    let _host = socketioHost;

    ////////////////////////////////////////////////
    // PUBLIC FUNCTIONS
    ////////////////////////////////////////////////
    /**
  *
  *
  * @param name of the room to join
  */
    function joinRoom(name) {
        _room = name;

        if (!_myID) {
            _myID = generateID();
            console.log('Generated ID: ' + _myID);
        }

        // Open up a default communication channel
        initDefaultChannel();

        if (_room !== '') {
            console.log('Create or join room', _room);
            _defaultChannel.emit('create_or_join', { room: _room, from: _myID });
        }

        // Open up a private communication channel
        // initPrivateChannel();

        // Get local media data
        getUserMedia(_constraints, handleUserMedia, handleUserMediaError);

        window.onbeforeunload = function (e) {
            _defaultChannel.emit('message', { type: 'bye', from: _myID });
        }
    }

    /**
	 *
	 * Toggle microphone availability.
	 *
	 */
    function toggleMic() {
        let tracks = _localStream.getTracks();
        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].kind == "audio") {
                tracks[i].enabled = !tracks[i].enabled;
            }
        }
    }

    /**
	 *
	 * Toggle video availability.
	 *
	 */
    function toggleVideo() {
        let tracks = _localStream.getTracks();
        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].kind == "video") {
                tracks[i].enabled = !tracks[i].enabled;
            }
        }
    }

	/**
	 *
	 * Add callback function to be called when remote video is available.
	 *
	 * @param callback of type function(stream, participantID)
	 */
    function onRemoteVideo(callback) {
        _onRemoteVideoCallback = callback;
    }

	/**
	 *
	 * Add callback function to be called when local video is available.
	 *
	 * @param callback function of type function(stream)
	 */
    function onLocalVideo(callback) {
        _onLocalVideoCallback = callback;
    }

    /**
	 *
	 * Add callback function to be called when a data channel message is available.
	 *
	 * @parama callback function of type function(message)
	 */
    function onDataChannelMessage(callback) {
        _onDataChannelMessageCallback = callback;
    }
    /**
	 *
	 * Add callback function to be called when a a participant left the conference.
	 *
	 * @parama callback function of type function(participantID)
	 */
    function onParticipantHangup(callback) {
        _onParticipantHangupCallback = callback;
    }

    ////////////////////////////////////////////////
    // INIT FUNCTIONS
    ////////////////////////////////////////////////

    function initDefaultChannel() {
        _defaultChannel = openSignalingChannel('');

        _defaultChannel.on('created', function (room) {
            console.log('Created room ' + room);
            _isInitiator = true;
        });

        _defaultChannel.on('join', function (room) {
            console.log('Another peer made a request to join room ' + room);
        });

        _defaultChannel.on('joined', function (room) {
            console.log('This peer has joined room ' + room);
        });

        _defaultChannel.on('create_or_join_success', function (message) {
            // let partID = message.from;
            createUplinkOffer();
        })

        _defaultChannel.on('message', function (message) {
            console.log('Client received message:', message);
            if (message.type === 'newparticipant') {
                // let partID = message.from;

                // Open a new communication channel to the new participant
                // _offerChannels[partID] = openSignalingChannel(partID);

                // Wait for answers (to offers) from the new participant
                // _offerChannels[partID].on('message', function (msg) {
                //     if (msg.dest === _myID) {
                //         if (msg.type === 'answer') {
                //             _opc[msg.from].setRemoteDescription(new RTCSessionDescription(msg.snDescription),
                //                 setRemoteDescriptionSuccess,
                //                 setRemoteDescriptionError);
                //         } else if (msg.type === 'candidate') {
                //             let candidate = new RTCIceCandidate({ sdpMLineIndex: msg.label, candidate: msg.candidate });
                //             console.log('got ice candidate from ' + msg.from);
                //             _opc[msg.from].addIceCandidate(candidate, addIceCandidateSuccess, addIceCandidateError);
                //         }
                //     }
                // });

                // Send an offer to the new participant
                // createOffer(partID);
            } else if (message.type === 'bye') {
                hangup(message.from);
            }
        });

        _defaultChannel.on('kms2cli', function (message) {
            switch (message.type) {
                case 'offer':
                    createDownlinkAnswer(message.sdp, message.from);
                    break;
                case 'answer':
                    _opc.setRemoteDescription(new RTCSessionDescription(message.sdp), setRemoteDescriptionSuccess, setRemoteDescriptionError);
                    break;
                case 'candidate':
                    let candidate = new RTCIceCandidate({ sdpMLineIndex: msg.label, candidate: msg.candidate });
                    if (message.from == _myID) {
                        _opc.addIceCandidate(candidate, addIceCandidateSuccess, addIceCandidateError);
                    } else {
                        _apc[message.from].addIceCandidate(candidate, addIceCandidateSuccess, addIceCandidateError);
                    }
                    break;
            }
        });
    }

    // function initPrivateChannel() {
    //     // Open a private channel (namespace = _myID) to receive offers
    //     _privateAnswerChannel = openSignalingChannel(_myID);

    //     // Wait for offers or ice candidates
    //     _privateAnswerChannel.on('message', function (message) {
    //         if (message.dest === _myID) {
    //             if (message.type === 'offer') {
    //                 let to = message.from;
    //                 createAnswer(message, _privateAnswerChannel, to);
    //             } else if (message.type === 'candidate') {
    //                 let candidate = new RTCIceCandidate({ sdpMLineIndex: message.label, candidate: message.candidate });
    //                 _apc[message.from].addIceCandidate(candidate, addIceCandidateSuccess, addIceCandidateError);
    //             }
    //         }
    //     });
    // }

    ///////////////////////////////////////////
    // UTIL FUNCTIONS
    ///////////////////////////////////////////

    /**
	 *
	 * Call the registered _onRemoteVideoCallback
	 *
	 */
    function addRemoteVideo(stream, from) {
        // call the callback
        _onRemoteVideoCallback(stream, from);
    }

    /**
	 *
	 * Generates a random ID.
	 *
	 * @return a random ID
	 */
    function generateID() {
        let s4 = function () {
            return Math.floor(Math.random() * 0x10000).toString(16);
        };
        return s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4();
    }

    ////////////////////////////////////////////////
    // COMMUNICATION FUNCTIONS
    ////////////////////////////////////////////////

    /**
	 *
	 * Connect to the server and open a signal channel using channel as the channel's name.
	 *
	 * @return the socket
	 */
    function openSignalingChannel(channel) {
        let namespace = _host + '/' + channel;
        let sckt = io.connect(namespace);
        return sckt;
    }

    function createUplinkOffer() {
        _opc = new RTCPeerConnection(_pcConfig);
        _opc.onicecandidate = handleIceCandidateAnswerWrapper(_defaultChannel);
        // _opc.onaddstream = handleRemoteStreamAdded();
        // _opc.onremovestream = handleRemoteStreamRemoved;
        // _opc.addStream(_localStream);

        let onSuccess = function () {
            return function (sessionDescription) {
                // Set Opus as the preferred codec in SDP if Opus is present.
                sessionDescription.sdp = preferOpus(sessionDescription.sdp);

                _opc.setLocalDescription(sessionDescription, setLocalDescriptionSuccess, setLocalDescriptionError);
                _defaultChannel.emit('cli2kms', { sdp: sessionDescription, from: _myID, type: 'offer' });
            }
        }

        _opc.createOffer(onSuccess(), handleCreateOfferError);
    }
    function createDownlinkAnswer(sdp, participantId) {
        _apc[participantId] = new RTCPeerConnection(_pcConfig);
        _apc[participantId].onicecandidate = handleIceCandidateAnswerWrapper(_defaultChannel);
        _apc[participantId].onaddstream = handleRemoteStreamAdded(participantId);
        _apc[participantId].onremovestream = handleRemoteStreamRemoved;
        _apc[participantId].addStream(_localStream);
        _apc[participantId].setRemoteDescription(new RTCSessionDescription(sdp.sdp), setRemoteDescriptionSuccess, setRemoteDescriptionError);

        let onSuccess = function () {
            return function (sessionDescription) {
                sessionDescription.sdp = preferOpus(sessionDescription.sdp);

                _apc[participantId].setLocalDescription(sessionDescription, setLocalDescriptionSuccess, setLocalDescriptionError);
                _defaultChannel.emit('cli2kms', { sdp: sessionDescription, from: _myID, type: 'answer' });
            }
        }

        _apc[participantId].createAnswer(onSuccess(), handleCreateAnswerError);
    }

    function createOffer1(participantId) {
        console.log('Creating offer for peer ' + participantId);
        _opc[participantId] = new RTCPeerConnection(_pcConfig);
        _opc[participantId].onicecandidate = handleIceCandidateAnswerWrapper(_offerChannels[participantId], participantId);
        _opc[participantId].onaddstream = handleRemoteStreamAdded(participantId);
        _opc[participantId].onremovestream = handleRemoteStreamRemoved;
        _opc[participantId].addStream(_localStream);

        try {
            // Reliable Data Channels not yet supported in Chrome
            _sendChannel[participantId] = _opc[participantId].createDataChannel("sendDataChannel", { reliable: false });
            _sendChannel[participantId].onmessage = handleDataChannel;
            console.log('Created send data channel');
        } catch (e) {
            alert('Failed to create data channel. ' + 'You need Chrome M25 or later with RtpDataChannel enabled');
            console.log('createDataChannel() failed with exception: ' + e.message);
        }
        _sendChannel[participantId].onopen = handleSendChannelStateChange(participantId);
        _sendChannel[participantId].onclose = handleSendChannelStateChange(participantId);

        let onSuccess = function (participantId) {
            return function (sessionDescription) {
                let channel = _offerChannels[participantId];

                // Set Opus as the preferred codec in SDP if Opus is present.
                sessionDescription.sdp = preferOpus(sessionDescription.sdp);

                _opc[participantId].setLocalDescription(sessionDescription, setLocalDescriptionSuccess, setLocalDescriptionError);
                console.log('Sending offer to channel ' + channel.name);
                channel.emit('message', { snDescription: sessionDescription, from: _myID, type: 'offer', dest: participantId });
            }
        }

        _opc[participantId].createOffer(onSuccess(participantId), handleCreateOfferError);
    }

    function createAnswer1(sdp, cnl, to) {
        console.log('Creating answer for peer ' + to);
        _apc[to] = new RTCPeerConnection(_pcConfig);
        _apc[to].onicecandidate = handleIceCandidateAnswerWrapper(cnl, to);
        _apc[to].onaddstream = handleRemoteStreamAdded(to);
        _apc[to].onremovestream = handleRemoteStreamRemoved;
        _apc[to].addStream(_localStream);
        _apc[to].setRemoteDescription(new RTCSessionDescription(sdp.snDescription), setRemoteDescriptionSuccess, setRemoteDescriptionError);

        _apc[to].ondatachannel = gotReceiveChannel(to);

        let onSuccess = function (channel) {
            return function (sessionDescription) {
                // Set Opus as the preferred codec in SDP if Opus is present.
                sessionDescription.sdp = preferOpus(sessionDescription.sdp);

                _apc[to].setLocalDescription(sessionDescription, setLocalDescriptionSuccess, setLocalDescriptionError);
                console.log('Sending answer to channel ' + channel.name);
                channel.emit('message', { snDescription: sessionDescription, from: _myID, type: 'answer', dest: to });
            }
        }

        _apc[to].createAnswer(onSuccess(cnl), handleCreateAnswerError);
    }

    function hangup(from) {
        console.log('Bye received from ' + from);

        // if (_opc.hasOwnProperty(from)) {
        //     _opc[from].close();
        //     _opc[from] = null;
        // }

        if (_apc.hasOwnProperty(from)) {
            _apc[from].close();
            _apc[from] = null;
        }

        _onParticipantHangupCallback(from);
    }

    ////////////////////////////////////////////////
    // HANDLERS
    ////////////////////////////////////////////////

    // SUCCESS HANDLERS

    function handleUserMedia(stream) {
        console.log('Adding local stream');
        _onLocalVideoCallback(stream);
        _localStream = stream;
        _defaultChannel.emit('message', { type: 'newparticipant', from: _myID });
    }

    function handleRemoteStreamRemoved(event) {
        console.log('Remote stream removed. Event: ', event);
    }

    function handleRemoteStreamAdded(from) {
        return function (event) {
            console.log('Remote stream added');
            addRemoteVideo(event.stream, from);
            _remoteStream = event.stream;
        }
    }

    function handleIceCandidateAnswerWrapper(channel, to) {
        return function handleIceCandidate(event) {
            console.log('handleIceCandidate event');
            if (event.candidate) {
                channel.emit('add_candidate',
                    {
                        type: 'candidate',
                        label: event.candidate.sdpMLineIndex,
                        id: event.candidate.sdpMid,
                        candidate: event.candidate.candidate,
                        from: _myID,
                        dest: to
                    }
                );

            } else {
                console.log('End of candidates.');
            }
        }
    }

    function setLocalDescriptionSuccess() { }

    function setRemoteDescriptionSuccess() { }

    function addIceCandidateSuccess() { }

    function gotReceiveChannel(id) {
        return function (event) {
            console.log('Receive Channel Callback');
            _sendChannel[id] = event.channel;
            _sendChannel[id].onmessage = handleDataChannel;
            _sendChannel[id].onopen = handleReceiveChannelStateChange(id);
            _sendChannel[id].onclose = handleReceiveChannelStateChange(id);
        }
    }

    function handleDataChannel(event) {
        console.log('Received message: ' + event.data);
        _onDataChannelMessageCallback(event.data);
    }

    function handleSendChannelStateChange(participantId) {
        return function () {
            let readyState = _sendChannel[participantId].readyState;
            console.log('Send channel state is: ' + readyState);

            // check if we have at least one open channel before we set hat ready to false.
            // let open = checkIfOpenChannel();
            // enableMessageInterface(open);
        }
    }

    function handleReceiveChannelStateChange(participantId) {
        return function () {
            let readyState = _sendChannel[participantId].readyState;
            console.log('Receive channel state is: ' + readyState);

            // check if we have at least one open channel before we set hat ready to false.
            // let open = checkIfOpenChannel();
            // enableMessageInterface(open);
        }
    }

    function checkIfOpenChannel() {
        let open = false;
        for (let channel in _sendChannel) {
            if (_sendChannel.hasOwnProperty(channel)) {
                open = (_sendChannel[channel].readyState == "open");
                if (open == true) {
                    break;
                }
            }
        }

        return open;
    }

    // ERROR HANDLERS

    function handleCreateOfferError(event) {
        console.log('createOffer() error: ', event);
    }

    function handleCreateAnswerError(event) {
        console.log('createAnswer() error: ', event);
    }

    function handleUserMediaError(error) {
        console.log('getUserMedia error: ', error);
    }

    function setLocalDescriptionError(error) {
        console.log('setLocalDescription error: ', error);
    }

    function setRemoteDescriptionError(error) {
        console.log('setRemoteDescription error: ', error);
    }

    function addIceCandidateError(error) { }

    ////////////////////////////////////////////////
    // CODEC
    ////////////////////////////////////////////////

    // Set Opus as the default audio codec if it's present.
    function preferOpus(sdp) {
        let sdpLines = sdp.split('\r\n');
        let mLineIndex;
        // Search for m line.
        for (let i = 0; i < sdpLines.length; i++) {
            if (sdpLines[i].search('m=audio') !== -1) {
                mLineIndex = i;
                break;
            }
        }
        if (mLineIndex === null || mLineIndex === undefined) {
            return sdp;
        }

        // If Opus is available, set it as the default in m line.
        for (let i = 0; i < sdpLines.length; i++) {
            if (sdpLines[i].search('opus/48000') !== -1) {
                let opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
                if (opusPayload) {
                    sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
                }
                break;
            }
        }

        // Remove CN in m line and sdp.
        sdpLines = removeCN(sdpLines, mLineIndex);

        sdp = sdpLines.join('\r\n');
        return sdp;
    }

    function extractSdp(sdpLine, pattern) {
        let result = sdpLine.match(pattern);
        return result && result.length === 2 ? result[1] : null;
    }

    // Set the selected codec to the first in m line.
    function setDefaultCodec(mLine, payload) {
        let elements = mLine.split(' ');
        let newLine = [];
        let index = 0;
        for (let i = 0; i < elements.length; i++) {
            if (index === 3) { // Format of media starts from the fourth.
                newLine[index++] = payload; // Put target payload to the first.
            }
            if (elements[i] !== payload) {
                newLine[index++] = elements[i];
            }
        }
        return newLine.join(' ');
    }

    // Strip CN from sdp before CN constraints is ready.
    function removeCN(sdpLines, mLineIndex) {
        let mLineElements = sdpLines[mLineIndex].split(' ');
        // Scan from end for the convenience of removing an item.
        for (let i = sdpLines.length - 1; i >= 0; i--) {
            let payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
            if (payload) {
                let cnPos = mLineElements.indexOf(payload);
                if (cnPos !== -1) {
                    // Remove CN payload from m line.
                    mLineElements.splice(cnPos, 1);
                }
                // Remove CN line in sdp
                sdpLines.splice(i, 1);
            }
        }

        sdpLines[mLineIndex] = mLineElements.join(' ');
        return sdpLines;
    }

    ////////////////////////////////////////////////
    // EXPORT PUBLIC FUNCTIONS
    ////////////////////////////////////////////////

    exports.joinRoom = joinRoom;
    exports.toggleMic = toggleMic;
    exports.toggleVideo = toggleVideo;
    exports.onLocalVideo = onLocalVideo;
    exports.onRemoteVideo = onRemoteVideo;
    exports.onDataChannelMessage = onDataChannelMessage;
    exports.onParticipantHangup = onParticipantHangup;
    return exports;

};
