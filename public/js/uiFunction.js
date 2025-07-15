import {sendMessage} from './footer.js'
// import socket from './socket.js';

export function updateProfileSidebar(name, avatar, phone, about) {
    document.querySelector('.nav-name').textContent = name;
    document.querySelector('.nav-avatar').textContent = avatar;
    document.querySelector('.profile-name').textContent = name;
    document.querySelector('.profile-avatar').textContent = avatar;
    document.querySelector('.profile-phone').textContent = phone;
    document.querySelector('.profile-about').textContent = about;
}

// --- INPUT & SEND HANDLERS ---
export function setupInputHandlers() {
    document.querySelector('.send-button').addEventListener('click', sendMessage);
    document.querySelector('.message-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    document.querySelector('.message-input').addEventListener('input', function() {
        const senderId = localStorage.getItem('userId');
        const receiverId = window.currentReceiverId;
        if (receiverId) {
            socket.emit('typing', { senderId, receiverId });
        }
    });
}

