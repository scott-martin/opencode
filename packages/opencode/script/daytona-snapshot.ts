#!/usr/bin/env bun

import { Daytona, Image } from "@daytonaio/sdk"
import pkg from "../package.json"

function num(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

async function exists(path: string) {
  return Bun.file(path).exists()
}

async function createImage() {
  const dockerfile = process.env.OPENCODE_DAYTONA_DOCKERFILE
  if (dockerfile) {
    const ok = await exists(dockerfile)
    if (!ok) {
      console.error(`Dockerfile not found: ${dockerfile}`)
      process.exit(1)
    }
    return Image.fromDockerfile(dockerfile)
  }

  const base = process.env.OPENCODE_DAYTONA_BASE_IMAGE || "node:22-bookworm-slim"
  const version = process.env.OPENCODE_VERSION || pkg.version
  const repo = process.env.OPENCODE_DAYTONA_REPO || "https://github.com/anomalyco/opencode.git"
  const repoDir = process.env.OPENCODE_DAYTONA_REPO_DIR || "/home/daytona/opencode"

  const install = [
    "set -euo pipefail",
    "set +o braceexpand",
    "apt-get update",
    "apt-get install -y --no-install-recommends git ripgrep ca-certificates curl zsh",
    "rm -rf /var/lib/apt/lists/*",
    "command -v zsh >/dev/null 2>&1",
    "test -x /usr/bin/zsh",
    "mkdir -p /home/daytona",
    "id -u daytona >/dev/null 2>&1 || useradd -m -d /home/daytona daytona",
    "touch /home/daytona/.zshrc",
    `git clone --depth 1 ${repo} ${repoDir}`,
    "mkdir -p /home/daytona/.config/opencode",
    'printf %s {"autoupdate":false,"keybinds":{"app_exit":"none","terminal_suspend":"none"}} > /home/daytona/.config/opencode/opencode.json',
    `npm i -g opencode-ai@${version}`,
    "opencode --version",
    "chown -R daytona:daytona /home/daytona",
  ].join(" && ")

  return Image.base(base)
    .env({
      TERM: "xterm-256color",
      LANG: "en_US.UTF-8",
      HOME: "/home/daytona",
      OPENCODE_DISABLE_AUTOUPDATE: "1",
      BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0",
    })
    .workdir("/home/daytona")
    .runCommands(["bash", "-lc", install])
    .dockerfileCommands(["USER daytona"])
}

async function main() {
  const apiKey = process.env.DAYTONA_API_KEY
  if (!apiKey) {
    console.error("Missing DAYTONA_API_KEY")
    process.exit(1)
  }

  const name = process.env.DAYTONA_SNAPSHOT_NAME || `opencode-${pkg.version}`
  const cpu = num(process.env.DAYTONA_SNAPSHOT_CPU, 2)
  const memory = num(process.env.DAYTONA_SNAPSHOT_MEMORY, 4)
  const disk = num(process.env.DAYTONA_SNAPSHOT_DISK, 10)
  const timeout = num(process.env.DAYTONA_SNAPSHOT_TIMEOUT, 0)

  const daytona = new Daytona({ apiKey })
  const image = await createImage()

  const snapshot = await daytona.snapshot.create(
    {
      name,
      image,
      resources: {
        cpu,
        memory,
        disk,
      },
    },
    {
      onLogs: (chunk: string) => process.stdout.write(chunk),
      timeout,
    },
  )

  const active =
    snapshot.state === "active" ? snapshot : await daytona.snapshot.activate(snapshot).catch(() => snapshot)

  console.log("\nSnapshot ready:")
  console.log(`- name: ${active.name}`)
  console.log(`- image: ${active.imageName}`)
  console.log(`- state: ${active.state}`)
  console.log("\nUse it with:")
  console.log(`DAYTONA_OPENCODE_SNAPSHOT=${active.name}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
