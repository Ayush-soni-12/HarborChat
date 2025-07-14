import state from "./state.js";
import { decryptMessage,decryptImage } from "../Security/decryptMessage.js";
// import socket from "./socket.js";

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

export function moveContactToTop(userId) {
  const contactList = document.querySelector(".contact-list");
  const contactItem = contactList.querySelector(
    `.contact-item[data-userid="${userId}"]`
  );
  if (contactItem) contactList.prepend(contactItem);
}

export function updateContactLastMessage(userId, message) {
  const contactItem = document.querySelector(
    `.contact-item[data-userid="${userId}"]`
  );
  if (contactItem) {
    const lastMsgDiv = contactItem.querySelector(".contact-last-message");
    if (lastMsgDiv) lastMsgDiv.textContent = message;
  }
}

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

// --- LOAD CHAT MESSAGES ---
export async function loadChatMessages(append = false) {
  if (state.isLoadingMessages || state.allMessagesLoaded) return;
  state.isLoadingMessages = true;
  document.getElementById("loader").style.display = "block";
  await new Promise((resolve) => setTimeout(resolve, 100));
  const senderId = localStorage.getItem("userId");
  const receiverId = window.currentReceiverId;
  const messagesContainer = document.getElementById("messagesContainer");
  if (!append) {
    state.messagesSkip = 0;
    state.allMessagesLoaded = false;
    messagesContainer.innerHTML = "";
  }
  try {
    const res = await fetch(
      `/api/messages/${receiverId}?skip=${state.messagesSkip}&limit=${state.messagesLimit}`,
      {
        method: "GET",
        credentials: "include",
      }
    );
    const data = await res.json();
    const oldScrollHeight = messagesContainer.scrollHeight;
    if (data.messages.length < state.messagesLimit)
      state.allMessagesLoaded = true;
    state.messagesSkip += data.messages.length;
    // Collect unread received message IDs
    const unreadReceivedIds = [];
    data.messages.forEach((msg) => {
      const isSent = msg.senderId === senderId;
      if (!isSent && msg.status !== "read" && msg._id) {
        unreadReceivedIds.push(msg._id);
      }
    });
    if (unreadReceivedIds.length > 0) {
      socket.emit("message-read", {
        messageIds: unreadReceivedIds,
        readerId: senderId,
        receiverId: window.currentReceiverId,
      });
    }
    // Render messages


    for (const msg of data.messages) {
    // data.messages.forEach((msg) => {
      const messageDiv = document.createElement("div");
      const isSent = msg.senderId === senderId;
 if (msg.encryptedKeys && msg.iv && msg.type==="text") {
    try {
      const deviceId = localStorage.getItem("deviceId");
      const keyObj = msg.encryptedKeys.find(k => k.deviceId === deviceId);

      if (keyObj) {
        const decrypted = await decryptMessage({
          encryptedMessage: msg.message, // base64
          encryptedAESKey: keyObj.encryptedAESKey, // base64
          iv: msg.iv, // base64
        });

        msg.message = decrypted;
      } else {
        msg.message = "[No key for this device]";
      }
    } catch (err) {
      console.warn("⚠️ Failed to decrypt message", err);
      msg.message = "[Decryption failed]";
    }
  }
      messageDiv.className = `message ${isSent ? "sent" : "received"}`;
      let tickHtml = "";
      if (isSent) {
        if (msg.status === "sent")
          tickHtml = '<span class="tick-icon">✔️</span>';
        else if (msg.status === "delivered")
          tickHtml = '<span class="tick-icon">✔✔️</span>';
        else if (msg.status === "read")
          tickHtml =
            '<span class="tick-icon" style="color: #34B7F1">✔✔️</span>';
      }
      // --- Fix: Render image/audio if message is an image or audio ---
      if (msg.type === "image" && msg.mediaUrls && msg.mediaUrls.length > 0 ) {
        try {
          const deviceId = localStorage.getItem("deviceId");
          const keyObj = msg.encryptedKeys.find(k => k.deviceId === deviceId);
          if(keyObj){
          const blob = await decryptImage({
            encryptedAESKey: keyObj.encryptedAESKey,
            iv: msg.iv,
            fileUrl: msg.mediaUrls[0],
           
          });
           msg.decryptedImageURL = blob ? URL.createObjectURL(blob) : null;
        } else {
        msg.message = "[No key for this device]";
        }
         
        } catch (err) {
          console.warn("⚠️ Failed to decrypt image blob", err);
          msg.decryptedImageURL = null;
        }
        messageDiv.innerHTML = `
            <img src="${
              msg.decryptedImageURL
            }" style="max-width:200px;display:block;">
            <div class="message-time">${formatTime(
              msg.timestamp
            )} ${tickHtml}</div>
        `;
        if (msg.message && msg.message.trim() !== "") {
          const captionEl = document.createElement("div");
          captionEl.innerText = msg.message;
          captionEl.style.fontSize = "0.9em";
          captionEl.style.marginTop = "5px";
          captionEl.style.color = "#555";
          messageDiv.insertBefore(
            captionEl,
            messageDiv.querySelector(".message-time")
          );
        }
      } else if (msg.type === "audio" && msg.audioUrl) {
        messageDiv.innerHTML = `
            <audio controls style="max-width:200px;">
                <source src="${msg.audioUrl}" type="audio/webm">
                Your browser does not support the audio element.
            </audio>
            <div class="message-time">${formatTime(
              msg.timestamp
            )} ${tickHtml}</div>
        `;
      } else {
        messageDiv.innerHTML = `
            ${msg.message}
            <div class="message-time">${formatTime(
              msg.timestamp
            )} ${tickHtml}</div>
        `;
      }
      if (msg._id) messageDiv.dataset.messageId = msg._id;
      if (append)
        messagesContainer.insertBefore(
          messageDiv,
          messagesContainer.firstChild
        );
      else messagesContainer.appendChild(messageDiv);
      if (msg.isSecretChat && msg._id) {
         setTimeout(() => {
          const el = document.querySelector(`[data-message-id='${msg._id}']`);
          if (el) el.remove();
        }, 60000);
      }
      
      }// });
    if (!append) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    else
      messagesContainer.scrollTop =
        messagesContainer.scrollHeight - oldScrollHeight;
  } catch (err) {
    console.error("Failed to load messages:", err);
  }
  state.isLoadingMessages = false;
  document.getElementById("loader").style.display = "none";
}

export function showOnlineDot(userId) {
  // Update chat header if open
  if (window.currentReceiverId === userId) {
    const statusText = document.querySelector(".nav-info .user-status");
    console.log("receverId", window.currentReceiverId);
    console.log("Hello world", statusText);
    if (statusText) {
      statusText.innerText = "Online";
      statusText.style.color = "green";
    }
  }
}

export function showOfflineDot(userId) {
  // Update chat header if open
  if (window.currentReceiverId === userId) {
    const statusText = document.querySelector(".nav-info .user-status");
    if (statusText) {
      statusText.innerText = "Offline";
      statusText.style.color = "gray";
    }
  }
}
// --- TOAST NOTIFICATION ---
export function showToast(message) {
  const toast = document.getElementById("toastNotification");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

export function getCurrentTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function formatTime(timestamp) {
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}
