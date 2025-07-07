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

export async function encryptWithAESKey(aesKey, message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV

  const encryptedContent = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    aesKey,
    data
  );

  return {
    encryptedData: Array.from(new Uint8Array(encryptedContent)),
    iv: Array.from(iv),
  };
}

export async function exportAESKeyRaw(aesKey) {
  const rawKey = await crypto.subtle.exportKey("raw", aesKey);
  return new Uint8Array(rawKey);
}
