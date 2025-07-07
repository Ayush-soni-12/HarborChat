// 📁 public/Security/publicKeyUtils.js

export async function getPublicKeyFromServer(userId) {
  const res = await fetch(`/auth/userPublicKey/${userId}`);
  if (!res.ok) {
    throw new Error("Could not fetch public key from server");
  }
  const data = await res.json();
  return data.publicKey; // base64-encoded
}
