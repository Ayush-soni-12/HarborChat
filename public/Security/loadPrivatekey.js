import { getPrivateKey } from "./keyStorage.js"
import { generateAndStoreRSAKeys } from "./generateKey.js";
 
export async function loadPrivateKey() {
  const jwk = await getPrivateKey();
 if (!jwk) {
  console.log("No private key found in IndexedDB");
  return null;
}

  const privateKey = await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  );

  return privateKey;
}

export async function handleLogin(userId) {
  const privateKey = await loadPrivateKey();

  if (!privateKey) {
    console.log("No private key found — generating new...");
    await generateAndStoreRSAKeys(userId);
  } else {
    console.log("Private key loaded from device.");
  }
}

