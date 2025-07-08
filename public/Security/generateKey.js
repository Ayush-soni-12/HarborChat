import { storePrivateKey } from "./keyStorage.js";

export async function generateAndStoreRSAKeys(userId) {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  // Export public key (for server upload)
  const exportedPublicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPublicKey)));

  // Export and store private key locally (JWK format)
  const jwkPrivateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  await storePrivateKey(jwkPrivateKey);

  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);
    console.log("🆕 Generated new deviceId:", deviceId);
  } else {
    console.log("📱 Existing deviceId:", deviceId);
  }

  // Upload public key to server
try {
  const res = await fetch("/auth/savePublicKey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId,deviceId, publicKey: publicKeyBase64 }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("❌ Failed to save public key:", err);
  } else {
    console.log("✅ Public key saved to server.");
  }
} catch (err) {
  console.error("❌ Network or server error:", err);
}


  console.log("🔐 RSA keys set up and public key saved to server.");
}
