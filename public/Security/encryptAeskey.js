// import { generateAESKey, encryptWithAESKey, exportAESKeyRaw } from "./aesHelper.js";
// import { getPublicKeyFromServer } from "./publicKeyUtils.js"; // fetch receiver's public key
// import { importPublicKey } from "./rsaHelper.js"; // convert base64 to CryptoKey
// // import socket from "../js/socket.js"


// export async function sendEncryptedMessage(senderId, receiverId, plainText) {
//   try {
//     // 1. Generate AES Key
//     const aesKey = await generateAESKey();

//     // 2. Encrypt the message using AES-GCM
//     const { encryptedData, iv } = await encryptWithAESKey(aesKey, plainText);

//     // 3. Export raw AES key
//     const rawAESKey = await exportAESKeyRaw(aesKey);

//     // 4. Get receiver's RSA public key from server
//     const base64ReceiverPublicKey = await getPublicKeyFromServer(receiverId);
//     const base64SenderPublicKey = await getPublicKeyFromServer(senderId);





//     // 5. Import it to CryptoKey
//     const receiverPublicKey = await importPublicKey(base64ReceiverPublicKey);
//     const senderPublicKey = await importPublicKey(base64SenderPublicKey);

//     // 6. Encrypt AES key using RSA
//     const encryptedAESKeyBuffer = await crypto.subtle.encrypt(
//       {
//         name: "RSA-OAEP",
//       },
//       receiverPublicKey,
//       rawAESKey
//     );

//       const encryptedAESKeyForSender = await window.crypto.subtle.encrypt(
//         { name: "RSA-OAEP" }, 
//         senderPublicKey, 
//         rawAESKey
//       );


    

//     const encryptedAESKey = Array.from(new Uint8Array(encryptedAESKeyBuffer));
//     const encryptedsenderAESKey = Array.from(new Uint8Array(encryptedAESKeyForSender));

//     // 7. Prepare message payload
//     const messagePayload = {
//       senderId,
//       receiverId,
//       encryptedMessage: encryptedData,
//       encryptedAESKey: encryptedAESKey,
//       encryptedsenderAESKey:encryptedsenderAESKey,
//       iv: iv,
//       type:'text'
//     };

//     // 8. Send to backend
//     const res = await fetch("/auth/messages/sendEncrypted", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(messagePayload),
//     });
//     const data = await res.json();
//     const messageId = data.messageId

//     if (!res.ok) {
//       console.error("❌ Failed to send encrypted message");
//     } else {
// socket.emit("chat message", {
//   senderId,
//   receiverId,
//   encryptedMessage: btoa(String.fromCharCode(...encryptedData)),
//   encryptedAESKey: btoa(String.fromCharCode(...encryptedAESKey)),
//   encryptedsenderAESKey: btoa(String.fromCharCode(...encryptedsenderAESKey)),
//   iv: btoa(String.fromCharCode(...iv)),
//   messageId
// });
//     console.log("✅ Encrypted message sent & emitted");
//       console.log("✅ Encrypted message sent");
//     }

//   } catch (err) {
//     console.error("❌ Error sending encrypted message:", err);
//   }
// }




import { generateAESKey, encryptWithAESKey, exportAESKeyRaw ,deriveAESKeyFromCode} from "./aesHelper.js";
import { getPublicKeyFromServer } from "./publicKeyUtils.js"; // NEW: fetch all public keys by userId
import { importPublicKey } from "./rsaHelper.js";
import { uploadToCloudinary } from "./uploadFunction.js";

export async function sendEncryptedMessage(senderId, receiverId, plainText,isSecretChat,currentReply) {
  try {
    const decryptedText = plainText.trim();
    if (!decryptedText) {
      console.error("❌ Cannot send empty message");
      return;
    }
    // 1. Generate AES Key
    const aesKey = await generateAESKey();

    // 2. Encrypt the message with AES
    const { encryptedData, iv } = await encryptWithAESKey(aesKey, plainText);

    // 3. Export raw AES key
    const rawAESKey = await exportAESKeyRaw(aesKey);

    // 4. Get public keys for all devices of both users
    const senderKeys = await getPublicKeyFromServer(senderId); // [{ deviceId, publicKey }]
    const receiverKeys = await getPublicKeyFromServer(receiverId);

    const allKeys = [...senderKeys, ...receiverKeys]; // Encrypt for both sender & receiver devices

    // 5. Encrypt AES key for each device
    const encryptedKeys = [];

    for (const { deviceId, publicKey: base64Key } of allKeys) {
      const cryptoKey = await importPublicKey(base64Key);
      const encryptedAESKeyBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        cryptoKey,
        rawAESKey
      );
      const encryptedAESKey = btoa(String.fromCharCode(...new Uint8Array(encryptedAESKeyBuffer)));
      encryptedKeys.push({ deviceId, encryptedAESKey });
    }

    // 6. Prepare message payload
    const messagePayload = {
      senderId,
      receiverId,
      isSecretChat,
      encryptedMessage: btoa(String.fromCharCode(...encryptedData)),
      iv: btoa(String.fromCharCode(...iv)),
      encryptedKeys, // array of encrypted keys with deviceId
      type: "text",
      status :"sent",
      decryptedText,
      repliedTo: currentReply || null
    };

    // 7. Send to backend
    const res = await fetch("/auth/messages/sendEncrypted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messagePayload),
    });

    const data = await res.json();
    const messageId = data.messageId;
     
    if (!res.ok) {
      console.error("❌ Failed to send encrypted message");
    } else {
      // 8. Emit over socket
      socket.emit("chat message", {
        senderId,
        receiverId,
        messageId,
        ...messagePayload, // contains encryptedMessage, iv, encryptedKeys
      });

      console.log("✅ Encrypted message sent & emitted");
    }
    
  } catch (err) {
    console.error("❌ Error sending encrypted message:", err);
  }
}

export async function sendEncryptedImage(senderId, receiverId, imageBlob, caption = "", isSecretChat) {
  try {
    // 1. Convert image to ArrayBuffer (binary)
    const fileBuffer = await imageBlob.arrayBuffer();

    // 2. Generate AES key
    const aesKey = await generateAESKey();

    // 3. Encrypt image binary using AES-GCM
    const { encryptedData, iv } = await encryptWithAESKey(aesKey, fileBuffer);

    // 4. Convert encrypted ArrayBuffer to Blob
    const encryptedBlob = new Blob([encryptedData], { type: imageBlob.type });

    // 5. Upload encrypted Blob to Cloudinary
    const cloudinaryRes = await uploadToCloudinary(encryptedBlob);
    const imageUrl = cloudinaryRes.secure_url;

    // 6. Export AES key in raw format (Uint8Array)
    const rawAESKey = await exportAESKeyRaw(aesKey);

    // 7. Fetch all public keys for sender and receiver
    const senderKeys = await getPublicKeyFromServer(senderId);
    const receiverKeys = await getPublicKeyFromServer(receiverId);
    const allKeys = [...senderKeys, ...receiverKeys];

    // 8. Encrypt AES key for each device using RSA public keys
    const encryptedKeys = [];
    for (const { deviceId, publicKey: base64Key } of allKeys) {
      const cryptoKey = await importPublicKey(base64Key);
      const encryptedAESKeyBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        cryptoKey,
        rawAESKey
      );
      const encryptedAESKey = btoa(String.fromCharCode(...new Uint8Array(encryptedAESKeyBuffer)));
      encryptedKeys.push({ deviceId, encryptedAESKey });
    }

    // 9. Prepare payload for your schema
    const messagePayload = {
      senderId,
      receiverId,
      isSecretChat,
      mediaUrls: [imageUrl], // ✅ your schema expects an array
      caption,
      iv: btoa(String.fromCharCode(...iv)),
      encryptedKeys,
      type: "image",
      status :"sent",
      fileType: imageBlob.type, 
    };

    // 10. Send encrypted message to backend
    const res = await fetch("/auth/messages/sendEncrypted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messagePayload),
    });

    const data = await res.json();
    const messageId = data.messageId;

    if (!res.ok) {
      console.error("❌ Failed to send encrypted image");
    } else {
      // 11. Emit message over Socket.IO
      socket.emit("image-message", {
        senderId,
        receiverId,
        messageId,
        ...messagePayload,
      });

      console.log("✅ Encrypted image sent & emitted");
    }
  } catch (err) {
    console.error("❌ Error in sendEncryptedImage:", err);
  }
}


export async function sendMultipleEncryptedImages(senderId, receiverId, fileList, captions = [], isSecretChat) {
  const loader = document.getElementById("loader");
  const fileInput = document.getElementById("imageInput");
  const sendButton = document.querySelector(".send-button");
  const paperclipBtn = document.getElementById('paperclip-btn');

  // 🔒 Disable input and button + show loader
  loader.style.display = "block";
  fileInput.disabled = true;
  sendButton.disabled = true;
  paperclipBtn.disabled = true;

  const files = Array.from(fileList);

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const blob = new Blob([file], { type: file.type });
      const caption = captions[i] || "";

      await sendEncryptedImage(senderId, receiverId, blob, caption,isSecretChat);
    }
  } catch (error) {
    console.error("❌ Error sending images:", error);
  } finally {
    // ✅ Re-enable input and button + hide loader
    loader.style.display = "none";
    fileInput.disabled = false;
    sendButton.disabled = false;
    paperclipBtn.disabled = false;
  }
}


export async function encryptMessageWithCode(senderId,receiverId,message,isSecretChat,code){
  try {
    // 1. Derive AES key from the passcode
    const aesKey = await deriveAESKeyFromCode(code);

    // 2. Encrypt the message with AES
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(message);
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encodedText
    );

    // 3. Prepare base64 encoded values
    const encryptedMessage = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));
    const encodedIV = btoa(String.fromCharCode(...iv));

    // 4. Prepare message payload
    const messagePayload = {
      senderId,
      receiverId,
      isSecretChat,
      encryptedMessage,
      iv: encodedIV,
      type: "lockedText",
      burnAfterRead:false,// always true for code-locked messages
      status: "sent",
    };

    // 5. Send to backend
    const res = await fetch("/auth/messages/sendLocked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messagePayload),
    });

    const data = await res.json();
    const messageId = data.messageId;

    if (!res.ok) {
      console.error("❌ Failed to send locked message");
    } else {
      // 6. Emit over socket
      socket.emit("chat message", {
        senderId,
        receiverId,
        messageId,
        ...messagePayload,
      });

      console.log("✅ Code-locked message sent & emitted");
    }

  } catch (err) {
    console.error("❌ Error sending code-locked message:", err);
  }
}

export async function encryptImageWithCode(senderId,receiverId,imageBlob,caption="",isSecretChat,code){
  try {
    // 1. Derive AES key from the passcode
    const aesKey = await deriveAESKeyFromCode(code);

    // 2. Convert image to ArrayBuffer (binary)
    const fileBuffer = await imageBlob.arrayBuffer();

    // 3. Encrypt image binary using AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      fileBuffer
    );

    // 4. Convert encrypted ArrayBuffer to Blob
    const encryptedBlob = new Blob([ciphertextBuffer], { type: imageBlob.type });

    // 5. Upload encrypted Blob to Cloudinary
    const cloudinaryRes = await uploadToCloudinary(encryptedBlob);
    const imageUrl = cloudinaryRes.secure_url;

    // 6. Prepare base64 encoded IV
    const encodedIV = btoa(String.fromCharCode(...iv));

    // 7. Prepare message payload
    const messagePayload = {
      senderId,
      receiverId,
      isSecretChat,
      mediaUrls: [imageUrl], // ✅ your schema expects an array
      caption,
      iv: encodedIV,
      type: "lockedImage",
      burnAfterRead:false,// always true for code-locked messages
      status :"sent",
      fileType: imageBlob.type, 
    };

    // 8. Send to backend
    const res = await fetch("/auth/messages/sendLocked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messagePayload),
    });

    const data = await res.json();
    const messageId = data.messageId;

    if (!res.ok) {
      console.error("❌ Failed to send locked image");
    } else {
      // 9. Emit over socket
      socket.emit("image-message", {
        senderId,
        receiverId,
        messageId,
        ...messagePayload,
      });

      console.log("✅ Code-locked image sent & emitted");
    }

  } catch (err) {
    console.error("❌ Error in encryptImageWithCode:", err);
  }
}
