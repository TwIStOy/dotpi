import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

export interface WorktreeInfo {
  path: string;
  branch: string;
}

export interface WorktreeResult {
  hasChanges: boolean;
  branch?: string;
}

function git(args: string[], cwd: string): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      timeout: 30_000,
    }).trim();
  } catch (err: any) {
    throw new Error(`git ${args.join(" ")} failed: ${err.message ?? err}`, {
      cause: err,
    });
  }
}

function gitCheck(args: string[], cwd: string): string | null {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      timeout: 30_000,
    }).trim();
  } catch {
    return null;
  }
}

export function createWorktree(
  cwd: string,
  agentId: string,
): WorktreeInfo | null {
  const isGit = gitCheck(["rev-parse", "--is-inside-work-tree"], cwd);
  if (isGit !== "true") return null;

  const hasCommits = gitCheck(["rev-parse", "HEAD"], cwd);
  if (!hasCommits) return null;

  const shortId = agentId.slice(0, 8);
  const branchName = `pi-agent/${shortId}`;

  try {
    git(
      [
        "worktree",
        "add",
        "--detach",
        "--checkout",
        "-b",
        branchName,
        `--orphan`,
        branchName,
      ],
      cwd,
    );
  } catch {
    try {
      const tmpPath = join(cwd, `.git-worktree-${shortId}`);
      git(["worktree", "add", "-b", branchName, tmpPath, "HEAD"], cwd);
      return { path: tmpPath, branch: branchName };
    } catch {
      try {
        const tmpPath = join(cwd, `.git-worktree-${shortId}`);
        git(["worktree", "add", "--detach", tmpPath], cwd);
        git(["checkout", "-b", branchName], tmpPath);
        return { path: tmpPath, branch: branchName };
      } catch {
        return null;
      }
    }
  }

  try {
    const worktrees = git(["worktree", "list", "--porcelain"], cwd);
    const match = worktrees
      .split("\n")
      .find((l) => l.startsWith("worktree ") && l.includes(branchName));
    if (match) {
      const wtPath = match.replace("worktree ", "");
      return { path: wtPath, branch: branchName };
    }
  } catch {
    /* no existing worktree */
  }

  return null;
}

export function cleanupWorktree(
  cwd: string,
  worktree: WorktreeInfo,
  description: string,
): WorktreeResult {
  const result: WorktreeResult = { hasChanges: false };

  try {
    const status = git(["status", "--porcelain"], worktree.path);
    if (status.trim().length > 0) {
      result.hasChanges = true;

      try {
        git(["add", "-A"], worktree.path);
        const commitMsg = description.slice(0, 72) || "agent changes";
        git(["commit", "-m", commitMsg, "--no-gpg-sign"], worktree.path);
      } catch {
        /* best-effort commit */
      }

      result.branch = worktree.branch;
    }
  } catch {
    /* best-effort status check */
  }

  try {
    git(["worktree", "remove", "--force", worktree.path], cwd);
  } catch {
    try {
      if (existsSync(worktree.path)) {
        rmSync(worktree.path, { recursive: true, force: true });
      }
      git(["worktree", "prune"], cwd);
    } catch {
      /* best-effort cleanup */
    }
  }

  return result;
}

export function pruneWorktrees(cwd: string): void {
  gitCheck(["worktree", "prune"], cwd);
}
