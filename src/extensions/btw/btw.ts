export const BTW_SYSTEM_PROMPT = `You are answering a quick "by the way" side question during a coding session.
Rules:
- Answer concisely and directly based on the conversation context provided.
- You have NO tool access — you cannot read files, run commands, or make changes.
- Only answer based on information already present in the conversation.
- Keep your response brief and to the point.
- Use markdown formatting where helpful (code blocks, lists, bold).
- If the conversation context doesn't contain enough information to answer, say so honestly.`;

export function buildBtwUserMessage(
  conversationText: string,
  question: string,
): string {
  return `
${conversationText}
${question}
Answer the side question above based on the conversation context. Be concise.`;
}

export function validateBtwArgs(args: string | undefined): {
  valid: boolean;
  question?: string;
  error?: string;
} {
  const question = args?.trim();
  if (!question || question.length === 0) {
    return {
      valid: false,
      error: "Usage: /btw — Ask a quick side question without polluting conversation history.",
    };
  }
  return { valid: true, question };
}

export function extractResponseText(
  content: Array<{ type: string; text?: string }>,
): string {
  return content
    .filter(
      (c): c is { type: "text"; text: string } =>
        c.type === "text" && typeof c.text === "string",
    )
    .map((c) => c.text)
    .join("\n");
}
