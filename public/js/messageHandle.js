document.getElementById('chat-submit-icon').addEventListener('click', () => {
    document.getElementById('chat-submit-icon').appendChild(`<div class="chat-message-right">
    <div class="message-container">
        <div class="message">what the fuck r u doing !????? hehehe</div>
    </div>
</div>`);
    console.log("aaa");
    let element = document.getElementById("chat-list");
    element.crollTop = element.scrollHeight;
})

