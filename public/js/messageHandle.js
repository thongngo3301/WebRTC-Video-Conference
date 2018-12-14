
const usersDB = [
    {
        userName: "x",
        participantID: "1"
    },
]

const names = [
    'Chó', 'Mèo', 'Lợn', 'Gà', 'DOGE', 'PIG', 'Chồn chồn', 'Gấu', 'Chim cánh cụt', 'Khung long', 'Tê tê', 'x'
]

getRandomName = (tmpName) => {
    const namesTmp = names.slice();
    tmpName.forEach(element => {
        namesTmp.splice(namesTmp.indexOf(element.userName), 1);
    });
    const name = namesTmp[Math.floor(Math.random() * namesTmp.length)]
    return name;
}


$(document).ready(() => {
    const socket = io.connect("https://fit5.fit-uet.tk:8443");
    // const socket = io.connect("https://localhost:8443");
    socket.emit("join");
    socket.on("new_message", data => {
        const tmp = JSON.parse(data);
        console.log(tmp);
        // const userTmp = usersDB.find(e => e.participantID === tmp.participantID);
        // console.log(userTmp);
        // if (userTmp) {
        //     tmp.userName = userTmp.userName;
        //     console.log("old");
        // } else {
        //     console.log("new");
        //     tmp.userName = getRandomName(usersDB);
        //     usersDB.push(tmp);
        // }
        $("#chat-list").append(`
        <div class="chat-message-left">
            <div class="message-container">
                <div class="message">${tmp.message}</div>
                <div class="detail">${tmp.userName} ẩn danh</div>
            </div>
        </div>`
        )
    })

    socket.on('message-data', (messages) => {
        console.log(messages);
        messages.forEach(element => {
            $("#chat-list").append(`
        <div class="chat-message-left">
            <div class="message-container">
                <div class="message">${element.message}</div>
                <div class="detail">${element.userName} ẩn danh</div>
            </div>
        </div>`
            )
        });
    })

    $('#input-message').keyup(function (e) {
        if (e.keyCode == 13) {
            const message = document.getElementById('input-message').value;
            if (message && message !== '') {
                const data = {
                    id: socket.id,
                    message: message
                }
                console.log(message);
                socket.emit("send_message", message)
                $("#chat-list").append(`<div class="chat-message-right">
        <div class="message-container">
            <div class="message">${message}</div>
        </div>
    </div>`)
                document.getElementById('input-message').value = "";
                document.getElementById('input-message').value = "";
                var e = document.getElementById("chat-list").childNodes;
                console.log(e);
                e[e.length - 1].scrollIntoView();
            }
        }
    });

    $("#chat-submit-icon").click(() => {
        const message = document.getElementById('input-message').value;
        if (message && message !== '') {
            const data = {
                id: socket.id,
                message: message
            }
            console.log(message);
            socket.emit("send_message", message)
            $("#chat-list").append(`<div class="chat-message-right">
        <div class="message-container">
            <div class="message">${message}</div>
        </div>
    </div>`)
            document.getElementById('input-message').value = "";
            var e = document.getElementById("chat-list").childNodes;
            console.log(e);
            e[e.length - 1].scrollIntoView();
        }

    })

})


