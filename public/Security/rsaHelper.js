// 📁 public/Security/rsaHelpers.js

export async function importPublicKey(base64PublicKey) {
  const binaryDer = Uint8Array.from(atob(base64PublicKey), char => char.charCodeAt(0));
  return await crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
}
