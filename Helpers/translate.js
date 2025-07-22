// utils/translate.js
import axios from "axios";

export const translateText = async (text, targetLang) => {
  try {
    const response = await axios.post(
      `https://translation.googleapis.com/language/translate/v2`,
      {},
      {
        params: {
          key: process.env.GOOGLE_API_KEY,
          q: text,
          target: targetLang, // e.g., 'es' for Spanish
        },
      }
    );

    const translatedText = response.data.data.translations[0].translatedText;
    return translatedText;
  } catch (err) {
    console.error("Translation Error:", err.response?.data || err.message);
    return null;
  }
};
