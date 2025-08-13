// 📁 public/Security/aesHelpers.js

export async function generateAESKey() {
  return await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptWithAESKey(aesKey, input) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  let data;
  if (typeof input === "string") {
    // For text messages
    const encoder = new TextEncoder();
    data = encoder.encode(input);
  } else if (input instanceof ArrayBuffer) {
    // For binary files like images/audio
    data = new Uint8Array(input);
  } else {
    throw new Error("encryptWithAESKey only supports string or ArrayBuffer input.");
  }

  const encryptedContent = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    data
  );

  return {
    encryptedData: new Uint8Array(encryptedContent),
    iv: new Uint8Array(iv),
  };
}

export async function encryptAudioBlob(aesKey, audioBlob) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Convert Blob to ArrayBuffer
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioData = new Uint8Array(arrayBuffer);

  // Encrypt the audio data
  const encryptedContent = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    audioData
  );

  return {
    encryptedData: new Uint8Array(encryptedContent), // Encrypted bytes
    iv: new Uint8Array(iv) // IV needed for decryption
  };
}


export async function exportAESKeyRaw(aesKey) {
  const rawKey = await crypto.subtle.exportKey("raw", aesKey);
  return new Uint8Array(rawKey);
}



export async function deriveAESKeyFromCode(secretCode) {
  const encoder = new TextEncoder();

  // Step 1: Convert the secret code to key material
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(secretCode),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Step 2: Derive AES-GCM key using PBKDF2
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("harborchat-locked-message-salt"), // use a constant app-wide salt
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );

  return derivedKey;
}
