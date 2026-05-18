export interface WorktreeInfo {
  path: string
  branch: string
}

export interface WorktreeResult {
  hasChanges: boolean
  branch?: string
}

export function createWorktree(_cwd: string, _agentId: string): WorktreeInfo | null {
  return null
}

export function cleanupWorktree(_cwd: string, _worktree: WorktreeInfo, _description: string): WorktreeResult {
  return { hasChanges: false }
}

export function pruneWorktrees(_cwd: string): void {}
