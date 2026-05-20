/**
 * CLI runner — spawns the dotcode Rust CLI binary with --json output.
 */
import { execFile as execFileCb } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

let cachedBinaryPath: string | undefined;

function extensionDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export function getDotcodeBinaryPath(): string {
  return findBinary();
}

function findBinary(): string {
  if (cachedBinaryPath) return cachedBinaryPath;

  if (process.env.DOTCODE_CLI) {
    cachedBinaryPath = process.env.DOTCODE_CLI;
    return cachedBinaryPath;
  }

  let dir = resolve(extensionDir());
  for (let i = 0; i < 10; i++) {
    for (const variant of ["release", "debug"]) {
      const candidate = join(dir, "tool", "target", variant, "dotcode");
      if (existsSync(candidate)) {
        cachedBinaryPath = candidate;
        return cachedBinaryPath;
      }
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  dir = resolve(extensionDir());
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "result", "bin", "dotcode");
    if (existsSync(candidate)) {
      cachedBinaryPath = candidate;
      return cachedBinaryPath;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  cachedBinaryPath = "dotcode";
  return cachedBinaryPath;
}

export async function runDotcode(args: string[]): Promise<unknown> {
  const bin = findBinary();
  try {
    const { stdout } = await execFile(bin, ["--json", ...args], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string };
    const message = err.stderr?.trim() || err.message || String(e);
    throw new Error(message, e instanceof Error ? { cause: e } : undefined);
  }
}