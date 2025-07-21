// // helpers/llmClient.js
// export async function getLocalLLMResponse(prompt) {
//   try {
//     const response = await fetch("http://localhost:1234/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "Authorization": "Bearer lm-studio" // required by LM Studio
//       },
//       body: JSON.stringify({
//         model: "google/gemma-2b-it", // or your loaded model name
//         messages: [
//           { role: "system", content: "You are WhisperBot. Be concise and helpful." },
//           { role: "user", content: prompt }
//         ],
//         temperature: 0.7,
//         max_tokens: 512
//       })
//     });

//     if (!response.ok) {
//       console.error("❌ LLM API responded with non-200:", response.status);
//       return "⚠️ WhisperBot is currently unavailable (model issue).";
//     }

//     const data = await response.json();
//     return data.choices?.[0]?.message?.content || "⚠️ WhisperBot did not return any reply.";

//   } catch (err) {
//     console.error("❌ Error connecting to local LLM:", err.message);
//     return "⚠️ WhisperBot is offline or not reachable right now.";
//   }
// }



import axios from "axios";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Or paste your key directly (not recommended)

export async function getGeminiResponse(prompt) {
  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }
    );

    const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    return reply;
  } catch (err) {
    console.error("❌ Gemini API Error:", err.response?.data || err.message);
    return null;
  }
}
