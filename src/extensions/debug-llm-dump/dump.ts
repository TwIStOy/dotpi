import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { DEBUG_DUMP_DIR } from "./constants.js";

let seq = 0;

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (first) {
    try {
      return JSON.stringify(
        value,
        (_key, v) => {
          if (typeof v === "bigint") return v.toString();
          return v;
        },
        2,
      );
    } catch {
      return JSON.stringify(
        { error: "payload not JSON-serializable", message: String(first) },
        null,
        2,
      );
    }
  }
}

/**
 * Writes provider payload to ~/.dotpi/debug-dump asynchronously (does not block the LLM call).
 */
export function scheduleProviderPayloadDump(
  payload: unknown,
  ctx: ExtensionContext,
): void {
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${++seq}-${randomBytes(4).toString("hex")}`;
  const sessionId = (() => {
    try {
      return ctx.sessionManager.getSessionId();
    } catch {
      return "unknown-session";
    }
  })();
  const model = ctx.model;
  const envelope = {
    dumpedAt: new Date().toISOString(),
    cwd: ctx.cwd,
    sessionId,
    model:
      model != null
        ? { provider: model.provider, id: model.id, name: model.name }
        : null,
    payload,
  };
  const body = safeJson(envelope);
  const file = join(DEBUG_DUMP_DIR, `${id}.json`);

  void (async () => {
    try {
      await mkdir(DEBUG_DUMP_DIR, { recursive: true });
      await writeFile(file, body, "utf8");
    } catch {
      // Best-effort debug dump; avoid impacting the agent.
    }
  })();
}
