import { GoogleGenerativeAI } from "@google/generative-ai";
import Sentiment   from "sentiment";
import natural from   "natural";

// Init APIs and tools
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const sentiment = new Sentiment();
const tokenizer = new natural.WordTokenizer();

// Optional: stopwords for better keyword extraction
const stopwords = new Set([
  "i", "am", "is", "are", "the", "a", "an", "in", "on", "at", "for", "with",
  "and", "or", "to", "of", "this", "that", "you", "me", "we", "us", "our"
]);

// Refined tone detection
function getTone(score) {
  if (score >= 4) return "very positive";
  if (score >= 2) return "positive";
  if (score <= -4) return "very negative";
  if (score <= -2) return "negative";
  return "neutral";
}

function extractKeywords(text) {
      if (!text || typeof text !== "string") return "";
  const tokens = tokenizer.tokenize(text.toLowerCase());
  const filtered = tokens.filter(word => !stopwords.has(word) && word.length > 2);
  return [...new Set(filtered)].slice(0, 5).join(", ");
}

async function getReplySuggestions(messageText) {
  if (!messageText || typeof messageText !== "string" || messageText.trim().length < 2) {
    throw new Error("Invalid message text for AI suggestion.");
  }


  const analysis = sentiment.analyze(messageText);
  const tone = getTone(analysis.score);
  const keywords = extractKeywords(messageText);

const prompt = `
You are an assistant helping users reply to chat messages.

Message: "${messageText}"
Tone detected: "${tone}"
Important keywords: ${keywords || "none"}

Generate 3 short, contextually appropriate, human-like replies under 10 words or more words if necessary.
Keep replies friendly and natural.

Output ONLY a JSON array like: ["Reply 1", "Reply 2", "Reply 3"]
Do not include any code blocks, backticks, or markdown formatting.
Return only the raw JSON array, nothing else.
`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Ensure it starts with [ and ends with ] before parsing
    const safeText = text.startsWith("[") && text.endsWith("]") ? text : `[${text}]`;
    return JSON.parse(safeText);
  } catch (err) {
    console.error("Gemini error:", err.message);
    return ["Okay!", "Thanks!", "I'll check."]; // fallback
  }
}

export default getReplySuggestions;
