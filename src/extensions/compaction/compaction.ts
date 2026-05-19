import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { complete, type Message } from "@earendil-works/pi-ai";
import {
  convertToLlm,
  serializeConversation,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { DOTPI_COMPACTION_SYSTEM_PROMPT } from "./constants.js";
import {
  BRANCH_SUMMARY_ENABLED,
  COMPACTION_MAX_TOKENS,
  COMPACTION_NOTIFY,
  COMPACTION_PROFILE,
  CUSTOM_COMPACTION_ENABLED,
  FALLBACK_TO_DEFAULT_ON_ERROR,
  IDLE_COMPACTION_THRESHOLD_TOKENS,
  INCLUDE_PREVIOUS_SUMMARY,
  THRESHOLD_PERCENT,
  THRESHOLD_TOKENS,
} from "./settings.js";
import { stringifyError } from "./util.js";

export type SummaryProfile = "concise" | "balanced" | "exhaustive";
export type SummaryPurpose =
  | "compaction"
  | "branch-summary"
  | "session-search";

export function compactionNotify(
  ctx: ExtensionContext,
  message: string,
  level: "info" | "warning" | "error" = "info",
): void {
  if (ctx.hasUI && COMPACTION_NOTIFY) ctx.ui.notify(message, level);
}

export function compactionProfile(): SummaryProfile {
  return COMPACTION_PROFILE === "concise" || COMPACTION_PROFILE === "exhaustive"
    ? COMPACTION_PROFILE
    : "balanced";
}

function compactionProfileInstructions(profile: SummaryProfile): string {
  if (profile === "concise")
    return "Prefer a compact continuation summary. Include only decisions, current state, modified/read files, blockers, and concrete next steps.";
  if (profile === "exhaustive")
    return "Be thorough. The summary may replace substantial conversation history, so preserve all relevant implementation details, alternatives considered, exact file paths, commands, errors, and pending work.";
  return "Be complete but not verbose. Preserve enough detail for a future assistant to continue without the old transcript.";
}

function stripThinkingForSummary(messages: Message[]): Message[] {
  return messages.map((message) => {
    if (message.role !== "assistant" || !Array.isArray(message.content))
      return message;
    return {
      ...message,
      content: message.content.filter((part: any) => part?.type !== "thinking"),
    };
  });
}

export function serializeMessagesForSummary(messages: AgentMessage[]): string {
  return serializeConversation(
    stripThinkingForSummary(convertToLlm(messages)),
  );
}

function customMessageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const part of content) {
    if (part?.type === "text" && typeof part.text === "string")
      parts.push(part.text);
    else if (part?.type === "image")
      parts.push(
        `[image${typeof part.mimeType === "string" ? ` ${part.mimeType}` : ""}]`,
      );
    else if (part?.type) parts.push(`[${String(part.type)}]`);
  }
  return parts.join("\n").trim();
}

function buildSummaryPrompt(options: {
  conversationText: string;
  customInstructions?: string;
  previousSummary?: string;
  profile: SummaryProfile;
  purpose: SummaryPurpose;
}): string {
  const purposeText =
    options.purpose === "branch-summary"
      ? "the branch being left during /tree navigation"
      : options.purpose === "session-search"
        ? "the previous session being imported into the current context"
        : "the conversation span being compacted";
  const previous = options.previousSummary
    ? `<previous-summary>\n${options.previousSummary}\n</previous-summary>\n\n`
    : "";
  const custom = options.customInstructions?.trim()
    ? `<custom-instructions>\n${options.customInstructions.trim()}\n</custom-instructions>\n\n`
    : "";
  return `${custom}${previous}<conversation>\n${options.conversationText}\n</conversation>\n\nSummarize ${purposeText} for a coding agent that must continue the work.\n\n${compactionProfileInstructions(options.profile)}\n\nUse this markdown shape:\n\n## Goal\n[What the user is trying to accomplish]\n\n## Constraints & Preferences\n- [Requirements, style, safety, or user preferences]\n\n## Progress\n### Done\n- [x] [Completed work]\n\n### In Progress\n- [ ] [Current partial work]\n\n### Blocked\n- [Blockers or none]\n\n## Key Decisions\n- **[Decision]**: [Rationale]\n\n## Files & Commands\n- [Files read/modified and important commands/results]\n\n## Next Steps\n1. [Most important next action]\n\n## Critical Context\n- [Anything easy to lose but needed later]`;
}

function modelLabel(model: any): string {
  return model ? `${model.provider}/${model.id}` : "unknown model";
}

export async function generateCompactionSummary(
  ctx: ExtensionContext,
  options: {
    conversationText: string;
    customInstructions?: string;
    previousSummary?: string;
    maxTokens?: number;
    purpose: SummaryPurpose;
    signal?: AbortSignal;
  },
): Promise<{ model: string; summary: string }> {
  const maxTokens = Math.max(
    256,
    Math.floor(options.maxTokens ?? COMPACTION_MAX_TOKENS),
  );
  const promptText = buildSummaryPrompt({
    conversationText: options.conversationText,
    customInstructions: options.customInstructions,
    previousSummary: INCLUDE_PREVIOUS_SUMMARY
      ? options.previousSummary
      : undefined,
    profile: compactionProfile(),
    purpose: options.purpose,
  });

  const model = ctx.model;
  if (!model) throw new Error("No active session model for compaction summary");
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) throw new Error(auth.error);
  if (!auth.apiKey) throw new Error(`No API key for ${model.provider}`);

  const message: Message = {
    content: [{ text: promptText, type: "text" }],
    role: "user",
    timestamp: Date.now(),
  };
  const response = await complete(
    model,
    { messages: [message], systemPrompt: DOTPI_COMPACTION_SYSTEM_PROMPT },
    { apiKey: auth.apiKey, headers: auth.headers, maxTokens, signal: options.signal },
  );
  const summary = response.content
    .filter(
      (content): content is { type: "text"; text: string } =>
        content.type === "text",
    )
    .map((content) => content.text)
    .join("\n")
    .trim();
  return { model: modelLabel(model), summary };
}

export async function handleSessionCompaction(
  event: any,
  ctx: ExtensionContext,
): Promise<any> {
  if (!CUSTOM_COMPACTION_ENABLED) return undefined;
  const preparation = event.preparation ?? {};
  const messages = [
    ...(preparation.messagesToSummarize ?? []),
    ...(preparation.turnPrefixMessages ?? []),
  ];
  if (messages.length === 0) return undefined;
  const tokensBefore =
    typeof preparation.tokensBefore === "number" ? preparation.tokensBefore : 0;
  compactionNotify(
    ctx,
    `Compaction: summarizing ${messages.length} message(s), ${tokensBefore.toLocaleString()} token(s).`,
    "info",
  );
  try {
    const conversationText = serializeMessagesForSummary(messages);
    const result = await generateCompactionSummary(ctx, {
      conversationText,
      customInstructions: event.customInstructions,
      previousSummary: preparation.previousSummary,
      purpose: "compaction",
      signal: event.signal,
    });
    if (!result.summary.trim()) throw new Error("Compaction summary was empty");
    compactionNotify(
      ctx,
      `Compaction complete: ${result.model}`,
      "info",
    );
    return {
      compaction: {
        details: {
          messageCount: messages.length,
          model: result.model,
          profile: compactionProfile(),
          source: "dotpi",
        },
        firstKeptEntryId: preparation.firstKeptEntryId,
        summary: result.summary,
        tokensBefore: preparation.tokensBefore,
      },
    };
  } catch (error) {
    if (event.signal?.aborted) return undefined;
    compactionNotify(
      ctx,
      `Compaction failed: ${stringifyError(error)}`,
      "error",
    );
    return FALLBACK_TO_DEFAULT_ON_ERROR ? undefined : { cancel: true };
  }
}

function summarizeEntryForBranch(entry: any): string[] {
  if (entry?.type === "message" && entry.message)
    return [serializeMessagesForSummary([entry.message])];
  if (entry?.type === "compaction" && typeof entry.summary === "string")
    return [`[Compaction summary]: ${entry.summary}`];
  if (entry?.type === "branch_summary" && typeof entry.summary === "string")
    return [`[Branch summary]: ${entry.summary}`];
  if (entry?.type === "custom_message")
    return [
      `[Custom message${entry.customType ? `:${entry.customType}` : ""}]: ${customMessageContentToText(entry.content) || "[empty]"}`,
    ];
  return [];
}

export async function handleBranchSummary(
  event: any,
  ctx: ExtensionContext,
): Promise<any> {
  if (!BRANCH_SUMMARY_ENABLED) return undefined;
  const preparation = event.preparation ?? {};
  if (preparation.userWantsSummary !== true) return undefined;
  const entries = Array.isArray(preparation.entriesToSummarize)
    ? preparation.entriesToSummarize
    : [];
  const conversationText = entries
    .flatMap(summarizeEntryForBranch)
    .join("\n\n")
    .trim();
  if (!conversationText) return undefined;
  compactionNotify(
    ctx,
    `Branch summary: summarizing ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`,
    "info",
  );
  try {
    const result = await generateCompactionSummary(ctx, {
      conversationText,
      customInstructions:
        event.customInstructions ?? preparation.customInstructions,
      purpose: "branch-summary",
      signal: event.signal,
    });
    if (!result.summary.trim()) throw new Error("Branch summary was empty");
    return {
      summary: {
        details: {
          entryCount: entries.length,
          model: result.model,
          profile: compactionProfile(),
          source: "dotpi",
        },
        summary: result.summary,
      },
    };
  } catch (error) {
    if (event.signal?.aborted) return undefined;
    compactionNotify(
      ctx,
      `Branch summary failed: ${stringifyError(error)}`,
      "error",
    );
    return undefined;
  }
}

function contextUsage(
  ctx: ExtensionContext,
): { contextWindow?: number; tokens: number } | undefined {
  const usage = ctx.getContextUsage?.() as
    | { tokens?: unknown; contextWindow?: unknown }
    | undefined;
  const tokens = Number(usage?.tokens);
  if (!Number.isFinite(tokens) || tokens <= 0) return undefined;
  const contextWindow = Number(usage?.contextWindow ?? ctx.model?.contextWindow);
  return {
    contextWindow:
      Number.isFinite(contextWindow) && contextWindow > 0
        ? contextWindow
        : undefined,
    tokens,
  };
}

export function compactionTriggerReason(
  ctx: ExtensionContext,
): string | undefined {
  const usage = contextUsage(ctx);
  if (!usage) return undefined;
  if (THRESHOLD_TOKENS > 0 && usage.tokens >= THRESHOLD_TOKENS)
    return `${usage.tokens.toLocaleString()} tokens >= ${Math.floor(THRESHOLD_TOKENS).toLocaleString()} token limit`;
  if (THRESHOLD_PERCENT > 0 && usage.contextWindow) {
    const percent = (usage.tokens / usage.contextWindow) * 100;
    if (percent >= THRESHOLD_PERCENT)
      return `${percent.toFixed(1)}% context >= ${THRESHOLD_PERCENT}% limit`;
  }
  if (usage.tokens >= IDLE_COMPACTION_THRESHOLD_TOKENS)
    return `${usage.tokens.toLocaleString()} tokens >= ${Math.floor(IDLE_COMPACTION_THRESHOLD_TOKENS).toLocaleString()} idle threshold`;
  return undefined;
}
