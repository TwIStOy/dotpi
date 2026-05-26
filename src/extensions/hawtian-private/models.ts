import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const BASE_URL = "https://inference.twistoy.cn";

export default function registerHawtianPrivateProvider(pi: ExtensionAPI) {
  pi.registerProvider("hawtian-private", {
    baseUrl: BASE_URL,
    api: "anthropic-messages",
    apiKey: "HAWTIAN_PRIVATE_API_KEY",

    models: [
      // models.dev: zai/glm-5.1 — context=200000, output=131072
      {
        id: "glm-5.1",
        name: "GLM-5.1",
        reasoning: true,
        input: ["text"],
        cost: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 131072,
      },
      // models.dev: zai/glm-5 — context=204800, output=131072
      {
        id: "glm-5",
        name: "GLM-5",
        reasoning: true,
        input: ["text"],
        cost: { input: 1.0, output: 3.2, cacheRead: 0.2, cacheWrite: 0 },
        contextWindow: 204800,
        maxTokens: 131072,
      },
      // models.dev: zai/glm-5-turbo — context=200000, output=131072
      {
        id: "glm-5-turbo",
        name: "GLM-5 Turbo",
        reasoning: true,
        input: ["text"],
        cost: { input: 1.2, output: 4.0, cacheRead: 0.24, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 131072,
      },
      // litellm: zai/glm-5-code — context=200000, output=128000
      {
        id: "glm-5-code",
        name: "GLM-5 Code",
        reasoning: true,
        input: ["text"],
        cost: { input: 1.2, output: 5.0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 128000,
      },
      // models.dev: zai/glm-4.7 — context=204800, output=131072
      {
        id: "glm-4.7",
        name: "GLM-4.7",
        reasoning: true,
        input: ["text"],
        cost: { input: 0.6, output: 2.2, cacheRead: 0.11, cacheWrite: 0 },
        contextWindow: 204800,
        maxTokens: 131072,
      },
      // models.dev: zai/glm-4.7-flash — context=200000, output=131072
      {
        id: "glm-4.7-flash",
        name: "GLM-4.7 Flash",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 131072,
      },
      // models.dev: zai/glm-4.7-flashx — context=200000, output=131072
      {
        id: "glm-4.7-flashx",
        name: "GLM-4.7 FlashX",
        reasoning: true,
        input: ["text"],
        cost: { input: 0.07, output: 0.4, cacheRead: 0.01, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 131072,
      },
      // models.dev: zai/glm-4.6 — context=204800, output=131072
      {
        id: "glm-4.6",
        name: "GLM-4.6",
        reasoning: true,
        input: ["text"],
        cost: { input: 0.6, output: 2.2, cacheRead: 0.11, cacheWrite: 0 },
        contextWindow: 204800,
        maxTokens: 131072,
      },
      // models.dev: zai/glm-4.5 — context=131072, output=98304
      {
        id: "glm-4.5",
        name: "GLM-4.5",
        reasoning: true,
        input: ["text"],
        cost: { input: 0.6, output: 2.2, cacheRead: 0.11, cacheWrite: 0 },
        contextWindow: 131072,
        maxTokens: 98304,
      },
      // models.dev: zai/glm-4.5-air — context=131072, output=98304
      {
        id: "glm-4.5-air",
        name: "GLM-4.5 Air",
        reasoning: true,
        input: ["text"],
        cost: { input: 0.2, output: 1.1, cacheRead: 0.03, cacheWrite: 0 },
        contextWindow: 131072,
        maxTokens: 98304,
      },
      // models.dev: zai/glm-4.5-flash — context=131072, output=98304
      {
        id: "glm-4.5-flash",
        name: "GLM-4.5 Flash",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 131072,
        maxTokens: 98304,
      },
      // litellm: zai/glm-4.5-x — context=128000, output=32000
      {
        id: "glm-4.5-x",
        name: "GLM-4.5 X",
        reasoning: true,
        input: ["text"],
        cost: { input: 2.2, output: 8.9, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 32000,
      },
      // litellm: zai/glm-4.5-airx — context=128000, output=32000
      {
        id: "glm-4.5-airx",
        name: "GLM-4.5 AirX",
        reasoning: true,
        input: ["text"],
        cost: { input: 1.1, output: 4.5, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 32000,
      },
      // models.dev: deepseek/deepseek-v4-flash — context=1000000, output=384000
      {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        reasoning: true,
        input: ["text"],
        cost: { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
        contextWindow: 1000000,
        maxTokens: 384000,
      },
      // models.dev: deepseek/deepseek-v4-pro — context=1000000, output=384000
      {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        reasoning: true,
        input: ["text"],
        cost: {
          input: 0.435,
          output: 0.87,
          cacheRead: 0.003625,
          cacheWrite: 0,
        },
        contextWindow: 1000000,
        maxTokens: 384000,
      },
    ],
  });
}
