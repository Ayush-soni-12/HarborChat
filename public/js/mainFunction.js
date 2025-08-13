
import {
  decryptMessage,
  decryptImage,
  decryptLockedMessageWithCode,
  decryptImageWithCode,
  decryptAudio,
} from "../Security/decryptMessage.js";

import {
  formatTime,
  renderPinnedMessages,
} from "./contactFunction.js";

// Helper to render reply preview

export async function getReplyPreviewHtml(repliedTo) {
  if (!repliedTo || !repliedTo.messageId) return "";
  if (repliedTo.imageUrl) {
    // Always show only a label for image reply, not the image tag
    return `<div class="replied-preview" data-target-id="msg-${repliedTo.messageId}"><span class="replied-image-label">[Image]</span></div>`;
  } else {
    let replyText = repliedTo.textSnippet || "";
    // Check for encrypted reply snippet (new schema)
    if (
      repliedTo.textSnippet &&
      Array.isArray(repliedTo.encryptedAESKeys) &&
      repliedTo.iv
    ) {
      try {
        const deviceId = localStorage.getItem("deviceId");
        const keyObj = repliedTo.encryptedAESKeys.find(
          (k) => k.deviceId === deviceId
        );
        if (keyObj) {
          const decryptedReply = await decryptMessage({
            encryptedMessage: repliedTo.textSnippet,
            encryptedAESKey: keyObj.encryptedAESKey,
            iv: repliedTo.iv,
          });
          replyText = decryptedReply;
          console.log('replyText', replyText);
        } else {
          replyText = "[No key for this device]";
        }
      } catch (err) {
        replyText = "[Decryption Failed]";
        console.error("Failed to decrypt reply preview:", err);
      }
    }
    return `<div class="replied-preview" data-target-id="msg-${repliedTo.messageId}"><div class="replied-text">"${replyText}"</div></div>`;
  }
}

// function for to obtain locked message

export async function getLockedMessageHtml(msg, messageDiv, isSent, tickHtml, senderId) {
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

// function for locked image

export async function getLockedImageHtml(msg, messageDiv, isSent, tickHtml, senderId) {
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
}

// function for normal message 

export async function getNormalMessageHtml(msg,messageDiv,isSent,tickHtml,repliedHtml){

          messageDiv.innerHTML = `
            ${repliedHtml}
            ${msg.message}
            <div class="message-time">${formatTime(
              msg.timestamp
            )} ${tickHtml}</div>
                    `;

}

// function for audio message

  export async function getAudioMessageHtml(msg, messageDiv, isSent, tickHtml, senderId, encryptedKeyObj) {

         try {
    // 1️⃣ Decrypt the audio
    const decryptedAudioBlob = await decryptAudio({
      encryptedAESKey: encryptedKeyObj.encryptedAESKey,
      iv: msg.iv,
      fileUrl: msg.audioUrl, // URL to the encrypted file
      mimeType: "audio/webm", // adjust if needed
    });

    if (!decryptedAudioBlob) {
      console.error("Failed to decrypt audio");
      return;
    }

    // 2️⃣ Create a Blob URL for the decrypted audio
    const audioUrl = URL.createObjectURL(decryptedAudioBlob);

    // 3️⃣ Render decrypted audio in the message div
    messageDiv.innerHTML = `
      <audio controls style="max-width:200px;">
        <source src="${audioUrl}" type="audio/webm">
        Your browser does not support the audio element.
      </audio>
      <div class="message-time">${formatTime(msg.timestamp)} ${tickHtml}</div>
    `;

  } catch (error) {
    console.error("Error rendering audio message:", error);
  }
  }

// function for menu UI inside message

export async function getMenuUi(messageDiv,msg,isSent,senderId){
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
    <div onclick="handleDelete('${msg._id}','me')"><i class="fa-solid fa-trash"></i> Delete</div>
    <div onclick="handleDelete('${msg._id}','everyone')"><i class="fa-solid fa-trash"></i> Delete</div>
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
}

// function for secret chat countdown

export async function getSecretchatCountDown(messageDiv,msg,isSent,senderId){
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

// function for get normal message

export async function getMessageHtml(msg,encryptedKeyObj){

  try {
             const decrypted = await decryptMessage({
               encryptedMessage: msg.encryptedMessage,
               encryptedAESKey: encryptedKeyObj.encryptedAESKey, // base64 string
               iv: msg.iv,
             });
       
             msg.message = decrypted; // Replace encrypted text with decrypted text
             allMessagesInChat.push({
               _id: msg._id,
               message: decrypted,
               timestamp: msg.timestamp,
               pinned: msg.pinned || false,
             }); // Store decrypted message in global array
             renderPinnedMessages();
           } catch (err) {
             console.error("🔐 Failed to decrypt message:", err);
             msg.message = "[Decryption Failed]";
           }

}

// function for get normal image

export async function getNormalImageHtml(msg, messageDiv, isSent, tickHtml, senderId, encryptedKeyObj){
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
    <img src="${
      msg.decryptedImageURL || msg.mediaUrls[0]
    }" style="max-width:200px;display:block;">
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
}