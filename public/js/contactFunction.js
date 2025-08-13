import state from "./state.js";
import {
  getReplyPreviewHtml,
  getLockedMessageHtml,
  getLockedImageHtml,
  getNormalMessageHtml,
  getAudioMessageHtml,
  getMenuUi,
  getSecretchatCountDown,
  getMessageHtml,
  getNormalImageHtml,
} from "./mainFunction.js";

// import socket from "./socket.js";

window.allMessagesInChat = [];
renderPinnedMessages();
window.pinnedMessagesInChat = [];
window.handlePin = handlePin;
window.handleReply = handleReply;
window.handleDelete = handleDelete;
window.currentReply = null; // Global variable to store current reply context

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
       
      
      if (msg.deletedFor?.includes(senderId)) {
        continue; // Skip rendering for this user, but continue with other messages
      }
      const messageDiv = document.createElement("div");
      const isSent = msg.senderId === senderId;
      const deviceId = localStorage.getItem("deviceId");
      msg.encryptedMessage = msg.message;
      const encryptedKeyObj = msg.encryptedKeys?.find(
        (k) => k.deviceId === deviceId
      );
      if (
        encryptedKeyObj &&
        msg.iv &&
        msg.encryptedMessage &&
        msg.type === "text"
      ) {
        await getMessageHtml(msg, encryptedKeyObj);
      } else {
        // msg.message = "[No valid key for this device]";
      }

      messageDiv.className = `message ${
        isSent ? "sent" : "received"
      } chat-message`;

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
      if (msg.type === "image" && msg.mediaUrls && msg.mediaUrls.length > 0) {
        await getNormalImageHtml(
          msg,
          messageDiv,
          isSent,
          tickHtml,
          senderId,
          encryptedKeyObj
        );
      } else if (msg.type === "audio" && msg.audioUrl) {
        await getAudioMessageHtml(msg, messageDiv,isSent, tickHtml,senderId,encryptedKeyObj);
      } else if (msg.type === "lockedText") {
        // 🔐 Initial locked message UI
        await getLockedMessageHtml(msg, messageDiv, isSent, tickHtml, senderId);
      } else if (msg.type === "lockedImage" && msg.mediaUrls?.length === 1) {
        await getLockedImageHtml(msg, messageDiv, isSent, tickHtml, senderId);
      } else if (msg.isDeleted) {
        messageDiv.innerHTML = `<i>This message was deleted</i>`;
      } else {
        let repliedHtml = await getReplyPreviewHtml(msg.repliedTo);

        await getNormalMessageHtml(
          msg,
          messageDiv,
          isSent,
          tickHtml,
          repliedHtml
        );
      }
      // get menu Ui
      await getMenuUi(messageDiv, msg, isSent, senderId);

      if (msg._id) {
        messageDiv.id = `msg-${msg._id}`;
        messageDiv.dataset._id = msg._id;
        messageDiv.dataset.sender = msg.senderName || "Unknown";
      }
      if (append)
        messagesContainer.insertBefore(
          messageDiv,
          messagesContainer.firstChild
        );
      else messagesContainer.appendChild(messageDiv);
      if (msg.isSecretChat && msg._id && msg.expiresAt) {
        await getSecretchatCountDown(messageDiv, msg, isSent, senderId);
      }
    } // });
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
  // Update chat header if opentype: [String],
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

export async function handlePin(messageId, shouldPin) {
  try {
    const res = await fetch("/api/messages/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, pin: shouldPin }),
    });

    const data = await res.json();
     if (res.status === 404) {
      alert("Message not found in DB. Possibly not inserted yet.");
      return; // Optionally show UI feedback: "Message not found or not delivered yet"
    }

    if (data.success) {
      const updatedMsg = data.data;

      // Update pinned field in allMessagesInChat
      const index = allMessagesInChat.findIndex(
        (msg) => msg._id === updatedMsg._id
      );
      if (index !== -1) {
        allMessagesInChat[index].pinned = updatedMsg.pinned;
      }

      renderPinnedMessages();
    }
  } catch (err) {
    console.error("Error pinning message:", err);
  }
}

export async function renderPinnedMessages() {
  const pinnedContainer = document.getElementById("pinnedMessagesBar");
  pinnedContainer.innerHTML = "";

  const pinnedMessages = allMessagesInChat.filter((msg) => msg.pinned);

  if (pinnedMessages.length === 0) {
    pinnedContainer.style.display = "none";
    return;
  }

  pinnedContainer.style.display = "block";

  pinnedMessages.forEach((msg) => {
    const chip = document.createElement("div");
    chip.className = "pinned-message-chip";
    chip.innerHTML = `
      <span> ${msg.message.slice(0, 30)}...</span>
      <button class="unpin-btn"><i class="fa-solid fa-xmark"></i></button>
    `;

    chip.querySelector("span").addEventListener("click", () => {
      const target = document.getElementById(`msg-${msg._id}`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("highlight-temp");
        setTimeout(() => target.classList.remove("highlight-temp"), 2500);
      }
    });

    // Unpin on button click
    chip.querySelector(".unpin-btn").addEventListener("click", async () => {
      try {
        const res = await fetch(`/api/pin/${msg._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: false }),
        });
        const data = await res.json();

        if (data.success) {
          // Update local pinned state
          const index = allMessagesInChat.findIndex((m) => m._id === msg._id);
          if (index !== -1) allMessagesInChat[index].pinned = false;

          renderPinnedMessages();
        }
      } catch (err) {
        console.error("Error unpinning message:", err);
      }
    });

    pinnedContainer.appendChild(chip);
  });
}

/// reply message .................................

export async function handleReply(messageId) {
  const msgEl = document.getElementById(`msg-${messageId}`);
  let text = msgEl.innerText.split("\n")[0].trim(); // first line only
  let imageUrl = false;
  // Detect if this is an image message
  const imgEl = msgEl.querySelector("img");
  if (imgEl && imgEl.src) {
    text = "[Image]"; // Only show label, do not show or decrypt image
    imageUrl = true;
  }
  currentReply = {
    messageId: messageId,
    textSnippet: text.length > 100 ? text.substring(0, 100) + "..." : text,
    imageUrl: imageUrl,
  };
  // show preview in UI
  const previewBox = document.getElementById("reply-preview");
  previewBox.classList.remove("hidden-reply");
  const replyTextEl = document.getElementById("replyText");
  replyTextEl.innerText = currentReply.textSnippet;
}
document.getElementById("cancelReply").addEventListener("click", () => {
  currentReply = null;
  document.getElementById("reply-preview").classList.add("hidden-reply");
});

export async function handleDelete(messageId, scope) {
  const confirmDelete = confirm(
    scope === "everyone" ? "Delete for everyone?" : "Delete for you only?"
  );
  console.log("Confirm delete:", confirmDelete);
  if (confirmDelete) {          
    socket.emit("deleteMessage", { messageId, scope });
  }
}
