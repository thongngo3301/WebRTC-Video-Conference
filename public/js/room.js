'use strict';

let host = HOST_ADDRESS; // HOST_ADDRESS gets injected into room.ejs from the server side when it is rendered

$(document).ready(function () {
	let room = window.location.pathname.match(/([^\/]*)\/*$/)[1];
	/////////////////////////////////
	// CREATE MEETING
	/////////////////////////////////

	setupMesh(room);

	// setupSfu(room);

}); // end of document.ready

function setupMesh(room) {
	let meeting_mesh = new MeetingMesh(host);

	meeting_mesh.onLocalVideo(function (stream) {
		//alert(stream.getVideoTracks().length);
		// document.querySelector('#localVideo').src = window.URL.createObjectURL(stream);
		document.querySelector('#localVideo').srcObject = stream;

		$("#micMenu").on("click", function callback(e) {
			meeting_mesh.toggleMic();
		});

		$("#videoMenu").on("click", function callback(e) {
			meeting_mesh.toggleVideo();
		});

		$("#localVideo").prop('muted', true);

	});

	meeting_mesh.onRemoteVideo(function (stream, participantID) {
		addRemoteVideo(stream, participantID);
	});

	meeting_mesh.onParticipantHangup(function (participantID) {
		// Someone just left the meeting. Remove the participants video
		removeRemoteVideo(participantID);
	});

	meeting_mesh.joinRoom(room);
}

function setupSfu(room) {
	let meeting_sfu = new MeetingSfu(host);

	// meeting_sfu.onLocalVideo(function () {
	// 	$("#micMenu").on("click", function callback(e) {
	// 		meeting_sfu.toggleMic();
	// 	});

	// 	$("#videoMenu").on("click", function callback(e) {
	// 		meeting_sfu.toggleVideo();
	// 	});

	// 	$("#localVideo").prop('muted', true);

	// });

	meeting_sfu.onRemoteVideo(function (participantID) {
		addRemoteVideo(null, participantID);
	});

	meeting_sfu.onParticipantHangup(function (participantID) {
		// Someone just left the meeting. Remove the participants video
		removeRemoteVideo(participantID);
	});

	meeting_sfu.joinRoom(room);
}

function addRemoteVideo(stream, participantID) {
	let $videoBox = $("<div class='videoWrap' id='" + participantID + "'></div>");
	let $video = $(`<video class='videoBox' id="video-${participantID}" autoplay></video>`);
	if (stream) {
		// $video.attr({ "src": window.URL.createObjectURL(stream), "autoplay": "autoplay" });
		$video.attr({ "srcObject": stream, "autoplay": "autoplay" });
	}
	$videoBox.append($video);
	$("#videosWrapper").append($videoBox);

	adjustVideoSize();

}

function removeRemoteVideo(participantID) {
	$("#" + participantID).remove();
	adjustVideoSize();
}

function adjustVideoSize() {
	let numOfVideos = $(".videoWrap").length;
	if (numOfVideos > 2) {
		let $container = $("#videosWrapper");
		let newWidth;
		for (let i = 1; i <= numOfVideos; i++) {
			newWidth = $container.width() / i;

			// check if we can start a new row
			let scale = newWidth / $(".videoWrap").width();
			let newHeight = $(".videoWrap").height() * scale;
			let columns = Math.ceil($container.width() / newWidth);
			let rows = numOfVideos / columns;

			if ((newHeight * rows) <= $container.height()) {
				break;
			}
		}

		let percent = (newWidth / $container.width()) * 100;
		$(".videoWrap").css("width", percent - 5 + "%");
		$(".videoWrap").css("height", "auto");


		//let numOfColumns = Math.ceil(Math.sqrt(numOfVideos));
		let numOfColumns;
		for (let i = 2; i <= numOfVideos; i++) {
			if (numOfVideos % i === 0) {
				numOfColumns = i;
				break;
			}
		}
		$('#videosWrapper').find("br").remove();
		$('.videoWrap:nth-child(' + numOfColumns + 'n)').after("<br>");
	} else if (numOfVideos == 2) {
		$(".videoWrap").width('auto');
		$("#localVideoWrap").css("width", 20 + "%");
		$('#videosWrapper').find("br").remove();
	} else {
		$("#localVideoWrap").width('auto');
		$('#videosWrapper').find("br").remove();
	}
}