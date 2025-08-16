// 📁 public/Security/decryptMessage.js

import { loadPrivateKey } from "./loadPrivatekey.js";
import { deriveAESKeyFromCode} from "./aesHelper.js"

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function decryptMessage({
  encryptedMessage,
  encryptedAESKey,
  iv,
}) {
  try {
    const privateKey = await loadPrivateKey();
    const aesKeyBuffer = base64ToUint8Array(encryptedAESKey);
    const ivBuffer = base64ToUint8Array(iv);
    const encryptedMessageBuffer = base64ToUint8Array(encryptedMessage);
    const rawAESKey = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      aesKeyBuffer
    );

    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      rawAESKey,
      "AES-GCM",
      true,
      ["decrypt"]
    );

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuffer },
      aesKey,
      encryptedMessageBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.error("❌ Decryption failed:", err);
    return "[Decryption failed]";
  }
}


export async function decryptImage({ encryptedAESKey, iv, fileUrl }) {
  try {
    // 1. Load private RSA key
    const privateKey = await loadPrivateKey();

    // 2. Decode AES key and IV
    const aesKeyBuffer = base64ToUint8Array(encryptedAESKey);
    const ivBuffer = base64ToUint8Array(iv);

    // 3. Decrypt AES key with RSA
    const rawAESKey = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      aesKeyBuffer
    );

    // 4. Import decrypted AES key
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      rawAESKey,
      "AES-GCM",
      true,
      ["decrypt"]
    );

    // 5. Fetch encrypted file from Cloudinary (as ArrayBuffer)
    const response = await fetch(fileUrl);
    const encryptedBuffer = await response.arrayBuffer();

    // 6. Decrypt with AES
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuffer },
      aesKey,
      encryptedBuffer
    );

    // 7. Return Blob (to use in <img>, download, etc.)
    return new Blob([decryptedBuffer]);
  } catch (err) {
    console.error("❌ Image decryption failed:", err);
    return null;
  }
}

export async function decryptAudio({ encryptedAESKey, iv, fileUrl, mimeType = "audio/webm" }) {
  try {
    // 1. Load private RSA key
    const privateKey = await loadPrivateKey();

    // 2. Decode AES key and IV
    const aesKeyBuffer = base64ToUint8Array(encryptedAESKey);
    const ivBuffer = base64ToUint8Array(iv);

    // 3. Decrypt AES key with RSA
    const rawAESKey = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      aesKeyBuffer
    );

    // 4. Import decrypted AES key
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      rawAESKey,
      "AES-GCM",
      true,
      ["decrypt"]
    );

    // 5. Fetch encrypted audio from Cloudinary (or any URL)
    const response = await fetch(fileUrl);
    const encryptedBuffer = await response.arrayBuffer();

    // 6. Decrypt with AES
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuffer },
      aesKey,
      encryptedBuffer
    );

    // 7. Return audio Blob with correct MIME type
    return new Blob([decryptedBuffer]);

  } catch (err) {
    console.error("❌ Audio decryption failed:", err);
    return null;
  }
}



 export async function decryptLockedMessageWithCode({ encryptedMessage, iv, code }) {
  const key = await deriveAESKeyFromCode(code);
  const decodedIv = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const decodedMsg = Uint8Array.from(atob(encryptedMessage), c => c.charCodeAt(0));

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodedIv },
      key,
      decodedMsg
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

export async function decryptImageWithCode({ url, iv, code }) {
  try {
    const aesKey = await deriveAESKeyFromCode(code);
    const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

    const res = await fetch(url);
    const encryptedBuffer = await res.arrayBuffer();

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      aesKey,
      encryptedBuffer
    );

    return new Blob([decryptedBuffer]);
  } catch (err) {
    console.error("❌ Failed to decrypt locked image:", err);
    return null;
  }
}
