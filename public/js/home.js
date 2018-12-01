const rootURL = 'https://' + window.location.host + '/';
$(document).ready(function () {
    generateRoomUrl();
    $('#random-btn').click(function () {
        generateRoomUrl();
    });
    $('#join-btn').click(function () {
        let roomName = document.getElementById("room-url").value;
        joinRoom(roomName);
    });
    $('#room-url').keyup(function (e) {
        if (e.keyCode == 13) {
            let roomName = document.getElementById("room-url").value;
            joinRoom(roomName);
        }
    });
});

function randomUrl() {
    return ("000000" + (Math.random() * Math.pow(36, 6) << 0).toString(36)).slice(-6)
}

function generateRoomUrl() {
    let roomUrl = document.getElementById("room-url");
    roomUrl.value = randomUrl();
}

function joinRoom(roomName) {
    window.open(rootURL + roomName);
}