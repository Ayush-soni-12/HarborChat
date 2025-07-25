import state from "./state.js";
import {
  decryptMessage,
  decryptImage,
  decryptLockedMessageWithCode,
  decryptImageWithCode,
} from "../Security/decryptMessage.js";

// import socket from "./socket.js";

window.allMessagesInChat = [];
renderPinnedMessages();
window.pinnedMessagesInChat = [];
window.handlePin = handlePin;
window.handleReply = handleReply;
window.currentReply = null; // Global variable to store current reply context

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
      if (msg.encryptedKeys && msg.iv && msg.type === "text") {
        try {
          const deviceId = localStorage.getItem("deviceId");
          const keyObj = msg.encryptedKeys.find((k) => k.deviceId === deviceId);

          if (keyObj) {
            const decrypted = await decryptMessage({
              encryptedMessage: msg.message, // base64
              encryptedAESKey: keyObj.encryptedAESKey, // base64
              iv: msg.iv, // base64
            });

            msg.message = decrypted;
            allMessagesInChat.push({
              _id: msg._id,
              message: decrypted,
              timestamp: msg.timestamp,
              pinned: msg.pinned,
            });
            renderPinnedMessages();
          } else {
            msg.message = "[No key for this device]";
          }
        } catch (err) {
          console.warn("⚠️ Failed to decrypt message", err);
          msg.message = "[Decryption failed]";
        }
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
        try {
          const deviceId = localStorage.getItem("deviceId");
          const keyObj = msg.encryptedKeys.find((k) => k.deviceId === deviceId);
          if (keyObj) {
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
      } else if (msg.type === "lockedText") {
        console.log("LockedTExt message received:", msg);
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
              encryptedMessage: msg.message,
              iv: msg.iv,
              code,
            });

            if (decrypted) {
              msg._decryptedText = decrypted;

              messageDiv.innerHTML = `
            ${decrypted}
            <div class="message-time">${formatTime(
              msg.timestamp
            )} ${tickHtml}</div>
            <div class="burn-timer">🧨 Disappears in 10s</div>
          `;

              // ✅ Trigger backend TTL countdown
              if (msg._id) {
                socket.emit("start-burn", {
                  messageId: msg._id,
                  userId: senderId,
                  seconds: 10,
                });
              }

              // 🔥 Frontend burn timer
              let seconds = 10;
              const timerEl = messageDiv.querySelector(".burn-timer");
              const interval = setInterval(() => {
                seconds--;
                if (timerEl)
                  timerEl.textContent = `🧨 Disappears in ${seconds}s`;
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
      } else if (msg.type === "lockedImage" && msg.mediaUrls?.length === 1) {
        messageDiv.innerHTML = `
    <button class="unlock-btn">🔒 Locked Image. Tap to Unlock</button>
    <div class="message-time">${formatTime(msg.timestamp)} ${tickHtml}</div>
  `;

        const unlockBtn = messageDiv.querySelector(".unlock-btn");

        unlockBtn.addEventListener("click", async () => {
          const code = prompt("Enter passcode to unlock this image:");
          if (!code) return;

          try {
            const blob = await decryptImageWithCode({
              url: msg.mediaUrls[0],
              iv: msg.iv,
              code,
            });

            if (!blob) {
              alert("❌ Decryption failed.");
              return;
            }

            const imageURL = URL.createObjectURL(blob);

            messageDiv.innerHTML = `
        <img src="${imageURL}" class="chat-image" style="max-width:200px; display:block; margin-top:5px;" />
        ${
          msg.message
            ? `<div style="font-size:0.9em; color:#555; margin-top:5px;">${msg.message}</div>`
            : ""
        }
        <div class="message-time">${formatTime(msg.timestamp)} ${tickHtml}</div>
        <div class="burn-timer">🧨 Disappears in 10s</div>
      `;

            // 🔥 Trigger backend TTL countdown
            if (msg._id) {
              socket.emit("start-burn", {
                messageId: msg._id,
                userId: senderId,
                seconds: 10,
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
                messageDiv.innerHTML = `<i style="color:red;">💥 This image has burned.</i>`;
              }
            }, 1000);
          } catch (err) {
            console.error("❌ Failed to decrypt locked image:", err);
            alert("❌ Decryption failed. Invalid code or corrupted file.");
          }
        });
      } else {
        let repliedHtml = "";
        if (msg.repliedTo && msg.repliedTo.messageId) {
          let replyText =
            msg.repliedTo.textSnippet ||
            msg.repliedTo.textSnippet ||
            "";
          // Check for encrypted reply snippet (new schema)
          if (
            msg.repliedTo.textSnippet &&
            Array.isArray(msg.repliedTo.encryptedAESKeys) &&
            msg.repliedTo.iv
          ) {
            try {
              const deviceId = localStorage.getItem("deviceId");
              const keyObj = msg.repliedTo.encryptedAESKeys.find(
                (k) => k.deviceId === deviceId
              );
              if (keyObj) {
                const decryptedReply = await decryptMessage({
                  encryptedMessage: msg.repliedTo.textSnippet,
                  encryptedAESKey: keyObj.encryptedAESKey,
                  iv: msg.repliedTo.iv,
                });
                replyText = decryptedReply;
              } else {
                replyText = "[No key for this device]";
              }
            } catch (err) {
              replyText = "[Decryption Failed]";
              console.error("Failed to decrypt reply preview:", err);
            }
          }
          repliedHtml = `
      <div class="replied-preview" data-target-id="msg-${msg.repliedTo.messageId}">
        <div class="replied-text">"${replyText}"</div>
      </div>
    `;
        }

        messageDiv.innerHTML = `
            ${repliedHtml}
            ${msg.message}
            <div class="message-time">${formatTime(
              msg.timestamp
            )} ${tickHtml}</div>
                    `;
      }

      messageDiv.querySelectorAll(".replied-preview").forEach((el) => {
        el.addEventListener("click", () => {
          const targetId = el.dataset.targetId;
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
            targetEl.classList.add("highlight-temp");
            setTimeout(() => targetEl.classList.remove("highlight-temp"), 2000);
          }
        });
      });

      const menuTrigger = document.createElement("div");
      menuTrigger.className = "message-menu-trigger";
      menuTrigger.innerHTML = `<i class="fa-solid fa-ellipsis-vertical"></i>`;
      messageDiv.appendChild(menuTrigger);

      // Dropdown menu
      const actionMenu = document.createElement("div");
      actionMenu.className = "message-action-menu";
      actionMenu.innerHTML = `
    <div onclick="handlePin('${msg._id}',true)"><i class="fa-solid fa-map-pin"></i> Pin</div>
    <div onclick="handleReply('${msg._id}')"><i class="fa-solid fa-reply"></i> Reply</div>
    <div onclick="handleForward('${msg._id}')"><i class="fa-solid fa-share"></i> Forward</div>
    <div onclick="handleStar('${msg._id}')"><i class="fa-regular fa-star"></i> Star</div>
    <div onclick="handleDelete('${msg._id}')"><i class="fa-solid fa-trash"></i> Delete</div>
  `;
      messageDiv.appendChild(actionMenu);

      if (!isSent) {
        actionMenu.classList.add("left");
      } else {
        actionMenu.classList.remove("left");
      }

      // Hover behavior
      messageDiv.addEventListener("mouseenter", () => {
        menuTrigger.classList.add("visible");
      });

      messageDiv.addEventListener("mouseleave", () => {
        menuTrigger.classList.remove("visible");
        actionMenu.classList.remove("show");
      });

      // Toggle menu
      menuTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        actionMenu.classList.toggle("show");
      });

      if (msg._id) {
        messageDiv.id = `msg-${msg._id}`;
        messageDiv.dataset.messageId = msg._id;
        messageDiv.dataset.sender = msg.senderName || "Unknown";
      }
      if (append)
        messagesContainer.insertBefore(
          messageDiv,
          messagesContainer.firstChild
        );
      else messagesContainer.appendChild(messageDiv);
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
              const secretEl = document.querySelector(
                `[data-message-id='${msg._id}']`
              );
              if (secretEl) secretEl.remove();
              return;
            }

            const min = Math.floor(remaining / 60);
            const sec = (remaining % 60).toString().padStart(2, "0");
            countdownSpan.textContent = `🕒 Disappears in ${min}:${sec}`;
          }, 1000);
        } else {
          // Already expired
          const expiredEl = document.querySelector(
            `[data-message-id='${msg._id}']`
          );
          if (expiredEl) expiredEl.remove();
        }
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

export async function handlePin(messageId, shouldPin) {
  try {
    const res = await fetch("/api/messages/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, pin: shouldPin }),
    });

    const data = await res.json();
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
  const text = msgEl.innerText.split("\n")[0].trim(); // first line only

  currentReply = {
    messageId: messageId,
    textSnippet: text.length > 100 ? text.substring(0, 100) + "..." : text,
  };

  // show preview in UI
  document.getElementById("reply-preview").classList.remove("hidden-reply");
  document.getElementById("replyText").innerText = currentReply.textSnippet;
}

document.getElementById("cancelReply").addEventListener("click", () => {
  currentReply = null;
  document.getElementById("reply-preview").classList.add("hidden-reply");
});
