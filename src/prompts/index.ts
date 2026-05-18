import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { resolvePrompt } from "./registry.js"

export { PROMPTS, resolvePrompt } from "./registry.js"
export type { PromptEntry, ModelMatcher } from "./registry.js"

export function registerPrompts(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    const modelId = ctx.model?.id
    if (!modelId) return
    const prompt = resolvePrompt(modelId)
    if (prompt) {
      event.systemPrompt = event.systemPrompt + "\n\n" + prompt
    }
  })
}
