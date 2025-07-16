import {
  updateEmptyChatMessage,
  loadChatMessages,
  updateUnreadBadge,
  moveContactToTop,
  updateContactLastMessage,
  showOnlineDot,
  showOfflineDot,
  showToast,
  formatTime,
} from "./contactFunction.js";
import { setupInputHandlers, updateProfileSidebar } from "./uiFunction.js";
import state from "./state.js";
// import socket from "./socket.js";
import { decryptMessage,decryptImage,decryptLockedMessageWithCode } from "../Security/decryptMessage.js";
import { updateSecretChatUI } from "./footer.js";

// import showToast from './footer.js'

// --- GLOBAL STATE ---

const contactMap = {}; // { userId: { name, phone } }
const onlineUserIds = new Set();
// let messagesSkip = 0;
// const messagesLimit = 30;
// let allMessagesLoaded = false;
// let isLoadingMessages = false;
const unreadCounts = {}; // { userId: count }

// --- USER AUTH & INIT ---
async function getUserInfo() {
  const res = await fetch("/api/me", { method: "GET", credentials: "include" });
  const data = await res.json();
  if (data.user) {
    localStorage.setItem("userId", data.user._id);
    socket.emit("join", data.user._id);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  getUserInfo();
  document.querySelectorAll(".contact-item").forEach((contact) => {
    const userId = contact.dataset.userid;
    const name =
      contact.querySelector(".contact-name")?.textContent.trim() || "";
    const phone =
      contact.querySelector(".contact-last-msg")?.textContent.trim() || "";
    contactMap[userId] = { name, phone };
    const badge = contact.querySelector(".unread-badge");
    unreadCounts[userId] =
      badge && badge.textContent ? parseInt(badge.textContent, 10) : 0;
  });
  updateEmptyChatMessage();
  setupContactClickHandlers();
  setupInputHandlers();
});

// --- CONTACT CLICK HANDLERS ---
function setupContactClickHandlers() {
  document.querySelectorAll(".contact-item").forEach((contact) => {
    contact.addEventListener("click", async function () {
      const contactName = this.querySelector(".contact-name").textContent;
      const contactAvatar = this.querySelector(".contact-avatar").textContent;
      const contactPhone = this.querySelector(".contact-last-msg").textContent;
      const contactabout = this.querySelector(".contact-about").textContent;
      const userId = this.dataset.userid;
      console.log("Contact clicked:", userId, contactName, contactPhone);
      window.currentReceiverId = userId;
       updateSecretChatUI();
      socket.emit("chat-open", {
        userId: localStorage.getItem("userId"),
        contactId: userId,
      });
      const statusText = document.querySelector(".nav-info .user-status");
      if (statusText) {
        if (onlineUserIds.has(userId)) {
          statusText.innerText = "Online";
          statusText.style.color = "green";
        } else {
          statusText.innerText = "Offline";
          statusText.style.color = "gray";
        }
      }
      updateProfileSidebar(
        contactName,
        contactAvatar,
        contactPhone,
        contactabout
      );
      document.querySelector(".empty-chat").style.display = "none";
      document.querySelector(".chattingArea").style.display = "block";
      document.getElementById("sidebar").classList.add("active");
      document.getElementById("chatArea").classList.add("active");
      state.messagesSkip = 0;
      state.allMessagesLoaded = false;
      await loadChatMessages(false);
      unreadCounts[userId] = 0;
      updateUnreadBadge(userId, 0);
    });
  });
}

document
  .getElementById("messagesContainer")
  .addEventListener("scroll", function () {
    if (
      this.scrollTop === 0 &&
      !state.allMessagesLoaded &&
      !state.isLoadingMessages
    ) {
      loadChatMessages(true);
    }
  });

document.querySelector(".nav-avatar").addEventListener("click", function () {
  document.getElementById("userInfoOverlay").classList.add("active");
  gsap.to("#userInfoSidebar", { right: 0, duration: 0.4, ease: "power2.out" });
});

document.querySelector(".userinfo").addEventListener("click", function () {
  document.getElementById("userInfoOverlay").classList.add("active");
  gsap.to("#userInfoSidebar", { right: 0, duration: 0.4, ease: "power2.out" });
});

// Close sidebar with GSAP
document
  .getElementById("userInfoOverlay")
  .addEventListener("click", function () {
    gsap.to("#userInfoSidebar", {
      right: -400,
      duration: 0.4,
      ease: "power2.in",
    });
    document.getElementById("userInfoOverlay").classList.remove("active");
  });
// Close sidebar with GSAP
document.querySelector(".crossbtn").addEventListener("click", function () {
  gsap.to("#userInfoSidebar", {
    right: -400,
    duration: 0.4,
    ease: "power2.in",
  });
  document.getElementById("userInfoOverlay").classList.remove("active");
});

// search bar functionality

const input = document.getElementById("searchBar");
const resultBox = document.getElementById("contactList");
const emptyBox = document.getElementById("emptyChatMsg");

input.addEventListener("input", async (e) => {
  const query = e.target.value;
  try {
    const res = await fetch(
      `/api/contacts/search?query=${encodeURIComponent(query)}`,
      {
        credentials: "include", // if you're using cookies/auth
      }
    );
    const data = await res.json();
    console.log("data", data);
    resultBox.innerHTML = "";
    data.forEach((contact) => {
      const userId = contact.contactId;
      const newContact = document.createElement("div");
      newContact.className = "contact-item";
      newContact.dataset.userid = userId;
      newContact.innerHTML = `
       <div class="contact-avatar">${contact.name.charAt(0)}</div>
       <div class="contact-info">
           <div class="contact-name">${contact.name}</div>
           <div class="contact-last-msg">${contact.phone}</div>
       </div>
   `;

      newContact.addEventListener("click", async function () {
        document.querySelector(".nav-name").textContent = contact.name;
        document.querySelector(".nav-avatar").textContent =
          contact.name.charAt(0);
        window.currentReceiverId = userId;
        document.querySelector(".empty-chat").style.display = "none";
        document.querySelector(".chattingArea").style.display = "block";
        document.getElementById("sidebar").classList.add("active");
        document.getElementById("chatArea").classList.add("active");
        messagesSkip = 0;
        allMessagesLoaded = false;
        await loadChatMessages(false);
      });
      resultBox.appendChild(newContact);
    });
  } catch (err) {
    console.error("Search failed", err);
  }
});

const style = document.createElement("style");
style.textContent = `
.unread-badge {
  display: inline-block;
  min-width: 10px;
  height: 25px;
  padding: 2px 7px;
  background: #25d366;
  color: #fff;
  border-radius: 50%;
  font-size: 0.85em;
  font-weight: bold;
  text-align: center;
  margin-left: 8px;
}
`;
document.head.appendChild(style);

//// --- SOCKET EVENTS ---
socket.on("chat message",async (msg) => {
  const senderId = localStorage.getItem("userId");
  const deviceId = localStorage.getItem("deviceId");
  const otherUserId = msg.senderId === senderId ? msg.receiverId : msg.senderId;
  msg.encryptedMessage = msg.message;
  const encryptedKeyObj = msg.encryptedKeys?.find(k => k.deviceId === deviceId);
if (encryptedKeyObj && msg.iv && msg.encryptedMessage && msg.type === "text") {
    try {
      const decrypted = await decryptMessage({
        encryptedMessage: msg.encryptedMessage,
        encryptedAESKey: encryptedKeyObj.encryptedAESKey, // base64 string
        iv: msg.iv,
      });

      msg.message = decrypted; // Replace encrypted text with decrypted text
    } catch (err) {
      console.error("🔐 Failed to decrypt message:", err);
      msg.message = "[Decryption Failed]";
    }
  } else {
    msg.message = "[No valid key for this device]";
  }

  moveContactToTop(otherUserId);
  updateContactLastMessage(otherUserId, msg.message);
  if (!contactMap[otherUserId]) {
    const name = "Unknown";
    const phone = msg.senderPhone
      ? msg.senderPhone.replace(/\D/g, "").slice(-10)
      : "";

    contactMap[otherUserId] = { name, phone };

    async function unKnownUser() {
      const res = await fetch("/contacts/ajax/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
    }
    unKnownUser();

    const emptyChat = document.querySelector(".empty");
    if (emptyChat) emptyChat.style.display = "none";
    // Also show in your contact list UI
    const chatItem = document.createElement("div");
    chatItem.className = "contact-item";
    chatItem.dataset.userid = otherUserId;
    chatItem.innerHTML = `
                <div class="contact-avatar">?</div>
                <div class="contact-info">
                    <div class="contact-name">Unknown</div>
                    <div class="contact-last-msg">${msg.senderPhone}</div>
                </div>
            `;
    chatItem.addEventListener("click", async function () {
      document.querySelector(".nav-name").textContent = name;
      document.querySelector(".nav-avatar").textContent = name.charAt(0);
      window.currentReceiverId = otherUserId;

      document.querySelector(".empty-chat").style.display = "none";
      document.querySelector(".chattingArea").style.display = "block";

      document.getElementById("sidebar").classList.add("active");
      document.getElementById("chatArea").classList.add("active");

      await loadChatMessages();
    });

    document.querySelector(".contact-list").appendChild(chatItem);
    updateEmptyChatMessage();
  }

  // --- Unread badge logic for real-time updates ---
  // If this is a received message and the chat is NOT open, increment unread count
  if (
    msg.receiverId === senderId &&
    window.currentReceiverId !== msg.senderId
  ) {
    unreadCounts[msg.senderId] = (unreadCounts[msg.senderId] || 0) + 1;
    updateUnreadBadge(msg.senderId, unreadCounts[msg.senderId]);
  }

  if (
    (msg.senderId === window.currentReceiverId &&
      msg.receiverId === senderId) ||
    (msg.senderId === senderId && msg.receiverId === window.currentReceiverId)
  ) {
    const messagesContainer = document.getElementById("messagesContainer");
    const messageDiv = document.createElement("div");
    const isSent = msg.senderId === senderId;
    messageDiv.className = `message ${isSent ? "sent" : "received"}`;
    let tickHtml = "";
    if (isSent) {
      if (msg.status === "sent") {
        tickHtml = '<span class="tick-icon">✔️</span>';
      } else if (msg.status === "delivered") {
        tickHtml = '<span class="tick-icon">✔✔️</span>';
      } else if (msg.status === "read") {
        tickHtml = '<span class="tick-icon" style="color: #34B7F1">✔✔️</span>';
      }
    }

    // For image message
if (msg.type === "image" && msg.mediaUrls?.length && encryptedKeyObj && msg.iv) {
  try {
    const blob = await decryptImage({
      encryptedAESKey: encryptedKeyObj.encryptedAESKey,
      iv: msg.iv,
      fileUrl: msg.mediaUrls[0],
    });
      if (blob) {
      msg.decryptedImageURL = URL.createObjectURL(blob); // Temporary URL
    } else {
      msg.decryptedImageURL = null;
    }
      } catch (err) {
    console.error("🔐 Failed to decrypt image:", err);
    msg.decryptedImageURL = null;
  }
      messageDiv.innerHTML = `
  <img src="${msg.decryptedImageURL || msg.mediaUrls[0]}" style="max-width:200px;display:block;">
    <div class="message-time">${formatTime(msg.timestamp)} ${tickHtml}</div>
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
    <div class="message-time">${formatTime(msg.timestamp)} ${tickHtml}</div>
  `;
    }
else if (msg.type === "lockedText") {
    // 🔐 Initial locked message UI
    messageDiv.innerHTML = `
      <button class="unlock-btn">🔒 Locked Message. Tap to Unlock</button>
      <div class="message-time">${formatTime(msg.timestamp)} ${tickHtml}</div>
    `;

    // ✅ Define unlockBtn AFTER it exists in DOM
    const unlockBtn = messageDiv.querySelector(".unlock-btn");

    unlockBtn.addEventListener("click", async () => {
      const code = prompt("Enter passcode to unlock this message:");
      if (!code) return;

      try {
        const decrypted = await decryptLockedMessageWithCode({
          encryptedMessage: msg.encryptedMessage,
          iv: msg.iv,
          code
        });

        if (decrypted) {
          msg._decryptedText = decrypted;

          messageDiv.innerHTML = `
            ${decrypted}
            <div class="message-time">${formatTime(msg.timestamp)} ${tickHtml}</div>
            <div class="burn-timer">🧨 Disappears in 10s</div>
          `;

          // ✅ Trigger backend TTL countdown
          if (msg._id) {
            socket.emit("start-burn", {
              messageId: msg._id,
               userId: senderId,
              seconds: 10
            });
          }

          // 🔥 Frontend burn timer
          let seconds = 10;
          const timerEl = messageDiv.querySelector(".burn-timer");
          const interval = setInterval(() => {
            seconds--;
            if (timerEl) timerEl.textContent = `🧨 Disappears in ${seconds}s`;
            if (seconds <= 0) {
              clearInterval(interval);
              messageDiv.innerHTML = `<i style="color:red;">💥 This message has burned.</i>`;
              delete msg._decryptedText;
            }
          }, 1000);
        } else {
          alert("❌ Incorrect code or message can't be unlocked.");
        }
      } catch (err) {
        console.error("❌ Failed to decrypt locked message:", err);
        alert("❌ Decryption error.");
      }
    });
  
}

  
    else {
      messageDiv.innerHTML = `
    ${msg.message}
    <div class="message-time">${formatTime(msg.timestamp)} ${tickHtml}</div>
  `;
    }
    if (msg._id) messageDiv.dataset.messageId = msg._id;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

if (msg.isSecretChat && msg._id && msg.expiresAt) {
  const timeLeft = msg.expiresAt - Date.now();

  if (timeLeft > 0) {
    const countdownSpan = document.createElement("span");
    countdownSpan.className = "countdown-timer";
    countdownSpan.style.display = "block";
    countdownSpan.textContent = `🕒 Disappears in 1:00`;
    messageDiv.appendChild(countdownSpan);

    let remaining = Math.floor(timeLeft / 1000);
    const intervalId = setInterval(() => {
      remaining--;

      if (remaining <= 0) {
        clearInterval(intervalId);
        const secretEl = document.querySelector(`[data-message-id='${msg._id}']`);
        if (secretEl) secretEl.remove();
        return;
      }

      const min = Math.floor(remaining / 60);
      const sec = (remaining % 60).toString().padStart(2, "0");
      countdownSpan.textContent = `🕒 Disappears in ${min}:${sec}`;
    }, 1000);
  } else {
    // Already expired
    const expiredEl = document.querySelector(`[data-message-id='${msg._id}']`);
    if (expiredEl) expiredEl.remove();
  }
}

    // If this is a received message and the chat is open, emit read immediately
    if (!isSent && msg.status !== "read" && msg._id) {
      const receiverId = window.currentReceiverId;
      socket.emit("message-read", {
        messageIds: [msg._id],
        readerId: senderId,
        receiverId,
      });
      // --- Reset unread count for this contact since chat is open ---
      unreadCounts[msg.senderId] = 0;
      updateUnreadBadge(msg.senderId, 0);
    }
  }

  // Play notification sound if message is for this user and chat is not open or window not focused
  if (
    msg.receiverId === senderId &&
    window.currentReceiverId !== msg.senderId &&
    document.visibilityState !== "visible"
  ) {
    playNotificationSound();
  }
});

// Listen for message-delivered event to update tick to double tick in real time
socket.on("message-delivered", ({ messageId }) => {
    console.log("✅ Message delivered for ID:", messageId);
  const messagesContainer = document.getElementById("messagesContainer");
  if (!messagesContainer) return;
  const msgDiv = messagesContainer.querySelector(
    `[data-message-id='${messageId}'] .message-time .tick-icon`
  );
  if (msgDiv) {
    msgDiv.innerHTML = "✔✔️";
    msgDiv.style.color = "";
  }
});

// Listen for message-read event to update ticks in UI
socket.on("message-read", ({ messageIds, readerId }) => {
  const messagesContainer = document.getElementById("messagesContainer");
  if (!messagesContainer) return;
  if (Array.isArray(messageIds)) {
    messageIds.forEach((id) => {
      const msgDiv = messagesContainer.querySelector(
        `[data-message-id='${id}'] .message-time .tick-icon`
      );
      if (msgDiv) {
        msgDiv.innerHTML = "✔✔️";
        msgDiv.style.color = "#34B7F1";
      }
    });
  }
});

socket.on("user-online", (userId) => {
  onlineUserIds.add(userId);
  console.log("hijo");
  console.log(onlineUserIds);
  console.log("User online event received for:", userId);
  showOnlineDot(userId);
});
socket.on("user-offline", (userId) => {
  onlineUserIds.delete(userId);
  console.log("User offline event received for:", userId);
  showOfflineDot(userId);
});
socket.on("online-contacts", (onlineContactIds) => {
  // Clear and repopulate the onlineUserIds set
  onlineUserIds.clear();
  onlineContactIds.forEach((id) => onlineUserIds.add(id));
  // Update status for all contacts in the list
  document.querySelectorAll(".contact-item").forEach((contact) => {
    const uid = contact.dataset.userid;
    const statusText = contact.querySelector(".user-status");
    if (onlineUserIds.has(uid)) {
      if (statusText) {
        statusText.innerText = "Online";
        statusText.style.color = "green";
      }
    } else {
      if (statusText) {
        statusText.innerText = "Offline";
        statusText.style.color = "gray";
      }
    }
  });
  // Also update the chat header if a chat is open
  if (window.currentReceiverId) {
    const statusText = document.querySelector(".nav-info .user-status");
    if (statusText) {
      if (onlineUserIds.has(window.currentReceiverId)) {
        statusText.innerText = "Online";
        statusText.style.color = "green";
      } else {
        statusText.innerText = "Offline";
        statusText.style.color = "gray";
      }
    }
  }
});

// Listen for unread-counts and update badges on refresh
socket.on("unread-counts", (unreadCountsObj) => {
  Object.entries(unreadCountsObj).forEach(([userId, count]) => {
    unreadCounts[userId] = count; // update local state
    updateUnreadBadge(userId, count);
  });
});

socket.on("typing", (senderId) => {
  // Only show typing if this is the current chat
  if (window.currentReceiverId === senderId) {
    const statusText = document.querySelector(".nav-info .user-status");
    if (statusText) {
      statusText.innerText = "Typing...";
      statusText.style.color = "blue";
      // Optionally, revert to online/offline after a short delay
      clearTimeout(window.typingTimeout);
      window.typingTimeout = setTimeout(() => {
        if (onlineUserIds.has(senderId)) {
          statusText.innerText = "Online";
          statusText.style.color = "green";
        } else {
          statusText.innerText = "Offline";
          statusText.style.color = "gray";
        }
      }, 1500); // 1.5 seconds after last typing event
    }
  }
});

// notification

socket.on("notify-new-message", ({ from, message, type }) => {
  playNotificationSound();

  if (type === "image") {
    showToast(`🖼️ New image from ${from}`);
  } else if (type === "audio") {
    showToast(`🎤 New audio message from ${from}`);
  } else {
    showToast(`💬 New message from ${from}: ${message}`);
  }
});

// --- Notification Sound ---
const notificationAudio = new Audio("/sounds/notification.wav");

function playNotificationSound() {
  try {
    notificationAudio.currentTime = 0;
    notificationAudio.play();
  } catch (e) {
    // Ignore autoplay errors
  }
}
