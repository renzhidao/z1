import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Initialize the client with the API key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Sends a message to the Gemini model and returns the text response.
 * Uses the gemini-2.5-flash model for fast, conversational responses.
 */
export const sendMessageToGemini = async (
  message: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
): Promise<string> => {
  try {
    // Determine model based on complexity, defaulting to flash for chat
    const modelId = 'gemini-2.5-flash';

    const chat = ai.chats.create({
      model: modelId,
      config: {
        systemInstruction: "你是一个微信里的智能助手。请使用中文回答。语气要自然、亲切、像朋友一样。回复不要太长，尽量简洁，可以使用emoji。如果用户问问题，请给出有帮助的回答。",
      },
      history: history,
    });

    const result: GenerateContentResponse = await chat.sendMessage({
      message: message,
    });

    return result.text || "抱歉，我现在无法生成回复。";
  } catch (error) {
    console.error("Error communicating with Gemini:", error);
    return "网络连接似乎有点问题，请稍后再试。";
  }
};