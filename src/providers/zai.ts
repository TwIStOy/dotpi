import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";

const ZAI_BASE_URL = "https://api.z.ai/api/coding/paas/v4";

export default function registerZaiProvider(pi: ExtensionAPI) {
  pi.registerProvider("zai", {
    baseUrl: ZAI_BASE_URL,
    api: "openai-completions",

    models: [
      {
        id: "glm-5.1",
        name: "GLM-5.1",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 1.0, output: 3.2, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 202752,
        maxTokens: 128000,
      },
      {
        id: "glm-5",
        name: "GLM-5",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 1.0, output: 3.2, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 202752,
        maxTokens: 128000,
      },
      {
        id: "glm-5-turbo",
        name: "GLM-5 Turbo",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 1.2, output: 4.0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 202752,
        maxTokens: 128000,
      },
      {
        id: "glm-5-code",
        name: "GLM-5 Code",
        reasoning: true,
        input: ["text"],
        cost: { input: 1.2, output: 5.0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 202752,
        maxTokens: 128000,
      },
      {
        id: "glm-4.7",
        name: "GLM-4.7",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0.6, output: 2.2, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 204800,
        maxTokens: 128000,
      },
      {
        id: "glm-4.7-flash",
        name: "GLM-4.7 Flash",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 128000,
      },
      {
        id: "glm-4.7-flashx",
        name: "GLM-4.7 FlashX",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0.07, output: 0.4, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 128000,
      },
      {
        id: "glm-4.6",
        name: "GLM-4.6",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0.6, output: 2.2, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 204800,
        maxTokens: 128000,
      },
      {
        id: "glm-4.5",
        name: "GLM-4.5",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0.6, output: 2.2, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 96000,
      },
      {
        id: "glm-4.5-air",
        name: "GLM-4.5 Air",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0.2, output: 1.1, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 96000,
      },
      {
        id: "glm-4.5-flash",
        name: "GLM-4.5 Flash",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 96000,
      },
      {
        id: "glm-4.5-x",
        name: "GLM-4.5 X",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 2.2, output: 8.9, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 96000,
      },
      {
        id: "glm-4.5-airx",
        name: "GLM-4.5 AirX",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 1.1, output: 4.5, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 96000,
      },
    ],

    oauth: {
      name: "Z.AI",

      async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
        const apiKey = await callbacks.onPrompt({
          message: "Enter your Z.AI API key (from https://z.ai/manage-apikey):",
        });
        return {
          access: apiKey.trim(),
          refresh: "",
          expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
        };
      },

      async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
        return credentials;
      },

      getApiKey(credentials: OAuthCredentials): string {
        return credentials.access;
      },
    },
  });
}
