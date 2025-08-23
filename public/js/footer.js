import { loadChatMessages } from "./contactFunction.js";
import { updateEmptyChatMessage, moveContactToTop } from "./uiFunction.js";
import { showToast } from "./contactFunction.js";
import state from "./state.js";
// import socket from "./socket.js";
import {
  sendEncryptedMessage,
  sendEncryptedImage,
  sendMultipleEncryptedImages,
  encryptMessageWithCode,
  encryptImageWithCode,
  sendEncryptaudio,
} from "../Security/encryptAeskey.js";
import { clearAllSuggestions } from "./main.js";

// --- ADD CONTACT FORM SUBMISSION ---
document
  .getElementById("addContactForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    const name = document.getElementById("contactName").value.trim();
    const phone = document.getElementById("contactPhone").value.trim();
    try {
      const res = await fetch("/contacts/ajax/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const result = await res.json();
      if (res.ok) {
        const contactList = document.getElementById("contactList");
        const emptyState = document.getElementById("emptyChatMsg");
        if (emptyState) emptyState.style.display = "none";
        const userId = result.contactId;
        const newContact = document.createElement("div");
        newContact.className = "contact-item";
        newContact.dataset.userid = userId;
        newContact.innerHTML = `
                <div class="contact-avatar">${name.charAt(0)}</div>
                <div class="contact-info">
                    <div class="contact-name">${name}</div>
                    <div class="contact-last-msg">${phone}</div>
                </div>
            `;
        // Add click event to open chat
        newContact.addEventListener("click", async function () {
          document.querySelector(".nav-name").textContent = name;
          document.querySelector(".nav-avatar").textContent = name.charAt(0);
          window.currentReceiverId = userId;
          document.querySelector(".empty-chat").style.display = "none";
          document.querySelector(".chattingArea").style.display = "block";
          document.getElementById("sidebar").classList.add("active");
          document.getElementById("chatArea").classList.add("active");
          state.messagesSkip = 0;
          state.allMessagesLoaded = false;
          await loadChatMessages(false);
        });
        contactList.appendChild(newContact);
        updateEmptyChatMessage();
        // Reset form and close modal
        e.target.reset();
        bootstrap.Modal.getInstance(
          document.getElementById("addContactModal")
        ).hide();
        // Show success notification
        showToast("Contact added successfully");
      } else {
        alert(result.message || "Something went wrong.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add contact.");
    }
  });

// --- EMOJI PICKER LOGIC ---
const emojiButton = document.getElementById("emoji-button");
const emojiPicker = document.getElementById("emoji-picker");
const chatInput = document.querySelector(".message-input");
// Toggle the emoji picker
emojiButton.addEventListener("click", () => {
  emojiPicker.style.display =
    emojiPicker.style.display === "none" ? "block" : "none";
});
// Insert emoji into the textarea
emojiPicker.addEventListener("emoji-click", (event) => {
  const emoji = event.detail.unicode;
  chatInput.value += emoji;
});
// Hide emoji picker when clicking outside
document.addEventListener("click", (e) => {
  if (!emojiPicker.contains(e.target) && e.target !== emojiButton) {
    emojiPicker.style.display = "none";
  }
});

// paperclip button

const imageInput = document.getElementById("imageInput");
const fileNameSpan = document.getElementById("fileName");
const paperclipBtn = document.getElementById("paperclip-btn");

const imageModal = document.getElementById("imageEditModal");
const imageToEdit = document.getElementById("imageToEdit");

let fileToCrop = null; // Used for editing

// Open file picker on paperclip click
paperclipBtn.addEventListener("click", () => {
  imageInput.value = "";
  imageInput.click();
});

// Handle file input
imageInput.addEventListener("change", () => {
  const files = Array.from(imageInput.files);
  console.log("Selected files:", files, "Count:", files.length);

  if (files.length === 1) {
    fileNameSpan.innerText = files[0].name;
    fileToCrop = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      imageToEdit.src = reader.result;
      imageModal.classList.add("active"); // Use class for WhatsApp-style modal
      if (cropper) cropper.destroy();
      cropper = new Cropper(imageToEdit, {
        aspectRatio: NaN,
        viewMode: 1,
        autoCropArea: 1,
        movable: true,
        cropBoxResizable: true,
      });
    };
    reader.readAsDataURL(fileToCrop);
  } else if (files.length > 1) {
    fileNameSpan.innerText = files.map((file) => file.name).join(", ");
    // Do NOT open the crop modal for multiple images
  } else {
    fileNameSpan.innerText = "";
  }
});

// drawing

let fabricCanvas = null;
let cropper = null;

document.addEventListener("DOMContentLoaded", function () {
  const imageEditModal = document.getElementById("imageEditModal");
  const editModalContent = imageEditModal.querySelector(".edit-modal-content");

  // Draw button logic
  document.getElementById("drawButton").addEventListener("click", function () {
    if (!cropper) {
      console.error("Cropper not initialized");
      return;
    }

    const canvas = cropper.getCroppedCanvas();
    if (!canvas) {
      console.error("Could not get cropped canvas");
      return;
    }

    const dataURL = canvas.toDataURL("image/png");
    const fabricCanvasEl = document.getElementById("fabricCanvas");
    const fabricControls = document.getElementById("fabricControls");

    // Show canvas and controls
    fabricCanvasEl.style.display = "block";
    fabricControls.style.display = "flex";

    // Dispose old canvas if exists
    if (fabricCanvas) {
      fabricCanvas.dispose();
      fabricCanvas = null;
      // Remove old canvas element and add a new one
      const newCanvas = fabricCanvasEl.cloneNode(false);
      fabricCanvasEl.parentNode.replaceChild(newCanvas, fabricCanvasEl);
    }
    const freshCanvasEl = document.getElementById("fabricCanvas");
    freshCanvasEl.style.display = "block";
    fabricControls.style.display = "flex";

    // Initialize fabric canvas
    fabricCanvas = new fabric.Canvas("fabricCanvas");
    fabricCanvas.isDrawingMode = true;

    // Set brush options
    updateFabricBrush();

    // Load image as background
    fabric.Image.fromURL(dataURL, function (img) {
      const scaleX = fabricCanvas.width / img.width;
      const scaleY = fabricCanvas.height / img.height;
      const scale = Math.min(scaleX, scaleY);

      fabricCanvas.setBackgroundImage(
        img,
        function () {
          fabricCanvas.renderAll();
        },
        {
          scaleX: scale,
          scaleY: scale,
          originX: "left",
          originY: "top",
        }
      );
    });

    // Ensure modal is scrollable
    setTimeout(() => {
      editModalContent.scrollTo({
        top: editModalContent.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  });

  // Update fabric brush settings
  function updateFabricBrush() {
    if (!fabricCanvas) return;

    const brushColor = document.getElementById("fabricColor").value;
    const brushSize = parseInt(
      document.getElementById("fabricBrushSize").value
    );

    fabricCanvas.freeDrawingBrush.width = brushSize;
    fabricCanvas.freeDrawingBrush.color = brushColor;
  }

  // Color picker
  document
    .getElementById("fabricColor")
    .addEventListener("change", updateFabricBrush);

  // Brush size
  document
    .getElementById("fabricBrushSize")
    .addEventListener("input", updateFabricBrush);

  // Clear drawing
  document.getElementById("fabricClear").addEventListener("click", function () {
    if (fabricCanvas) {
      fabricCanvas.clear();
      // Reapply background image if exists
      if (fabricCanvas.backgroundImage) {
        fabricCanvas.renderAll();
      }
    }
  });

  function dataURLToBlob(dataURL) {
    const parts = dataURL.split(",");
    const byteString = atob(parts[1]);
    const mimeType = parts[0].match(/:(.*?);/)[1];

    const arrayBuffer = new ArrayBuffer(byteString.length);
    const intArray = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      intArray[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: mimeType });
  }

  // Crop and send single image
  document
    .getElementById("cropButton")
    .addEventListener("click", async function () {
      const senderId = localStorage.getItem("userId");
      const receiverId = window.currentReceiverId;
      const caption = document.getElementById("imageCaption").value.trim();
      const isLocked = document.querySelector("#lock-toggle").checked;

      if (!receiverId) {
        alert("Please select a user to chat with");
        return;
      }

      let finalImage;
      const fabricCanvasEl = document.getElementById("fabricCanvas");

      try {
        if (
          fabricCanvas &&
          fabricCanvasEl &&
          fabricCanvasEl.style.display !== "none"
        ) {
          finalImage = fabricCanvas.toDataURL({ format: "png" });
        } else if (cropper) {
          const canvas = cropper.getCroppedCanvas();
          if (!canvas) {
            alert("Could not get cropped image.");
            return;
          }
          finalImage = canvas.toDataURL("image/png");
        } else {
          alert("No image data available.");
          return;
        }

        const imageBlob = dataURLToBlob(finalImage);
        const isSecretChat = secretChatMap[receiverId] || false;
        console.log("Secretmessage:", isSecretChat);

        if (isLocked) {
          const code = prompt("Enter a secret code to lock this message:");
          await encryptImageWithCode(
            senderId,
            receiverId,
            imageBlob,
            caption,
            isSecretChat,
            code
          );
          moveContactToTop(receiverId);
        } else {
          await sendEncryptedImage(
            senderId,
            receiverId,
            imageBlob,
            caption,
            isSecretChat
          );
          moveContactToTop(receiverId);
        }

        // Emit the image message
        // socket.emit("image-message", {
        //   senderId,
        //   receiverId,
        //   image: finalImage,
        //   caption,
        // });

        resetEditor();
      } catch (error) {
        console.error("Error processing image:", error);
        alert("Error processing image. Please try again.");
      }
    });

  // Cancel cropping
  document.getElementById("cancelEdit").addEventListener("click", resetEditor);

  // Reset editor function
  function resetEditor() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }

    imageEditModal.classList.remove("active");
    document.getElementById("imageCaption").value = "";

    const fabricCanvasEl = document.getElementById("fabricCanvas");
    const fabricControls = document.getElementById("fabricControls");

    fabricCanvasEl.style.display = "none";
    fabricControls.style.display = "none";

    if (fabricCanvas) {
      fabricCanvas.dispose();
      fabricCanvas = null;
    }
    fileNameSpan.innerText = "";
  }
});

// let isSecretChat = false;
// let burnAfterRead = false;
const secretChatMap = {}; // { [receiverId]: true/false }
const burnAfterMap = {};
let secretChatTimer = null;
const secretChatTimeout = 5 * 60 * 1000; // 5 minutes
let secretCountdownInterval;

document.getElementById("startSecretChat").addEventListener("click", () => {
  const receiverId = window.currentReceiverId;
  if (!receiverId) return;
  if (burnAfterMap[receiverId]) {
    alert("❌ Burn After Read is active. Disable it first.");
    return;
  }

  if (secretChatMap[receiverId]) {
    // 🔴 Already active — end secret chat for this receiver
    endSecretChat(receiverId);
  } else {
    // 🟢 Start new secret chat
    secretChatMap[receiverId] = true;
    document.getElementById("secretStatus").style.display = "block";
    burnToggle.checked = false;
    burnAfterMap[receiverId] = false;

    startSecretCountdown(secretChatTimeout); // optional

    secretChatTimer = setTimeout(() => {
      endSecretChat(receiverId);
    }, secretChatTimeout);
  }
});

function endSecretChat(receiverId) {
  if (!receiverId) return;

  secretChatMap[receiverId] = false;
  document.getElementById("secretStatus").style.display = "none";

  clearInterval(secretCountdownInterval);
  clearTimeout(secretChatTimer);
}

function startSecretCountdown(duration) {
  let remaining = duration / 1000;
  const timerEl = document.getElementById("secretTimer");

  secretCountdownInterval = setInterval(() => {
    const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
    const secs = String(remaining % 60).padStart(2, "0");
    timerEl.textContent = `${mins}:${secs}`;
    if (remaining-- <= 0) clearInterval(secretCountdownInterval);
  }, 1000);
}

const burnToggle = document.getElementById("lock-toggle");
burnToggle.addEventListener("change", () => {
  const receiverId = window.currentReceiverId;
  if (!receiverId) return;
  const isChecked = burnToggle.checked;

  // ❌ Prevent if secret chat is active
  if (isChecked && secretChatMap[receiverId]) {
    alert("❌ Cannot enable Burn After Read while Secret Chat is active.");
    burnToggle.checked = false; // revert
    return;
  }
  burnAfterMap[receiverId] = isChecked;
  console.log(
    `${
      isChecked ? "🔥 Burn After Enabled" : "🧯 Burn After Disabled"
    } for ${receiverId}`
  );
});

export async function onChatSwitch(newReceiverId) {
  window.currentReceiverId = newReceiverId;

  // Restore Burn checkbox based on map
  const isBurnOn = burnAfterMap[newReceiverId] || false;
  burnToggle.checked = isBurnOn;

  // (optional) Restore secret chat state too
}

// Main sendMessage handler
export async function sendMessage() {
  const input = document.querySelector(".message-input");
  const imageInput = document.getElementById("imageInput");
  const fileNameSpan = document.getElementById("fileName");
  const isLocked = document.querySelector("#lock-toggle").checked;
  const selectedLang = document.getElementById("languageSelector").value;
  // const files = Array.from(imageInput.files);
  const files = imageInput.files;
  let message = input.value.trim();
  const senderId = localStorage.getItem("userId");
  const receiverId = window.currentReceiverId;
  const isSecretChat = secretChatMap[receiverId] || false;
  console.log("Secretmessage:", isSecretChat);

  if (!message && files.length === 0 && !recordedAudioBlob) return;
  if (!receiverId) {
    alert("Select a user to chat with");
    return;
  }

  if (isLocked && imageInput.files.length > 1) {
    alert(
      "❌ Cannot lock multiple images at once. Please select only one image."
    );
    return;
  }

  if (selectedLang) {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message, targetLang: selectedLang }),
    });

    const data = await res.json();
    console.log("data", data);
    message =
      typeof data.translated === "string"
        ? data.translated.trim()
        : String(data.translated).trim();
  }

  if (isLocked) {
    const code = prompt("Enter a secret code to lock this message:");
    await encryptMessageWithCode(
      senderId,
      receiverId,
      message,
      isSecretChat,
      code
    );
    moveContactToTop(receiverId);
    input.value = "";
  } else {
    // 1. Send text message
    if (message) {
      await sendEncryptedMessage(
        senderId,
        receiverId,
        message,
        isSecretChat,
        currentReply
      );
      currentReply = null;
      document.getElementById("reply-preview").classList.add("hidden-reply");

      moveContactToTop(receiverId);
      input.value = "";
      clearAllSuggestions();
    }
  }

  // 2. Send multiple images only if more than 1 selected
  // if (files.length > 1) {
  //   files.forEach((file) => {
  //     const reader = new FileReader();
  //     reader.onloadend = () => {
  //       const base64Image = reader.result;
  //       socket.emit("image-message", {
  //         senderId,
  //         receiverId,
  //         image: base64Image,
  //       });
  //     };
  //     reader.readAsDataURL(file);
  //   });

  //   imageInput.value = "";
  //   fileNameSpan.innerText = "";
  // }
  if (files.length > 1) {
    const captions = [];
    await sendMultipleEncryptedImages(
      senderId,
      receiverId,
      files,
      captions,
      isSecretChat
    );
    imageInput.value = "";
    fileNameSpan.innerText = "";
  }

  // 3. Send audio if recorded
}

export function updateSecretChatUI() {
  const receiverId = window.currentReceiverId;
  console.log("🔄 updateSecretChatUI: receiverId =", receiverId);
  const isSecret = secretChatMap[receiverId];

  const statusEl = document.getElementById("secretStatus");
  if (statusEl) {
    statusEl.style.display = isSecret ? "block" : "none";
  }
}

// audio

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let isPaused = false;
let timerInterval;
let seconds = 0;
let recordedAudioBlob = null;
let audioContext;
let analyser;
let dataArray;
let canvasCtx;
let animationId;
let isPlayingPreview = false;

// DOM elements
const micButton = document.getElementById("micButton");
const deleteRecordingBtn = document.getElementById("deleteRecordingBtn");
const recordingControls = document.getElementById("recordingControls");
const stopButton = document.getElementById("stopButton");
const resumeButton = document.getElementById("resumeButton");
const sendRecordingBtn = document.getElementById("sendRecordingBtn");
const playPreviewBtn = document.getElementById("playPreviewBtn");
const timerDisplay = document.getElementById("recordingTimer");
const waveformCanvas = document.getElementById("waveformCanvas");
const audioPreview = document.getElementById("audioPreview");
const messageInput = document.querySelector(".message-input");
const imageBtn = document.getElementById("paperclip-btn");

// Initialize audio context and canvas
function initAudioContext() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  canvasCtx = waveformCanvas.getContext("2d");
}

// Draw waveform
function drawWaveform() {
  if (!analyser) return;

  animationId = requestAnimationFrame(drawWaveform);

  analyser.getByteTimeDomainData(dataArray);
  canvasCtx.fillStyle = "#f0f0f0";
  canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = "#4CAF50";
  canvasCtx.beginPath();

  const sliceWidth = (waveformCanvas.width * 1.0) / analyser.frequencyBinCount;
  let x = 0;

  for (let i = 0; i < analyser.frequencyBinCount; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * waveformCanvas.height) / 2;

    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  canvasCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
  canvasCtx.stroke();
}

// Timer functions
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    seconds++;
    const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    timerDisplay.textContent = `${mins}:${secs}`;
  }, 1000);
}

// function updateTimerDisplay() {
//   seconds++;
//   const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
//   const secs = String(seconds % 60).padStart(2, "0");
//   timerDisplay.textContent = `${mins}:${secs}`;
// }

function stopTimer() {
  clearInterval(timerInterval);
}

function resetTimer() {
  clearInterval(timerInterval);
  seconds = 0;
  timerDisplay.textContent = "00:00";
}

// Start recording
micButton.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    //  playPreviewBtn.disabled = true
    initAudioContext();

    // Setup audio nodes for visualization
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    recordedAudioBlob = null;
    seconds = 0;

    mediaRecorder.ondataavailable = (e) => {
      audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      console.log("Recording stopped. Chunks:", audioChunks.length);
      cancelAnimationFrame(animationId); // Stop live waveform animation

      if (audioChunks.length > 0) {
        recordedAudioBlob = new Blob(audioChunks, { type: "audio/webm" });
        // playPreviewBtn.disabled = false;
        drawStaticWaveform(); // Draw static waveform from the final blob

        // Show post-recording controls
        playPreviewBtn.style.display = "block";
        sendRecordingBtn.style.display = "flex";
        deleteRecordingBtn.style.display = "flex";

        // Hide recording-specific controls
        stopButton.style.display = "none";
        resumeButton.style.display = "none";
      } else {
        // If no audio chunks were recorded (e.g., very quick stop/delete), reset fully
        recordedAudioBlob = null;
        console.warn("Recording stopped but no audio data collected.");
        resetRecordingUI(); // Use the full reset function
      }
    };

    mediaRecorder.start(100);
    isRecording = true;
    isPaused = false;
    startTimer();
    drawWaveform();
    messageInput.disabled = true;
    imageBtn.disabled = true;
    recordingControls.style.display = "flex";
    micButton.style.display = "none";
    stopButton.style.display = "flex";
    resumeButton.style.display = "none";
    playPreviewBtn.style.display = "none"; // Hide preview button initially
    // deleteRecordingBtn.style.display = "flex"; // Show delete button
  } catch (error) {
    console.error("Error accessing microphone:", error);
    alert("Could not access microphone. Please check permissions.");
  }
});

// Draw static waveform from recorded audio
function drawStaticWaveform() {
  if (!recordedAudioBlob) return;

  const fileReader = new FileReader();
  fileReader.onload = function () {
    audioContext.decodeAudioData(this.result, function (buffer) {
      const offlineCtx = new OfflineAudioContext(
        1,
        buffer.length,
        buffer.sampleRate
      );
      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;

      const analyser = offlineCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(offlineCtx.destination);

      source.start(0);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = "#f0f0f0";
      canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = "#4CAF50";
      canvasCtx.beginPath();

      const sliceWidth =
        (waveformCanvas.width * 1.0) / analyser.frequencyBinCount;
      let x = 0;

      for (let i = 0; i < analyser.frequencyBinCount; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * waveformCanvas.height) / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
      canvasCtx.stroke();
    });
  };
  fileReader.readAsArrayBuffer(recordedAudioBlob);
}

// Play preview
playPreviewBtn.addEventListener("click", function () {
  console.log("hellow world", recordedAudioBlob);
  if (!recordedAudioBlob) {
    alert("Audio not ready yet. Please wait.");
    return;
  }

  if (isPlayingPreview) {
    audioPreview.pause();
    audioPreview.currentTime = 0;
    isPlayingPreview = false;
    playPreviewBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    playPreviewBtn.classList.remove("playing");
  } else {
    const audioURL = URL.createObjectURL(recordedAudioBlob);
    audioPreview.src = audioURL;
    audioPreview.play();
    isPlayingPreview = true;
    playPreviewBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
    playPreviewBtn.classList.add("playing");

    audioPreview.onended = function () {
      isPlayingPreview = false;
      playPreviewBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      playPreviewBtn.classList.remove("playing");
    };
  }
});

// Pause recording
stopButton.addEventListener("click", () => {
  if (isRecording && mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.pause();
    isPaused = true;
    stopButton.style.display = "none";
    resumeButton.style.display = "flex";
    stopTimer();
    cancelAnimationFrame(animationId); // Stop live waveform
    // Hide preview/send as recording is ongoing/paused
    playPreviewBtn.style.display = "block";
  }
});

// Resume recording
resumeButton.addEventListener("click", () => {
  if (
    isRecording &&
    isPaused &&
    mediaRecorder &&
    mediaRecorder.state === "paused"
  ) {
    mediaRecorder.resume();
    isPaused = false;
    resumeButton.style.display = "none";
    stopButton.style.display = "flex";
    startTimer();
    drawWaveform(); // Resume live waveform
    // Hide preview/send as recording is ongoing
    playPreviewBtn.style.display = "none";
    // sendRecordingBtn.style.display = "none";
  }
});

// Delete recording
deleteRecordingBtn.addEventListener("click", () => {
  console.log("Delete recording clicked.");
  resetRecordingUI();
});

// Send recording - Fixed version
sendRecordingBtn.addEventListener("click", async () => {
  // Stop timer immediately when sending
  stopTimer();

  if (isPlayingPreview) {
    audioPreview.pause();
    audioPreview.currentTime = 0;
    isPlayingPreview = false;
    playPreviewBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    playPreviewBtn.classList.remove("playing");
  }

  sendRecordingBtn.disabled = true;
  sendRecordingBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    // If still recording, stop first
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      await new Promise((resolve) => {
        mediaRecorder.onstop = resolve;
      });
    }

    if (!recordedAudioBlob && audioChunks.length > 0) {
      recordedAudioBlob = new Blob(audioChunks, { type: "audio/webm" });
    }

    if (!recordedAudioBlob) {
      throw new Error("No recording available to send");
    }

    const senderId = localStorage.getItem("userId");
    const receiverId = window.currentReceiverId;

    if (!receiverId) {
      alert("Please select a user to chat with");
      return;
    }

    const formData = new FormData();
    formData.append("audio", recordedAudioBlob);
    formData.append("senderId", senderId);
    formData.append("receiverId", receiverId);

    // const res = await fetch("/upload-audio", {
    //   method: "POST",
    //   body: formData,
    // });

    // if (!res.ok) {
    //   throw new Error("Failed to upload audio");
    // }

    // const data = await res.json();
    // const audioURL = data.audioUrl;

    const isSecretChat = secretChatMap[receiverId] || false;
    console.log("Secretmessage:", isSecretChat);

    await sendEncryptaudio(
      senderId,
      receiverId,
      recordedAudioBlob,
      isSecretChat
    );

    // socket.emit("audioMessage", {
    //   audioUrl: audioURL,
    //   senderId,
    //   receiverId,
    // });

    resetRecordingUI();
  } catch (error) {
    console.error("Error sending audio:", error);
    alert("Failed to send audio message: " + error.message);
  } finally {
    sendRecordingBtn.disabled = false;
    sendRecordingBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
  }
});

function resetRecordingUI() {
  console.log("Resetting recording UI.");
  // Stop media recorder if active
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    mediaRecorder = null; // Clear mediaRecorder instance
  }
  // Stop any ongoing animation
  cancelAnimationFrame(animationId);

  // Clear audio data
  audioChunks = [];
  recordedAudioBlob = null;

  // Reset timer
  resetTimer();

  // Reset state flags
  isRecording = false;
  isPaused = false;
  isPlayingPreview = false; // Ensure preview state is off

  // Reset preview button text/class
  playPreviewBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  playPreviewBtn.classList.remove("playing");
  audioPreview.pause();
  audioPreview.src = ""; // Clear audio source
  // Don't revoke URL here if it was done on audioPreview.onended

  // Hide recording controls and show mic button
  recordingControls.style.display = "none";
  micButton.style.display = "flex";

  // Hide all related action buttons
  playPreviewBtn.style.display = "none";
  sendRecordingBtn.style.display = "none";
  stopButton.style.display = "none";
  resumeButton.style.display = "none";
  deleteRecordingBtn.style.display = "none"; // Make sure delete is hidden too

  // Re-enable message input and image button
  messageInput.disabled = false;
  imageBtn.disabled = false;

  // Clear canvas
  if (canvasCtx) {
    canvasCtx.fillStyle = "#f0f0f0";
    canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
  }
  // If audioContext is not needed, consider closing it to free resources
  if (audioContext && audioContext.state === "running") {
    audioContext.close().then(() => console.log("AudioContext closed."));
  }
}

// search chat

document.querySelector(".searchChat").addEventListener("click", function () {
  document.getElementById("userInfoOverlay").classList.add("active");
  gsap.to("#searchinfochatBar", {
    right: 0,
    duration: 0.4,
    ease: "power2.out",
  });
});

// Close sidebar with GSAP
document
  .getElementById("userInfoOverlay")
  .addEventListener("click", function () {
    gsap.to("#searchinfochatBar", {
      right: -400,
      duration: 0.4,
      ease: "power2.in",
    });
    document.getElementById("userInfoOverlay").classList.remove("active");
  });
// Close sidebar with GSAP
document.querySelector(".crossbtn").addEventListener("click", function () {
  gsap.to("#searchinfochatBar", {
    right: -400,
    duration: 0.4,
    ease: "power2.in",
  });
  document.getElementById("userInfoOverlay").classList.remove("active");
});

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("chatSearchInput");
  const resultBox = document.getElementById("searchResults");

  let debounceTimer = null;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = input.value.trim().toLowerCase();
      searchMessagesClientSide(query);
    }, 200);
  });

  function searchMessagesClientSide(query) {
    if (!query) {
      resultBox.innerHTML = "";
      return;
    }

    const results = allMessagesInChat.filter((msg) =>
      msg.message.toLowerCase().includes(query)
    );

    displaySearchResults(results);
  }

  function displaySearchResults(messages) {
    resultBox.innerHTML = "";

    if (messages.length === 0) {
      resultBox.innerHTML = "<p>No results found.</p>";
      return;
    }

    messages.forEach((msg) => {
      const div = document.createElement("div");
      div.className = "search-result";
      div.innerHTML = `
         <div>${msg.message}</div>
         <small>${new Date(msg.timestamp).toLocaleString()}</small>
       `;
      div.addEventListener("click", () => {
        const target = document.getElementById(`msg-${msg._id}`);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.classList.add("highlight-temp");
          setTimeout(() => target.classList.remove("highlight-temp"), 1500);
        }
      });

      resultBox.appendChild(div);
    });
  }
});

// delete entire chat

document
  .getElementById("clear-chat")
  .addEventListener("click", async function () {
    const targetUserId = window.currentReceiverId;
    const res = await fetch("/deleteChat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });

    const data = await res.json();
    if (data.success) {
      document.querySelector(".messages-container").innerHTML =
        "<div class='cleared-placeholder'>This chat was cleared</div>";
    } else {
      alert("Failed to clear chat.");
    }
  });

// for creation of group

document.getElementById("saveGroupBtn").addEventListener("click", async () => {
  const name = document.getElementById("groupName").value.trim();
  const description = document.getElementById("groupDescription").value.trim();

  const members = Array.from(
    document.querySelectorAll(
      "#contactListForGroup input[type=checkbox]:checked"
    )
  ).map((cb) => cb.value);

  if (!name) {
    alert("Group name is required");
    return;
  }

  try {
    const res = await fetch("/groups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, description, members }),
    });

    const data = await res.json();
    console.log("Group creation response:", data);
    if (res.ok) {
      alert("Group created successfully!");
      socket.emit('create-group', { groupId: data.group._id, members: data.group.members });
      // Clear form fields and checkboxes
      document.getElementById("groupName").value = "";
      document.getElementById("groupDescription").value = "";
      document
        .querySelectorAll("#contactListForGroup input[type=checkbox]")
        .forEach((cb) => (cb.checked = false));
      location.reload();
    } else {
      alert(data.error || "Failed to create group");
    }
  } catch (err) {
    console.error(err);
    alert("Error creating group");
  }
});
