// ✅ file: public/Security/keyStorage.js
import { openDB } from "https://unpkg.com/idb?module";

const DB_NAME = "HarborChatDB";
const DB_VERSION = 1;

// ✅ Create only once — shared DB connection
const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("keys")) {
        console.log("Creating 'keys' object store...");
      db.createObjectStore("keys");
    }
  },
});

export async function storePrivateKey(privateKeyJwk) {
  const db = await dbPromise;
  await db.put("keys", privateKeyJwk, "privateKey");
}

export async function getPrivateKey() {
  const db = await dbPromise;
  return await db.get("keys", "privateKey");
}

export async function deletePrivateKey() {
  const db = await dbPromise;
  await db.delete("keys", "privateKey");
}
