import { generateAESKey, encryptWithAESKey, exportAESKeyRaw } from "./aesHelper.js";
import { getPublicKeyFromServer } from "./publicKeyUtils.js"; // fetch receiver's public key
import { importPublicKey } from "./rsaHelper.js"; // convert base64 to CryptoKey
// import socket from "../js/socket.js"


export async function sendEncryptedMessage(senderId, receiverId, plainText) {
  try {
    // 1. Generate AES Key
    const aesKey = await generateAESKey();

    // 2. Encrypt the message using AES-GCM
    const { encryptedData, iv } = await encryptWithAESKey(aesKey, plainText);

    // 3. Export raw AES key
    const rawAESKey = await exportAESKeyRaw(aesKey);

    // 4. Get receiver's RSA public key from server
    const base64ReceiverPublicKey = await getPublicKeyFromServer(receiverId);
    const base64SenderPublicKey = await getPublicKeyFromServer(senderId);

    // 5. Import it to CryptoKey
    const receiverPublicKey = await importPublicKey(base64ReceiverPublicKey);
    const senderPublicKey = await importPublicKey(base64SenderPublicKey);

    // 6. Encrypt AES key using RSA
    const encryptedAESKeyBuffer = await crypto.subtle.encrypt(
      {
        name: "RSA-OAEP",
      },
      receiverPublicKey,
      rawAESKey
    );

      const encryptedAESKeyForSender = new Uint8Array(
      await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, senderPublicKey, rawAESKey)
    );

    const encryptedAESKey = Array.from(new Uint8Array(encryptedAESKeyBuffer));
    const encryptedsenderAESKey = Array.from(new Uint8Array(encryptedAESKeyForSender));

    // 7. Prepare message payload
    const messagePayload = {
      senderId,
      receiverId,
      encryptedMessage: encryptedData,
      encryptedAESKey: encryptedAESKey,
      encryptedsenderAESKey:encryptedsenderAESKey,
      iv: iv,
      type:'text'
    };

    // 8. Send to backend
    const res = await fetch("/auth/messages/sendEncrypted", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messagePayload),
    });
    const data = await res.json();
    const messageId = data.messageId

    if (!res.ok) {
      console.error("❌ Failed to send encrypted message");
    } else {
socket.emit("chat message", {
  senderId,
  receiverId,
  encryptedMessage: btoa(String.fromCharCode(...encryptedData)),
  encryptedAESKey: btoa(String.fromCharCode(...encryptedAESKey)),
  encryptedsenderAESKey: btoa(String.fromCharCode(...encryptedsenderAESKey)),
  iv: btoa(String.fromCharCode(...iv)),
  messageId
});
    console.log("✅ Encrypted message sent & emitted");
      console.log("✅ Encrypted message sent");
    }

  } catch (err) {
    console.error("❌ Error sending encrypted message:", err);
  }
}
