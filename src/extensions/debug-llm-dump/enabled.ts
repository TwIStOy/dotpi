import { existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";

import { DEBUG_DUMP_DIR, DEBUG_DUMP_ENABLED_FILE } from "./constants.js";

function envOverride(): boolean | undefined {
  const v = process.env.DOTPI_DEBUG_DUMP_LLM?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return undefined;
}

/** Whether to write dumps for the next provider request. */
export function isLlmDumpEnabled(): boolean {
  const fromEnv = envOverride();
  if (fromEnv !== undefined) return fromEnv;
  try {
    return existsSync(DEBUG_DUMP_ENABLED_FILE);
  } catch {
    return false;
  }
}

export async function setLlmDumpEnabled(on: boolean): Promise<void> {
  await mkdir(DEBUG_DUMP_DIR, { recursive: true });
  if (on) {
    await writeFile(DEBUG_DUMP_ENABLED_FILE, "1\n", "utf8");
  } else {
    try {
      await unlink(DEBUG_DUMP_ENABLED_FILE);
    } catch {
      // ignore missing
    }
  }
}

export function describeLlmDumpToggle(): string {
  const fromEnv = envOverride();
  const fileOn = (() => {
    try {
      return existsSync(DEBUG_DUMP_ENABLED_FILE);
    } catch {
      return false;
    }
  })();
  const parts = [
    `Directory: ~/.dotpi/debug-dump`,
    `File toggle: ${fileOn ? "on" : "off"} (${DEBUG_DUMP_ENABLED_FILE})`,
    `Env DOTPI_DEBUG_DUMP_LLM: ${
      fromEnv === undefined
        ? "(unset — file toggle applies)"
        : fromEnv
          ? "forced on"
          : "forced off"
    }`,
    `Effective: ${isLlmDumpEnabled() ? "dumping ON" : "dumping OFF"}`,
  ];
  return parts.join("\n");
}
