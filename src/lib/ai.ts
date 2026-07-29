import { createOpenAI } from "@ai-sdk/openai";

/**
 * Vercel AI SDK Provider：默认适配 DeepSeek（OpenAI 兼容协议）。
 * 也可通过环境变量指向任意兼容网关（如 CodeBuddy / OpenRouter）。
 * 密钥仅存于服务端环境变量，绝不下发客户端。
 */
export function getAIModel() {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) return null;
  const provider = createOpenAI({
    apiKey,
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com/v1",
  });
  return provider(process.env.AI_MODEL || "deepseek-chat");
}
