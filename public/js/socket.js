const socket = io(); // ✅ This will now work, because io is globally available

socket.on("connect", () => {
  console.log("✅ Connected with socket ID:", socket.id);
});
