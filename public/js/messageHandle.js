
const socket = io("http://localhost:3001");

socket.emit("join");
console.log(socket);

socket.on("recieve-message", data => {
    $("#chat-list").append(`
        <div class="chat-message-left">
            <div class="message-container">
                <div class="message">${data.message}</div>
                <div class="detail">${data.userName} ẩn danh</div>
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


$("#chat-submit-icon").click(() => {
    const message = document.getElementById('input-message').value;
    if (message && message !== '') {
        const data = {
            id: socket.id,
            message: message
        }
        console.log(message);
        socket.emit("send-message", data)
        $("#chat-list").append(`<div class="chat-message-right">
        <div class="message-container">
            <div class="message">${message}</div>
        </div>
    </div>`)
    }

})
