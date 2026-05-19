import { isAbsolute, normalize, resolve } from "node:path";
import type { ExtensionContext, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { rejectedReadAgenixMessage } from "../constants.js";
import { READ_BLOCKED_PATH_PREFIXES } from "../settings.js";
import type { BlockedToolCall } from "../types.js";

function resolvedReadPath(rawPath: string, cwd: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) return "";
  return normalize(isAbsolute(trimmed) ? trimmed : resolve(cwd, trimmed));
}

function isUnderPrefix(resolvedPath: string, prefix: string): boolean {
  const p = normalize(prefix);
  if (!p) return false;
  return resolvedPath === p || resolvedPath.startsWith(`${p}/`);
}

/**
 * Blocks `read` when the resolved path is under a configured prefix
 * (agenix decrypted secrets under `/run/agenix/`).
 */
export function readBlockedPrefixesGate(
  ctx: ExtensionContext,
  event: ToolCallEvent,
): BlockedToolCall | undefined {
  if (event.toolName !== "read") return undefined;
  const raw = typeof event.input.path === "string" ? event.input.path : "";
  if (!raw.trim()) return undefined;
  const cwd = typeof ctx.cwd === "string" && ctx.cwd ? ctx.cwd : process.cwd();
  const abs = resolvedReadPath(raw, cwd);
  for (const prefix of READ_BLOCKED_PATH_PREFIXES) {
    if (!prefix.trim()) continue;
    if (isUnderPrefix(abs, prefix)) {
      const quoted = raw.trim() || abs;
      return {
        block: true,
        reason: rejectedReadAgenixMessage(quoted),
      };
    }
  }
  return undefined;
}
