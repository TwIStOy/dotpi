import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { generateSystemPrompt } from "./system-prompt.js";

describe("memory", () => {
  test("generateSystemPrompt includes memory and journal instructions", async () => {
    const prompt = await generateSystemPrompt();
    assert.match(prompt, /<memory_instructions>/);
    assert.match(prompt, /<journal_instructions>/);
    assert.match(prompt, /memory-read/);
    assert.match(prompt, /journal-write/);
  });
});