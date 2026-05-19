import { existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { isUnsafeName, isSymlink, safeReadFile } from "./security.js"
import type { MemoryScope } from "./types.js"

const MAX_MEMORY_LINES = 200

export function resolveMemoryDir(agentName: string, scope: MemoryScope, cwd: string): string {
  if (isUnsafeName(agentName)) {
    throw new Error(`Unsafe agent name for memory directory: "${agentName}"`)
  }
  switch (scope) {
    case "user":
      return join(homedir(), ".pi", "agent-memory", agentName)
    case "project":
      return join(cwd, ".pi", "agent-memory", agentName)
    case "local":
      return join(cwd, ".pi", "agent-memory-local", agentName)
  }
}

export function ensureMemoryDir(memoryDir: string): void {
  if (existsSync(memoryDir)) {
    if (isSymlink(memoryDir)) {
      throw new Error(`Refusing to use symlinked memory directory: ${memoryDir}`)
    }
    return
  }
  mkdirSync(memoryDir, { recursive: true })
}

export function readMemoryIndex(memoryDir: string): string | undefined {
  if (isSymlink(memoryDir)) return undefined

  const memoryFile = join(memoryDir, "MEMORY.md")
  const content = safeReadFile(memoryFile)
  if (content === undefined) return undefined

  const lines = content.split("\n")
  if (lines.length > MAX_MEMORY_LINES) {
    return lines.slice(0, MAX_MEMORY_LINES).join("\n") + "\n... (truncated at 200 lines)"
  }
  return content
}

export function buildMemoryBlock(agentName: string, scope: MemoryScope, cwd: string): string {
  const memoryDir = resolveMemoryDir(agentName, scope, cwd)
  ensureMemoryDir(memoryDir)

  const existingMemory = readMemoryIndex(memoryDir)

  const header = `# Agent Memory

You have a persistent memory directory at: ${memoryDir}/
Memory scope: ${scope}

This memory persists across sessions. Use it to build up knowledge over time.`

  const memoryContent = existingMemory
    ? `\n\n## Current MEMORY.md\n${existingMemory}`
    : `\n\nNo MEMORY.md exists yet. Create one at ${join(memoryDir, "MEMORY.md")} to start building persistent memory.`

  const instructions = `

## Memory Instructions
- MEMORY.md is an index file — keep it concise (under 200 lines). Lines after 200 are truncated.
- Store detailed memories in separate files within ${memoryDir}/ and link to them from MEMORY.md.
- Each memory file should use this frontmatter format:
  \`\`\`markdown
  ---
  name: <memory name>
  description: <one-line description>
  type: <user|feedback|project|reference>
  ---
  <memory content>
  \`\`\`
- Update or remove memories that become outdated. Check for existing memories before creating duplicates.
- You have Read, Write, and Edit tools available for managing memory files.`

  return header + memoryContent + instructions
}

export function buildReadOnlyMemoryBlock(agentName: string, scope: MemoryScope, cwd: string): string {
  const memoryDir = resolveMemoryDir(agentName, scope, cwd)
  const existingMemory = readMemoryIndex(memoryDir)

  const header = `# Agent Memory (read-only)

Memory scope: ${scope}
You have read-only access to memory. You can reference existing memories but cannot create or modify them.`

  const memoryContent = existingMemory
    ? `\n\n## Current MEMORY.md\n${existingMemory}`
    : "\n\nNo memory is available yet. Other agents or sessions with write access can create memories for you to consume."

  return header + memoryContent
}
