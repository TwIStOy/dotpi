import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const BASE_URL = "https://inference.twistoy.cn";

export default function registerHawtianPrivateProvider(pi: ExtensionAPI) {
  pi.registerProvider("hawtian-private", {
    baseUrl: BASE_URL,
    api: "anthropic-messages",
    apiKey: "HAWTIAN_PRIVATE_API_KEY",

    models: [
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
