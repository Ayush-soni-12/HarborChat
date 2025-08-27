import {sendMessage} from './footer.js'
// import socket from './socket.js';

export function updateProfileSidebar(name, avatar) {
    document.querySelector('.nav-name').textContent = name;
    
  const avatarElement = document.querySelector('.nav-avatar');

  if (avatar && avatar.startsWith('http')) {
    avatarElement.innerHTML = `<img src="${avatar}" alt="${name}" />`;
  } else {
    avatarElement.textContent = avatar || name.charAt(0);
  }
}


export function updateGroupProfileSidebar(name, avatar, ) {
    document.querySelector('.nav-name').textContent = name;
    document.querySelector('.nav-avatar').textContent = avatar;
    // document.querySelector('.profile-name').textContent = name;
    // document.querySelector('.profile-avatar').textContent = avatar;
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


// function for unread messages

export function updateUnreadBadge(userId, count) {
  const contactItem = document.querySelector(
    `.contact-item[data-userid="${userId}"]`
  );
  if (!contactItem) return;
  let badge = contactItem.querySelector(".unread-badge");
  if (count > 0) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "unread-badge";
      contactItem.querySelector(".contact-info").appendChild(badge);
    }
    badge.textContent = count;
    badge.style.display = "";
  } else if (badge) {
    badge.style.display = "none";
  }
}

// function to move contact to top

export function moveContactToTop(userId) {
  const contactList = document.querySelector(".contact-list");
  const contactItem = contactList.querySelector(
    `.contact-item[data-userid="${userId}"]`
  );
  if (contactItem) contactList.prepend(contactItem);
}

// function to update the last message in contact list


export function updateContactLastMessage(userId, message) {
  const contactItem = document.querySelector(
    `.contact-item[data-userid="${userId}"]`
  );
  if (contactItem) {
    const lastMsgDiv = contactItem.querySelector(".contact-last-message");
    if (lastMsgDiv) lastMsgDiv.textContent = message;
  }
}

// function to update empty chat message

export function updateEmptyChatMessage() {
  const contactList = document.querySelector(".contact-list");
  const emptyChatMsg = document.getElementById("emptyChatMsg");
  if (contactList && emptyChatMsg) {
    if (contactList.querySelectorAll(".contact-item").length === 0) {
      emptyChatMsg.style.display = "";
    } else {
      emptyChatMsg.style.display = "none";
    }
  }
}