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



export async function exportAESKeyRaw(aesKey) {
  const rawKey = await crypto.subtle.exportKey("raw", aesKey);
  return new Uint8Array(rawKey);
}
