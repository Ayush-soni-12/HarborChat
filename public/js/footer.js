import {updateEmptyChatMessage,loadChatMessages} from './contactFunction.js'
import state from'./state.js'

// --- ADD CONTACT FORM SUBMISSION ---
document.getElementById("addContactForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const name = document.getElementById("contactName").value.trim();
    const phone = document.getElementById("contactPhone").value.trim();
    try {
        const res = await fetch("/contacts/ajax/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, phone })
        });
        const result = await res.json();
        if (res.ok) {
            const contactList = document.getElementById('contactList');
            const emptyState = document.getElementById('emptyChatMsg');
            if (emptyState) emptyState.style.display = 'none';
            const userId = result.contactId;
            const newContact = document.createElement('div');
            newContact.className = 'contact-item';
            newContact.dataset.userid = userId;
            newContact.innerHTML = `
                <div class="contact-avatar">${name.charAt(0)}</div>
                <div class="contact-info">
                    <div class="contact-name">${name}</div>
                    <div class="contact-last-msg">${phone}</div>
                </div>
            `;
            // Add click event to open chat
            newContact.addEventListener('click', async function () {
                document.querySelector('.nav-name').textContent = name;
                document.querySelector('.nav-avatar').textContent = name.charAt(0);
                window.currentReceiverId = userId;
                document.querySelector('.empty-chat').style.display = 'none';
                document.querySelector('.chattingArea').style.display = 'block';
                document.getElementById('sidebar').classList.add('active');
                document.getElementById('chatArea').classList.add('active');
            state.messagesSkip = 0;
            state.allMessagesLoaded = false;
            await loadChatMessages(false);
            });
            contactList.appendChild(newContact);
            updateEmptyChatMessage();
            // Reset form and close modal
            e.target.reset();
            bootstrap.Modal.getInstance(document.getElementById('addContactModal')).hide();
            // Show success notification
            showToast('Contact added successfully');
        } else {
            alert(result.message || "Something went wrong.");
        }
    } catch (err) {
        console.error(err);
        alert("Failed to add contact.");
    }
});

// --- TOAST NOTIFICATION ---
function showToast(message) {
    const toast = document.getElementById('toastNotification');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// --- EMOJI PICKER LOGIC ---
const emojiButton = document.getElementById('emoji-button');
const emojiPicker = document.getElementById('emoji-picker');
const chatInput = document.querySelector('.message-input');
// Toggle the emoji picker
emojiButton.addEventListener('click', () => {
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
});
// Insert emoji into the textarea
emojiPicker.addEventListener('emoji-click', (event) => {
    const emoji = event.detail.unicode;
    chatInput.value += emoji;
});
// Hide emoji picker when clicking outside
document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiButton) {
        emojiPicker.style.display = 'none';
    }
});