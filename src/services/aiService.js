
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);

export const maya = {
    chat: async (message, context = "") => {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const prompt = `
        You are Maya, an AI assistant for a cafe.
        Context: ${context}
        User: ${message}
      `;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Maya AI Error:", error);
            return "I'm having trouble connecting right now.";
        }
    }
};

// Legacy support if specific pages ask for these named exports
export const askMaya = async (msg, ctx) => maya.chat(msg, ctx);
export const startMayaSession = () => console.log("Maya session started");
