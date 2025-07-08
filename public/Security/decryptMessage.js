// 📁 public/Security/decryptMessage.js

import { loadPrivateKey } from "./loadPrivatekey.js";

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
