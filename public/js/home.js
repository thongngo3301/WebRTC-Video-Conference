const rootURL = 'https://' + window.location.host + '/';
$(document).ready(function () {
    generateRoomUrl();
    $('#random-btn').click(function () {
        generateRoomUrl();
    });
    $('#join-mesh-btn').click(function () {
        let roomName = document.getElementById("room-url").value;
        joinRoom('mesh', roomName);
    });
    $('#join-sfu-btn').click(function () {
        let roomName = document.getElementById("room-url").value;
        joinRoom('sfu', roomName);
    });
    $('#room-url').keyup(function (e) {
        if (e.keyCode == 13) {
            let roomName = document.getElementById("room-url").value;
            joinRoom('mesh', roomName);
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

function joinRoom(type, roomName) {
    window.open(rootURL + type + '/' + roomName);
}