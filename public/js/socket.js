// const socket = io(); 
// const socket = io("http://192.168.1.4:3000");
// const socket = io("https://32aa84f312b6.ngrok-free.app");
const socket = io(location.hostname.includes("ngrok") ? 
  "https://32aa84f312b6.ngrok-free.app" : 
  "http://localhost:3000");




socket.on("connect", () => {
  console.log("✅ Connected with socket ID:", socket.id);
});
