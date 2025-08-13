import {
  loadChatMessages,
  showOnlineDot,
  showOfflineDot,
  showToast,
} from "./contactFunction.js";
import { setupInputHandlers, updateProfileSidebar,updateUnreadBadge ,moveContactToTop,updateContactLastMessage,updateEmptyChatMessage} from "./uiFunction.js";
import state from "./state.js";
import { updateSecretChatUI, onChatSwitch } from "./footer.js";
import { getReplyPreviewHtml,
        getLockedMessageHtml,
        getLockedImageHtml,
        getNormalMessageHtml,
        getAudioMessageHtml,
        getMenuUi,
        getSecretchatCountDown,
        getMessageHtml,
        getNormalImageHtml,


} from "./mainFunction.js"

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
      allMessagesInChat = [];
      document.getElementById("chatSearchInput").value = ""; // Clear search input
      document.getElementById("searchResults").innerHTML = ""; // Clear search results

      updateSecretChatUI();
      onChatSwitch(userId);
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

let smartReplyEnabled = true;

document.getElementById("smartReplyToggle").addEventListener("change", (e) => {
  smartReplyEnabled = e.target.checked;
});

//// --- SOCKET EVENTS ---
socket.on("chat message", async (msg) => {
  clearAllSuggestions();
  const senderId = localStorage.getItem("userId");
  const deviceId = localStorage.getItem("deviceId");
  const otherUserId = msg.senderId === senderId ? msg.receiverId : msg.senderId;
  msg.encryptedMessage = msg.message;
  const encryptedKeyObj = msg.encryptedKeys?.find(
    (k) => k.deviceId === deviceId
  );
  if (encryptedKeyObj && msg.iv && msg.encryptedMessage && msg.type === "text") {

    await getMessageHtml(msg,encryptedKeyObj);
 
  } else {
    // msg.message = "[No valid key for this device]";
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
  if ( msg.receiverId === senderId && window.currentReceiverId !== msg.senderId ) {
    unreadCounts[msg.senderId] = (unreadCounts[msg.senderId] || 0) + 1;
    updateUnreadBadge(msg.senderId, unreadCounts[msg.senderId]);
  }

  if ( (msg.senderId === window.currentReceiverId &&   msg.receiverId === senderId) || (msg.senderId === senderId && msg.receiverId === window.currentReceiverId) ) {
    const messagesContainer = document.getElementById("messagesContainer");
    const messageDiv = document.createElement("div");
    const isSent = msg.senderId === senderId;
    messageDiv.className = `message ${
      isSent ? "sent" : "received"
    } chat-message`;

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
    if ( msg.type === "image" &&  msg.mediaUrls?.length &&  encryptedKeyObj &&  msg.iv) {

      await getNormalImageHtml(msg, messageDiv, isSent, tickHtml, senderId, encryptedKeyObj);


      
    } else if (msg.type === "audio" && msg.audioUrl) {

      await getAudioMessageHtml(msg, messageDiv, isSent,tickHtml,senderId,encryptedKeyObj );

    } else if (msg.type === "lockedText") {
      
      await getLockedMessageHtml(msg,messageDiv,isSent,tickHtml,senderId);

    } else if (msg.type === "lockedImage" && msg.mediaUrls?.length === 1) {

      await getLockedImageHtml(msg,messageDiv,isSent,tickHtml,senderId);

    }else if(msg.isDeleted) {
        messageDiv.innerHTML = `<i>This message was deleted</i>`;
    }
    else {
      let repliedHtml = await getReplyPreviewHtml(msg.repliedTo);

      await getNormalMessageHtml(msg,messageDiv,isSent,tickHtml,repliedHtml);

      if (smartReplyEnabled && msg.senderId !== senderId) {
        const typingIndicator = document.getElementById("ai-typing-indicator");
        if (typingIndicator) typingIndicator.classList.remove("hidden");

        console.log("Smart Reply - Incoming message text:", msg.message);

        if (msg.message && msg.message.trim().length > 1) {
          socket.emit("requestReplySuggestion", {
            messageId: msg._id,
            messageText: msg.message,
            from: msg.senderId,
            to: msg.receiverId,
          });
        }
      }
    }
    await getMenuUi(messageDiv,msg,isSent,senderId);


    if (msg._id) {
      messageDiv.id = `msg-${msg._id}`;
      messageDiv.dataset.messageId = msg._id;
      messageDiv.dataset.sender = msg.senderName || "Unknown";
    }
    messagesContainer.appendChild(messageDiv);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (msg.isSecretChat && msg._id && msg.expiresAt) {

      await getSecretchatCountDown(messageDiv,msg,isSent,senderId);

      
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

export function clearAllSuggestions() {
  document.querySelectorAll(".suggestion-box").forEach((el) => {
    el.innerHTML = "";
    // el.style.display = "none"; // Optional: hide the box
  });
}

socket.on("replySuggestions", ({ from, messageId, suggestions }) => {
  const typingIndicator = document.getElementById("ai-typing-indicator");
  if (typingIndicator) typingIndicator.classList.add("hidden");

  const suggestionContainer = document.getElementById(`suggestion`);

  const messageElem = document.createElement("div");
  messageElem.id = `suggestion-${messageId}`;
  messageElem.className = "suggestion-container";
  suggestionContainer.appendChild(messageElem);

  messageElem.innerHTML = "";

  suggestions.forEach((text) => {
    const btn = document.createElement("button");
    btn.className = "suggestion-btn";
    btn.innerText = text;

    // 👇 Fill the chat input instead of sending the message
    btn.onclick = () => {
      const inputBox = document.getElementById("textMessage"); // Replace with your actual input ID
      if (inputBox) {
        inputBox.value = text;
        inputBox.focus();
      }
      clearAllSuggestions();
    };

    messageElem.appendChild(btn);
  });
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


socket.on("messageDeletedForMe", ({ messageId }) => {
  const msgElement = document.getElementById(`msg-${messageId}`);
  if (msgElement) {
    msgElement.remove(); // or msgElement.style.display = 'none';
  }
});


socket.on("messageDeletedForEveryone", ({ messageId }) => {
  const msgElement = document.getElementById(`msg-${messageId}`);
  if (msgElement) {
    msgElement.innerHTML = `<i class="deleted-message">This message was deleted</i>`;
    msgElement.classList.add("deleted-message");
  }
});



// DOM Elements
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const callButton = document.getElementById("callBtn");
const endCallBtn = document.getElementById("endCallBtn");
const cancelCallBtn = document.getElementById("cancelCallBtn");
const startCallBtn = document.getElementById("startCallBtn");
const preCallScreen = document.getElementById("preCallScreen");
const videoCallContainer = document.getElementById("videoCallContainer");
const mainUI = document.getElementById("mainUI");
const callTimer = document.getElementById("callTimer");
const callStatusText = document.getElementById("callStatusText");

// ✅ Add this immediately after
remoteVideo.autoplay = true;
remoteVideo.playsInline = true;

localVideo.autoplay = true;
localVideo.playsInline = true;
localVideo.muted = true;


// WebRTC Variables
let peerConnection = null;
let localStream = null;
let iceCandidateBuffer = [];
let remoteUserId = null;
let isInCall = false;
let callStartTime = null;
let callInterval = null;
let preferredCameraId = null;

// State Management
let isSettingRemoteDescription = false;
let isCreatingAnswer = false;


let currentCall = {
  remoteUserId: null,
  status: 'idle' // 'idle' | 'calling' | 'ringing' | 'in-call'
};



// Configuration
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // Add TURN servers here if needed
  ]
};

// Initialize Socket.io

// Event Listeners
callButton.addEventListener("click", initiateCall);
endCallBtn.addEventListener("click", endCall);
cancelCallBtn.addEventListener("click", cancelCall);
startCallBtn.addEventListener("click", acceptCall);

// Main Functions
async function initiateCall() {
  remoteUserId = window.currentReceiverId;
  if (!remoteUserId) return alert("No contact selected");
  
  // Initialize camera selector only when starting a call
  currentCall.status = 'calling';
  showPreCallScreen("Calling...");
  startCallBtn.style.display = "none";
 

    try {
    await initCameraSelector();
     setTimeout(startCall, 300);
  } catch (err) {
    console.error("Camera selector failed:", err);
    cancelCall();
    // Continue with call anyway using default camera
  }
}

async function startCall() {
  if (isInCall) {
    alert("You're already in a call");
    return;
  }

  try {
    isInCall = true;
    localStream = await getLocalStream();
    localVideo.srcObject = localStream;
    if (!localVideo.srcObject) {
  console.warn("⚠️ localVideo not set, retrying...");
  localVideo.srcObject = localStream;
}
    // preCallScreen.style.display = "none";
    // videoCallContainer.style.display = "block";



      // Verify local stream has tracks
    if (!localStream.getTracks().length) {
      throw new Error("No media tracks available");
    }
    
    peerConnection = createPeerConnection(remoteUserId);
    localStream.getTracks().forEach(track => {
        console.log("🟢 Adding track to peerConnection on B:", track.kind);
      peerConnection.addTrack(track, localStream);
    });

        // Verify peer connection exists
    if (!peerConnection) {
      throw new Error("Peer connection not initialized");
    }



    

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("webrtc-offer", { 
      to: remoteUserId, 
      offer,
    });
    
    startCallTimer();
  } catch (err) {
    handleCallError(err);
  }
}

async function acceptCall() {
  try {
    isInCall = true;
    localStream = await getLocalStream();
    localVideo.srcObject = localStream;
    if (!localVideo.srcObject) {
  console.warn("⚠️ localVideo not set, retrying...");
  localVideo.srcObject = localStream;
}
    // Show video UI immediately for receiver
    preCallScreen.style.display = "none";
    videoCallContainer.style.display = "block";
    

    peerConnection = createPeerConnection(remoteUserId);
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    isSettingRemoteDescription = true;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(receivedOffer));
    isSettingRemoteDescription = false;

    isCreatingAnswer = true;
    const answer = await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(answer);
    console.log("📨 Answer created and set on B:", answer);
    isCreatingAnswer = false;

    socket.emit("webrtc-answer", { to: remoteUserId, answer });

    startCallTimer();
  } catch (err) {
    handleCallError(err);
  }
}

// WebRTC Core Functions
function createPeerConnection(userId) {
  const pc = new RTCPeerConnection(config);
  
  pc.onicecandidate = (event) => {
    if (event.candidate && remoteUserId) {
      socket.emit("webrtc-ice-candidate", {
        to: userId,
        candidate: event.candidate
      });
    }
  };

  // pc.ontrack = (event) => {
  //   if (!remoteVideo.srcObject && event.streams.length > 0) {
  //     remoteVideo.srcObject = event.streams[0];
  //   }
  // };

pc.ontrack = (event) => {
  console.log("👀 ontrack called on A, streams:", event.streams);

  if (!remoteVideo.srcObject && event.streams.length > 0) {
    remoteVideo.srcObject = event.streams[0];

   remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;
    console.log("✅ remoteVideo.srcObject set on A:", remoteVideo.srcObject);

    setTimeout(() => {
      const tracks = remoteVideo.srcObject?.getTracks();
      console.log("🔍 remoteVideo current stream tracks:", tracks);
    }, 1000);

    // Force playback
    remoteVideo.play().catch(err => console.warn("⚠️ remoteVideo play() failed:", err));


  }
};



  pc.onsignalingstatechange = () => {
    console.log("Signaling state:", pc.signalingState);
    if (pc.signalingState === "stable") {
      processBufferedCandidates();
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", pc.iceConnectionState);
    if (pc.iceConnectionState === "disconnected") {
      setTimeout(checkAndReconnect, 2000);
    }
  };

  return pc;
}

// Media Management
async function getLocalStream() {
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  try {
   const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user", // Front camera
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: true
});
localStream = stream;
localVideo.srcObject = localStream;


    const devices = await navigator.mediaDevices.enumerateDevices();
    // const virtualCamId = findVirtualCamera(devices);
    // console.log("🎥 Virtual Camera ID found:", virtualCamId);
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    console.log("All cameras:", videoDevices);
    
    // Try cameras in order: preferred → virtual → HD → default
    const cameraPriority = [
      preferredCameraId,
      findVirtualCamera(videoDevices),
      //  virtualCamId,
      findHighResCamera(videoDevices),
      undefined
    ];

    for (const deviceId of cameraPriority) {
      try {
        const constraints = {
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        };

        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        return localStream;
      } catch (err) {
        console.warn(`Camera ${deviceId || 'default'} failed:`, err);
        continue;
      }
    }

    throw new Error("All camera attempts failed");
  } catch (err) {
    console.error("Media access error:", err);
    throw err;
  }
}

// Device Helpers
function findVirtualCamera(devices) {
  if (!devices) return null;
  const virtualCamKeywords = ['OBS', 'Virtual', 'CamTwist', 'ManyCam','My Webcam'];
  const virtualCam = devices.find(d => 
    d.label && virtualCamKeywords.some(kw => d.label.includes(kw))
  );
  return virtualCam?.deviceId;
}

function findHighResCamera(devices) {
  const hdCam = devices.find(d => {
    const caps = d.getCapabilities?.();
    return caps?.width?.max >= 1280 || caps?.height?.max >= 720;
  });
  return hdCam?.deviceId;
}

// Signaling Handlers
let receivedOffer = null;

socket.on("webrtc-offer", async ({ from, offer }) => {



  if (isInCall) {
    socket.emit("call-rejected", { to: from });
    return;
  }

  currentCall.status = 'calling'
  remoteUserId = from;
  receivedOffer = offer;
  showPreCallScreen(`Incoming call from`);
  startCallBtn.style.display = "block";
  cancelCallBtn.textContent = "Decline";
});

socket.on("webrtc-answer", async ({ from, answer }) => {
  if (!peerConnection || peerConnection.signalingState !== "have-local-offer") {
    console.warn("Invalid state for answer:", peerConnection?.signalingState);
    return;
  }

  try {
    isSettingRemoteDescription = true;
      console.log("🧾 Received answer on A:", answer);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      currentCall.status = 'in-call';
      console.log("✅ Remote description set on A");
    isSettingRemoteDescription = false;
        // Ensure UI is in correct state for caller
    preCallScreen.style.display = "none";
    videoCallContainer.style.display = "block";
  } catch (err) {
    handleCallError(err);
    
  }
});

socket.on("webrtc-ice-candidate", async ({ from, candidate }) => {
  console.log("🌐 Received ICE candidate from", from, candidate);
  const iceCandidate = new RTCIceCandidate(candidate);
  
  if (!peerConnection || isSettingRemoteDescription || isCreatingAnswer ||
      !["stable", "have-remote-offer", "have-local-offer"].includes(peerConnection.signalingState)) {
    iceCandidateBuffer.push(iceCandidate);
    return;
  }

  try {
    await peerConnection.addIceCandidate(iceCandidate);
  } catch (err) {
    console.warn("Failed to add ICE candidate:", err);
    iceCandidateBuffer.push(iceCandidate);
  }
});

// UI Functions
function showPreCallScreen(status) {
  mainUI.style.display = "none";
  preCallScreen.style.display = "flex";
  videoCallContainer.style.display = "none";
  callStatusText.textContent = status;
}

function startCallTimer() {
  callStartTime = new Date();
  callInterval = setInterval(() => {
    const duration = Math.floor((new Date() - callStartTime) / 1000);
    const minutes = String(Math.floor(duration / 60)).padStart(2, '0');
    const seconds = String(duration % 60).padStart(2, '0');
    callTimer.textContent = `${minutes}:${seconds}`;
  }, 1000);
}

  function endCall() {

  clearInterval(callInterval);


  // if (remoteUserId && currentCall.status === 'in-call') {
  //   socket.emit('call-ended', { to: remoteUserId });
  // }

    currentCall = {
    remoteUserId: null,
    status: 'idle'
  };
  
  
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  isInCall = false;
  iceCandidateBuffer = [];
  remoteUserId = null;
  

  videoCallContainer.style.display = "none";
  preCallScreen.style.display = "none";
  mainUI.style.display = "block";
}

// Utility Functions
function processBufferedCandidates() {
  if (!peerConnection?.remoteDescription) return;

  iceCandidateBuffer = iceCandidateBuffer.filter(candidate => {
    try {
      peerConnection.addIceCandidate(candidate);
      return false;
    } catch (err) {
      console.warn("Failed to process buffered candidate:", err);
      return true;
    }
  });
}

function checkAndReconnect() {
  if (peerConnection?.iceConnectionState === "disconnected") {
    console.log("disconnected...");
    restartCallWithNewDevice();
  }
}

async function restartCallWithNewDevice() {
  endCall();
  await new Promise(resolve => setTimeout(resolve, 500));
  // startCall();
}

function handleCallError(error) {
  console.error("Call error:", error);
  alert(`Call failed: ${error.message}`);
  endCall();
}

// Initialize camera selection
// Update your initCameraSelector to handle errors gracefully:
async function initCameraSelector() {
  try {
    // First request camera access
    await navigator.mediaDevices.getUserMedia({ video: true });
    
    // Then enumerate devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === 'videoinput');
    
    // Create or update selector UI
    let selector = document.getElementById('camera-selector');
    if (!selector) {
      selector = document.createElement('select');
      selector.id = 'camera-selector';
      selector.style.margin = '10px';
      document.body.appendChild(selector);
    }
    
    selector.innerHTML = cameras.map(cam => 
      `<option value="${cam.deviceId}">${cam.label || 'Camera ' + (selector.length + 1)}</option>`
    ).join('');
    
    selector.onchange = () => {
      preferredCameraId = selector.value;
      if (isInCall) {
        restartCallWithNewDevice();
      }
    };
    
    return true;
  } catch (err) {
    console.error("Camera initialization failed:", err);
    return false;
  }
}

function cancelCall() {
  cancelCallBtn.disabled = true;
  // Close the peer connection if it exists
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }


     console.log('currentcall status' , currentCall.status)
    if (remoteUserId) {
    if (currentCall.status === 'calling') {
      console.log("calling ")
      socket.emit('call-rejected', { to: remoteUserId });
    } 
    // endCall();
  }


  // Stop and clear the local media stream
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  // Clear any buffered ICE candidates
  iceCandidateBuffer = [];

  // Notify the other user if we're the caller
  if (remoteUserId && startCallBtn.style.display === "none") {
    socket.emit("call-rejected", { to: remoteUserId });
  }


  // Reset call state
  isInCall = false;
  remoteUserId = null;

  // Reset UI elements
  preCallScreen.style.display = "none";
  mainUI.style.display = "block";
  videoCallContainer.style.display = "none";
  
  // Clear the call timer if it exists
  if (callInterval) {
    clearInterval(callInterval);
    callInterval = null;
  }

  // Reset video elements
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  setTimeout(() => cancelCallBtn.disabled = false, 1000);

  console.log("Call cancelled successfully");

}


// Add these to your existing DOM elements
const muteBtn = document.getElementById("muteBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const toggleCameraBtn = document.getElementById("toggleCameraBtn");

// Track camera state
let isFrontCamera = true;
let isMuted = false;

// Event Listeners
muteBtn.addEventListener("click", toggleMute);
fullscreenBtn.addEventListener("click", toggleFullscreen);
toggleCameraBtn.addEventListener("click", toggleCamera);

// New Functions
function toggleMute() {
  if (!localStream) return;
  
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = !isMuted;
  });
  
  muteBtn.innerHTML = isMuted 
    ? '<i class="fas fa-microphone-slash"></i>' 
    : '<i class="fas fa-microphone"></i>';
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
  } else {
    document.exitFullscreen();
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
  }
}

async function toggleCamera() {
  if (!localStream) return;
  
  isFrontCamera = !isFrontCamera;
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: isFrontCamera ? "user" : "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: true
    });
    
    // Replace video track
    const videoTrack = newStream.getVideoTracks()[0];
    const sender = peerConnection.getSenders().find(s => s.track.kind === "video");
    if (sender) sender.replaceTrack(videoTrack);
    
    // Update local video
    localStream.getVideoTracks().forEach(track => track.stop());
    localStream.removeTrack(localStream.getVideoTracks()[0]);
    localStream.addTrack(videoTrack);
    localVideo.srcObject = localStream;
    
    // Update camera icon
    toggleCameraBtn.innerHTML = isFrontCamera 
      ? '<i class="fas fa-camera-retro"></i>' 
      : '<i class="fas fa-camera"></i>';
  } catch (err) {
    console.error("Error switching camera:", err);
  }
}

// Modify cancelCall to work for both parties
// function cancelCall() {
//   if (isInCall) {
//     // Notify the other user
//     if (remoteUserId) {
//       socket.emit("call-cancelled", { to: remoteUserId });
//     }
//     endCall();
//   }
// }

// Add this to socket listeners
// socket.on('call-cancelled', (from) => {
//   if (currentCall.status === 'ringing') {
//     alert('The caller cancelled the call');
//     endCall();
//   }
// });


socket.on('call-rejected', (from) => {
  if (currentCall.status === 'calling') {
    alert('The recipient rejected your call');
    endCall();
  }
});

// socket.on('call-ended', (from) => {
//   if (currentCall.status === 'in-call') {
//     alert('The other party has ended the call');
//     endCall();
//   }
// });

// function rejectCall() {
//   if (currentCall.status === 'ringing' && remoteUserId) {
//     socket.emit('call-rejected', { to: remoteUserId });
//     endCall();
//   }
// }
