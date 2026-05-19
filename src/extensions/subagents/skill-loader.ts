import type { Dirent } from "node:fs"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { getAgentDir } from "@earendil-works/pi-coding-agent"
import { isSymlink, isUnsafeName, safeReadFile } from "./security.js"

export interface PreloadedSkill {
  name: string
  content: string
}

const STANDARD_ROOTS = (cwd: string) => [
  join(cwd, ".pi", "skills"),
  join(cwd, ".agents", "skills"),
  join(getAgentDir(), "skills"),
  join(homedir(), ".agents", "skills"),
  join(homedir(), ".pi", "skills"),
]

export function preloadSkills(
  skillNames: string[],
  cwd: string,
  extraRoots?: string[],
): PreloadedSkill[] {
  return skillNames.map(name => ({ name, content: loadSkillContent(name, cwd, extraRoots) }))
}

function loadSkillContent(name: string, cwd: string, extraRoots?: string[]): string {
  if (isUnsafeName(name)) {
    return `(Skill "${name}" skipped: name contains path traversal characters)`
  }
  const roots = [...(extraRoots ?? []), ...STANDARD_ROOTS(cwd)]
  for (const root of roots) {
    const content = findInRoot(root, name)
    if (content !== undefined) return content
  }
  return `(Skill "${name}" not found)`
}

export function collectExtensionSkillRoots(
  extensions: string[],
  packages: Array<string | { source: string; skills?: string[] }>,
  cwd: string,
): string[] {
  const roots: string[] = []

  for (const ext of extensions) {
    const extDir = resolveExtensionDir(ext, cwd)
    if (!extDir) continue
    const skillsDir = tryResolveSkillsFromPackageJson(extDir)
    if (skillsDir) {
      roots.push(skillsDir)
    } else {
      const fallback = join(extDir, "skills")
      if (existsSync(fallback)) roots.push(fallback)
    }
  }

  for (const pkg of packages) {
    const source = typeof pkg === "string" ? pkg : pkg.source
    if (typeof pkg === "object" && pkg.skills?.length) {
      for (const skillPath of pkg.skills) {
        roots.push(resolve(cwd, skillPath))
      }
    }
    const pkgDir = resolvePackageDir(source, cwd)
    if (!pkgDir) continue
    const skillsDir = tryResolveSkillsFromPackageJson(pkgDir)
    if (skillsDir) roots.push(skillsDir)
  }

  return [...new Set(roots)]
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

function tryResolveSkillsFromPackageJson(dir: string): string | undefined {
  const pkgPath = join(dir, "package.json")
  if (!existsSync(pkgPath)) return undefined
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
    const piSkills = pkg?.pi?.skills
    if (typeof piSkills === "string") return resolve(dir, piSkills)
    if (Array.isArray(piSkills)) return resolve(dir, piSkills[0])
  } catch {}
  return undefined
}

function tryStat(path: string): { isFile(): boolean; isDirectory(): boolean } | undefined {
  try {
    return require("node:fs").statSync(path)
  } catch {
    return undefined
  }
}

function findInRoot(root: string, name: string): string | undefined {
  if (isSymlink(root)) return undefined
  const flat = safeReadFile(join(root, `${name}.md`))?.trim()
  if (flat !== undefined) return flat
  return findSkillDirectory(root, name)
}

function findSkillDirectory(root: string, name: string): string | undefined {
  if (!existsSync(root)) return undefined
  const queue: string[] = [root]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) continue

    let entries: Dirent<string>[]
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }

    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue

      const path = join(current, entry.name)
      const skillMd = join(path, "SKILL.md")
      const isSkillDir = existsSync(skillMd)

      if (isSkillDir) {
        if (entry.name === name) {
          const content = safeReadFile(skillMd)?.trim()
          if (content !== undefined) return content
        }
        continue
      }

      queue.push(path)
    }
  }
  return undefined
}
