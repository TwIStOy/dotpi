import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { basename, join, resolve, dirname } from "node:path"
import { getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent"
import { BUILTIN_TOOL_NAMES } from "./agent-types.js"
import type { AgentConfig, MemoryScope, ThinkingLevel } from "./types.js"

export function loadCustomAgents(cwd: string, extraDirs?: string[]): Map<string, AgentConfig> {
  const globalDir = join(getAgentDir(), "agents")
  const projectDir = join(cwd, ".pi", "agents")
  const agents = new Map<string, AgentConfig>()
  loadFromDir(globalDir, agents, "global")
  for (const dir of extraDirs ?? []) {
    loadFromDir(dir, agents, "extension")
  }
  loadFromDir(projectDir, agents, "project")
  return agents
}

export function collectExtensionAgentDirs(
  extensions: string[],
  packages: Array<string | { source: string; agents?: string[] }>,
  cwd: string,
): string[] {
  const dirs: string[] = []

  for (const ext of extensions) {
    const extDir = resolveExtensionDir(ext, cwd)
    if (!extDir) continue
    const agentsDir = tryResolveAgentsFromPackageJson(extDir)
    if (agentsDir) {
      dirs.push(agentsDir)
    } else {
      const fallback = join(extDir, "agents")
      if (existsSync(fallback)) dirs.push(fallback)
    }
  }

  for (const pkg of packages) {
    const source = typeof pkg === "string" ? pkg : pkg.source
    if (typeof pkg === "object" && pkg.agents?.length) {
      for (const agentPath of pkg.agents) {
        dirs.push(resolve(cwd, agentPath))
      }
    }
    const pkgDir = resolvePackageDir(source, cwd)
    if (!pkgDir) continue
    const agentsDir = tryResolveAgentsFromPackageJson(pkgDir)
    if (agentsDir) dirs.push(agentsDir)
  }

  return [...new Set(dirs)]
}

function loadFromDir(dir: string, agents: Map<string, AgentConfig>, source: "project" | "global" | "extension"): void {
  if (!existsSync(dir)) return
  let files: string[]
  try {
    files = readdirSync(dir).filter(f => f.endsWith(".md"))
  } catch {
    return
  }
  for (const file of files) {
    const name = basename(file, ".md")
    let content: string
    try {
      content = readFileSync(join(dir, file), "utf-8")
    } catch {
      continue
    }
    const { frontmatter: fm, body } = parseFrontmatter<Record<string, unknown>>(content)
    agents.set(name, {
      name,
      displayName: str(fm.display_name),
      description: str(fm.description) ?? name,
      builtinToolNames: csvList(fm.tools, BUILTIN_TOOL_NAMES),
      disallowedTools: csvListOptional(fm.disallowed_tools),
      extensions: inheritField(fm.extensions ?? fm.inherit_extensions),
      skills: inheritField(fm.skills ?? fm.inherit_skills),
      model: str(fm.model),
      thinking: str(fm.thinking) as ThinkingLevel | undefined,
      maxTurns: nonNegativeInt(fm.max_turns),
      systemPrompt: body.trim(),
      promptMode: fm.prompt_mode === "append" ? "append" : "replace",
      inheritContext: fm.inherit_context != null ? fm.inherit_context === true : undefined,
      runInBackground: fm.run_in_background != null ? fm.run_in_background === true : undefined,
      isolated: fm.isolated != null ? fm.isolated === true : undefined,
      memory: parseMemory(fm.memory),
      isolation: fm.isolation === "worktree" ? "worktree" : undefined,
      enabled: fm.enabled !== false,
      source,
    })
  }
}

function str(val: unknown): string | undefined {
  return typeof val === "string" ? val : undefined
}

function nonNegativeInt(val: unknown): number | undefined {
  return typeof val === "number" && val >= 0 ? val : undefined
}

function parseCsvField(val: unknown): string[] | undefined {
  if (val === undefined || val === null) return undefined
  const s = String(val).trim()
  if (!s || s === "none") return undefined
  const items = s.split(",").map(t => t.trim()).filter(Boolean)
  return items.length > 0 ? items : undefined
}

function csvList(val: unknown, defaults: string[]): string[] {
  if (val === undefined || val === null) return defaults
  return parseCsvField(val) ?? []
}

function csvListOptional(val: unknown): string[] | undefined {
  return parseCsvField(val)
}

function parseMemory(val: unknown): MemoryScope | undefined {
  if (val === "user" || val === "project" || val === "local") return val
  return undefined
}

function inheritField(val: unknown): true | string[] | false {
  if (val === undefined || val === null || val === true) return true
  if (val === false || val === "none") return false
  const items = csvList(val, [])
  return items.length > 0 ? items : false
}

function resolveExtensionDir(extPath: string, cwd: string): string | undefined {
  const resolved = resolve(cwd, extPath)
  if (!existsSync(resolved)) return undefined
  const stat = tryStat(resolved)
  if (!stat) return undefined
  return stat.isFile() ? dirname(resolved) : resolved
}

function resolvePackageDir(source: string, cwd: string): string | undefined {
  if (source.startsWith("npm:") || source.startsWith("github:") || source.startsWith("git:")) {
    const pkgName = source.replace(/^npm:/, "").replace(/^github:/, "").replace(/^git:/, "")
    const tryPaths = [
      join(cwd, "node_modules", pkgName),
      join(cwd, "..", "node_modules", pkgName),
    ]
    for (const p of tryPaths) {
      if (existsSync(p)) return p
    }
    return undefined
  }
  const resolved = resolve(cwd, source)
  return existsSync(resolved) ? resolved : undefined
}

function tryResolveAgentsFromPackageJson(dir: string): string | undefined {
  const pkgPath = join(dir, "package.json")
  if (!existsSync(pkgPath)) return undefined
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
    const piAgents = pkg?.pi?.agents
    if (typeof piAgents === "string") return resolve(dir, piAgents)
    if (Array.isArray(piAgents)) return resolve(dir, piAgents[0])
  } catch { /* no package.json */ }
  return undefined
}

function tryStat(path: string): { isFile(): boolean; isDirectory(): boolean } | undefined {
  try {
    return statSync(path)
  } catch {
    return undefined
  }
}

export function getAgentFilePath(cwd: string, name: string, scope: "project" | "global"): string {
  const base = scope === "project" ? join(cwd, ".pi", "agents") : join(getAgentDir(), "agents")
  return join(base, `${name}.md`)
}
