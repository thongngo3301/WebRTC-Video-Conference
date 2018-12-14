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

    let webRtcPeerSender = null;
    let webRtcPeerReceivers = {};
    let _localVideo = document.getElementById('localVideo');
    let candidatesQueueSender = [];
    let candidatesQueueReceivers = {};
    let _addedCQS = [];
    let _addedCQR = {};

    function joinRoom(name) {
        _room = name;

        if (!_myID) {
            _myID = generateID();
            console.log('Generated ID: ' + _myID);
        }

        // Get local media data
        // getUserMedia(_constraints, handleUserMedia, handleUserMediaError);

        initDefaultChannel();

        if (_room !== '') {
            console.log('Create or join room', _room);
            _defaultChannel.emit('create_or_join', { room: _room, from: _myID });
        }

        window.onbeforeunload = function (e) {
            _defaultChannel.emit('message', { type: 'bye', from: _myID });
        }
    }

    function toggleMic() {
        let tracks = _localStream.getTracks();
        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].kind == "audio") {
                tracks[i].enabled = !tracks[i].enabled;
            }
        }
    }

    function toggleVideo() {
        let tracks = _localStream.getTracks();
        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].kind == "video") {
                tracks[i].enabled = !tracks[i].enabled;
            }
        }
    }

	function onRemoteVideo(callback) {
        _onRemoteVideoCallback = callback;
    }

	function onLocalVideo(callback) {
        _onLocalVideoCallback = callback;
    }

    function onDataChannelMessage(callback) {
        _onDataChannelMessageCallback = callback;
    }

    function onParticipantHangup(callback) {
        _onParticipantHangupCallback = callback;
    }

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
            createUplinkOffer();
        })

        _defaultChannel.on('message', function (message) {
            console.log('Client received message:', message);
            if (message.type === 'newparticipant') {
                return;
            } else if (message.type === 'bye') {
                hangup(message.from);
            }
        });

        _defaultChannel.on('kms2cli', function (message) {
            switch (message.type) {
                case 'offer':
                    if (message.from && message.from != _myID) {
                        createDownlinkAnswer(message.sdp, message.from);
                    }
                    break;
                case 'answer':
                    if (!message.sdp) {
                        console.error("No sdpAnswer from server");
                        return;
                    }
                    webRtcPeerSender.processAnswer(message.sdp);
                    break;
                case 'candidate':
                    if (message.from && message.from != _myID && webRtcPeerReceivers[message.from]) {
                        if (!_addedCQR[message.from]) {
                            _addedCQR[message.from] = [];
                        }
                        if (_addedCQR[message.from].includes(message.candidate)) return;
                        _addedCQR[message.from].push(message.candidate);
                        if (webRtcPeerReceivers[message.from].getRemoteSessionDescriptor()) {
                            webRtcPeerReceivers[message.from].addIceCandidate(message.candidate);
                        } else {
                            if (!candidatesQueueReceivers[message.from]) {
                                candidatesQueueReceivers[message.from] = [];
                            }
                            candidatesQueueReceivers[message.from].push(message.candidate);
                        }
                    } else if (webRtcPeerSender) {
                        if (_addedCQS.includes(message.candidate)) return;
                        _addedCQS.push(message.candidate);
                        if (webRtcPeerSender.getRemoteSessionDescriptor()) {
                            webRtcPeerSender.addIceCandidate(message.candidate);
                        } else {
                            candidatesQueueSender.push(message.candidate);
                        }
                    }
                    break;
            }
        });
    }

    function addRemoteVideo(from) {
        // call the callback
        _onRemoteVideoCallback(from);
    }

    function generateID() {
        let s4 = function () {
            return Math.floor(Math.random() * 0x10000).toString(16);
        };
        return s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4();
    }

    function openSignalingChannel(channel) {
        let namespace = _host + '/' + channel;
        let sckt = io.connect(namespace);
        return sckt;
    }

    function processedSdp(sdp) {
        return preferOpus(sdp);
    }

    function createUplinkOffer() {
        if (!webRtcPeerSender) {

            const options = {
                localVideo: _localVideo,
                onicecandidate: onIceCandidateForUplink
            }

            webRtcPeerSender = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function (error) {
                if (error) {
                    console.error(error);
                    return;
                }

                this.generateOffer(function(error, sdpOffer) {
                    if (error) {
                        console.error(error);
                        return;
                    }
                    _defaultChannel.emit('cli2kms', { sdp: processedSdp(sdpOffer), from: _myID, type: 'offer' });
                });

                if (candidatesQueueSender.length) {
                    candidatesQueueSender.forEach(candidate => {
                        this.addIceCandidate(candidate);
                    });
                }
            });
        }
    }
    function createDownlinkAnswer(sdp, participantId) {
        if (!webRtcPeerReceivers[participantId]) {
            addRemoteVideo(participantId);
            let _remoteVideo = document.getElementById(`video-${participantId}`);
            const options = {
                remoteVideo: _remoteVideo,
                onicecandidate: onIceCandidateForDownlink
            }

            webRtcPeerReceivers[participantId] = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function (error) {
                if (error) {
                    console.error(error);
                    return;
                }
                this.processOffer(sdp, function(err, sdpAnswer) {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    _defaultChannel.emit('cli2kms', { sdp: processedSdp(sdpAnswer), from: _myID, to: participantId, type: 'answer' });
                });
                if (candidatesQueueReceivers[participantId] && candidatesQueueReceivers[participantId].length) {
                    candidatesQueueReceivers[participantId].forEach(candidate => {
                        this.addIceCandidate(candidate);
                    });
                }
            });
        }
    }

    function onIceCandidateForUplink(candidate) {
        let message = {
            type: 'candidateUplink',
            candidate: candidate,
            from: _myID
        }
        _defaultChannel.emit('cli2kms', message);
    }
    function onIceCandidateForDownlink(candidate) {
        let message = {
            type: 'candidateDownlink',
            candidate: candidate,
            from: _myID
        }
        _defaultChannel.emit('cli2kms', message);
    }

    function hangup(from) {
        console.log('Bye received from ' + from);

        // if (_opc.hasOwnProperty(from)) {
        //     _opc[from].close();
        //     _opc[from] = null;
        // }

        // if (_apc.hasOwnProperty(from)) {
        //     _apc[from].close();
        //     _apc[from] = null;
        // }

        _onParticipantHangupCallback(from);
    }

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
        }
    }

    function handleReceiveChannelStateChange(participantId) {
        return function () {
            let readyState = _sendChannel[participantId].readyState;
            console.log('Receive channel state is: ' + readyState);
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
