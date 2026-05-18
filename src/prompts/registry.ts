import { buildGeminiPrompt } from "./gemini.js"

export type ModelMatcher = string | RegExp
export type PromptEntry = { match: ModelMatcher; prompt: string }

export const PROMPTS: PromptEntry[] = [
  { match: /^gemini/, prompt: buildGeminiPrompt() },
]

export function resolvePrompt(modelId: string): string | undefined {
  for (const entry of PROMPTS) {
    if (typeof entry.match === "string") {
      if (modelId === entry.match) return entry.prompt
    } else {
      if (entry.match.test(modelId)) return entry.prompt
    }
  }
  return undefined
}
