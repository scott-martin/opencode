import path from "path"
import z from "zod"
import { Config } from "../config/config"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"
import { NamedError } from "@opencode-ai/util/error"
import { ConfigMarkdown } from "../config/markdown"
import { Log } from "../util/log"

export namespace Skill {
  const log = Log.create({ service: "skill" })

  // Name: 1-64 chars, lowercase alphanumeric and hyphens, no consecutive hyphens, can't start/end with hyphen
  const NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

  export const Frontmatter = z.object({
    name: z
      .string()
      .min(1)
      .max(64)
      .refine((val) => NAME_REGEX.test(val), {
        message:
          "Name must be lowercase alphanumeric with hyphens, no consecutive hyphens, cannot start or end with hyphen",
      }),
    description: z.string().min(1).max(1024),
    license: z.string().optional(),
    compatibility: z.string().max(500).optional(),
    metadata: z.record(z.string(), z.string()).optional(),
  })

  export type Frontmatter = z.infer<typeof Frontmatter>

  export interface Info {
    id: string // Path-based identifier (e.g., "code-review" or "docs/api-guide")
    name: string
    description: string
    location: string
    license?: string
    compatibility?: string
    metadata?: Record<string, string>
  }

  export const InvalidError = NamedError.create(
    "SkillInvalidError",
    z.object({
      path: z.string(),
      message: z.string().optional(),
      issues: z.custom<z.core.$ZodIssue[]>().optional(),
    }),
  )

  export const NameMismatchError = NamedError.create(
    "SkillNameMismatchError",
    z.object({
      path: z.string(),
      expected: z.string(),
      actual: z.string(),
    }),
  )

  const SKILL_GLOB = new Bun.Glob("skill/**/SKILL.md")
  // const CLAUDE_SKILL_GLOB = new Bun.Glob("*/SKILL.md")

  interface DiscoveredSkill {
    path: string
    baseDir: string // The skill/ or .claude/skills/ directory
  }

  async function discover(): Promise<DiscoveredSkill[]> {
    const directories = await Config.directories()

    const results: DiscoveredSkill[] = []

    // Scan skill/ subdirectory in config directories (.opencode/, ~/.opencode/, etc.)
    for (const dir of directories) {
      const baseDir = path.join(dir, "skill")
      for await (const match of SKILL_GLOB.scan({
        cwd: dir,
        absolute: true,
        onlyFiles: true,
        followSymlinks: true,
      })) {
        results.push({ path: match, baseDir })
      }
    }

    // Also scan .claude/skills/ walking up from cwd to worktree
    // for await (const dir of Filesystem.up({
    //   targets: [".claude/skills"],
    //   start: Instance.directory,
    //   stop: Instance.worktree,
    // })) {
    //   for await (const match of CLAUDE_SKILL_GLOB.scan({
    //     cwd: dir,
    //     absolute: true,
    //     onlyFiles: true,
    //     followSymlinks: true,
    //   })) {
    //     paths.push(match)
    //   }
    // }

    return results
  }

  async function load(discovered: DiscoveredSkill): Promise<Info> {
    const skillMdPath = discovered.path
    const md = await ConfigMarkdown.parse(skillMdPath)
    if (!md.data) {
      throw new InvalidError({
        path: skillMdPath,
        message: "SKILL.md must have YAML frontmatter",
      })
    }

    const parsed = Frontmatter.safeParse(md.data)
    if (!parsed.success) {
      throw new InvalidError({
        path: skillMdPath,
        issues: parsed.error.issues,
      })
    }

    const frontmatter = parsed.data
    const skillDir = path.dirname(skillMdPath)
    const dirName = path.basename(skillDir)

    if (frontmatter.name !== dirName) {
      throw new NameMismatchError({
        path: skillMdPath,
        expected: dirName,
        actual: frontmatter.name,
      })
    }

    // Generate path-based ID from relative path
    // e.g., baseDir=/path/skill, skillDir=/path/skill/docs/api-guide → id=docs/api-guide
    const relativePath = path.relative(discovered.baseDir, skillDir)
    const id = relativePath.split(path.sep).join("/") // Normalize to forward slashes

    return {
      id,
      name: frontmatter.name,
      description: frontmatter.description,
      location: skillMdPath,
      license: frontmatter.license,
      compatibility: frontmatter.compatibility,
      metadata: frontmatter.metadata,
    }
  }

  export const state = Instance.state(async () => {
    const discovered = await discover()
    const skills: Info[] = []

    for (const item of discovered) {
      const info = await load(item)
      log.info("loaded skill", { id: info.id, name: info.name, location: info.location })
      skills.push(info)
    }

    return skills
  })

  export async function all(): Promise<Info[]> {
    return state()
  }
}
