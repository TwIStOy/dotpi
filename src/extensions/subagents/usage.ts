import type { LifetimeUsage } from "./types.js"

export type { LifetimeUsage }

export function getLifetimeTotal(u?: LifetimeUsage): number {
  return u ? u.input + u.output + u.cacheWrite : 0
}

export function addUsage(into: LifetimeUsage, delta: LifetimeUsage): void {
  into.input += delta.input
  into.output += delta.output
  into.cacheWrite += delta.cacheWrite
}

export type SessionStatsLike = {
  tokens: { input: number; output: number; cacheWrite: number }
  contextUsage?: { percent: number | null }
}
export type SessionLike = { getSessionStats(): SessionStatsLike }

export function getSessionTokens(session: SessionLike | undefined): number {
  if (!session) return 0
  try {
    const t = session.getSessionStats().tokens
    return t.input + t.output + t.cacheWrite
  } catch {
    return 0
  }
}

export function getSessionContextPercent(session: SessionLike | undefined): number | null {
  if (!session) return null
  try {
    return session.getSessionStats().contextUsage?.percent ?? null
  } catch {
    return null
  }
}
