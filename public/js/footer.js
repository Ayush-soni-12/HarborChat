import { updateEmptyChatMessage, loadChatMessages } from "./contactFunction.js";
import { moveContactToTop,showToast } from "./contactFunction.js";
import state from "./state.js";
import socket from "./socket.js";

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

document.addEventListener('DOMContentLoaded', function() {
  const imageEditModal = document.getElementById("imageEditModal");
  const editModalContent = imageEditModal.querySelector(".edit-modal-content");
  
  // Draw button logic
  document.getElementById("drawButton").addEventListener("click", function() {
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
    fabric.Image.fromURL(dataURL, function(img) {
      const scaleX = fabricCanvas.width / img.width;
      const scaleY = fabricCanvas.height / img.height;
      const scale = Math.min(scaleX, scaleY);
      
      fabricCanvas.setBackgroundImage(img, function() {
        fabricCanvas.renderAll();
      }, {
        scaleX: scale,
        scaleY: scale,
        originX: 'left',
        originY: 'top'
      });
    });

    // Ensure modal is scrollable
    setTimeout(() => {
      editModalContent.scrollTo({
        top: editModalContent.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
  });

  // Update fabric brush settings
  function updateFabricBrush() {
    if (!fabricCanvas) return;
    
    const brushColor = document.getElementById("fabricColor").value;
    const brushSize = parseInt(document.getElementById("fabricBrushSize").value);
    
    fabricCanvas.freeDrawingBrush.width = brushSize;
    fabricCanvas.freeDrawingBrush.color = brushColor;
  }

  // Color picker
  document.getElementById("fabricColor").addEventListener("change", updateFabricBrush);

  // Brush size
  document.getElementById("fabricBrushSize").addEventListener("input", updateFabricBrush);

  // Clear drawing
  document.getElementById("fabricClear").addEventListener("click", function() {
    if (fabricCanvas) {
      fabricCanvas.clear();
      // Reapply background image if exists
      if (fabricCanvas.backgroundImage) {
        fabricCanvas.renderAll();
      }
    }
  });

  // Crop and send single image
  document.getElementById("cropButton").addEventListener("click", function() {
    const senderId = localStorage.getItem("userId");
    const receiverId = window.currentReceiverId;
    const caption = document.getElementById("imageCaption").value.trim();

    if (!receiverId) {
      alert("Please select a user to chat with");
      return;
    }

    let finalImage;
    const fabricCanvasEl = document.getElementById("fabricCanvas");
    
    try {
    if (fabricCanvas && fabricCanvasEl && fabricCanvasEl.style.display !== "none") {
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

      // Emit the image message
        socket.emit("image-message", {
          senderId,
          receiverId,
          image: finalImage,
          caption
        });
      

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
// Main sendMessage handler
export function sendMessage() {
  const input = document.querySelector(".message-input");
  const files = Array.from(imageInput.files);
  const message = input.value.trim();
  const senderId = localStorage.getItem("userId");
  const receiverId = window.currentReceiverId;

  if (!message && files.length === 0) return;
  if (!receiverId) {
    alert("Select a user to chat with");
    return;
  }

  // 1. Send text message
  if (message) {
    socket.emit("chat message", { senderId, receiverId, message });
    moveContactToTop(receiverId);
    input.value = "";
  }

  // 2. Send multiple images only if more than 1 selected
  if (files.length > 1) {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Image = reader.result;
        socket.emit("image-message", {
          senderId,
          receiverId,
          image: base64Image,
        });
      };
      reader.readAsDataURL(file);
    });

    imageInput.value = "";
    fileNameSpan.innerText = "";
  }

  // ⚠️ Do NOT handle 1 image here — it's handled via modal already
}
