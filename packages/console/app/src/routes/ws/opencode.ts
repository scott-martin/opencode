import { defineWebSocketHandler } from "h3"
import { Daytona } from "@daytonaio/sdk"

type ClientMessage =
  | {
      type: "init"
      cols: number
      rows: number
    }
  | {
      type: "resize"
      cols: number
      rows: number
    }
  | {
      type: "input"
      data: string
    }

type ServerMessage =
  | {
      type: "output"
      data: string
    }
  | {
      type: "error"
      data: string
    }

type Session = {
  sandbox: Awaited<ReturnType<Daytona["create"]>>
  pty: Awaited<ReturnType<Awaited<ReturnType<Daytona["create"]>>["process"]["createPty"]>>
  ready: boolean
  pendingInput: string[]
  pendingSize?: { cols: number; rows: number }
}

const sessions = new Map<string, Session>()
const decoder = new TextDecoder()

function safeSend(peer: { send: (data: string) => void }, message: ServerMessage) {
  try {
    peer.send(JSON.stringify(message))
  } catch {}
}

function parseMessage(input: string): ClientMessage | undefined {
  try {
    return JSON.parse(input) as ClientMessage
  } catch {
    return
  }
}

async function cleanup(id: string) {
  const session = sessions.get(id)
  if (!session) return
  sessions.delete(id)

  await session.pty.kill().catch(() => {})
  await session.pty.disconnect().catch(() => {})
  await session.sandbox.delete().catch(() => {})
}

export default defineWebSocketHandler({
  async open(peer: any) {
    console.log("[ws/opencode] open", peer.id)

    const apiKey = process.env.DAYTONA_API_KEY
    if (!apiKey) {
      safeSend(peer, {
        type: "error",
        data: "OpenCode demo is not configured (missing DAYTONA_API_KEY).",
      })
      peer.close(1011, "Missing DAYTONA_API_KEY")
      return
    }

    safeSend(peer, {
      type: "output",
      data: "\r\nStarting a fresh Daytona sandbox…\r\n",
    })

    const daytona = new Daytona({ apiKey })
    const snapshot = process.env.DAYTONA_OPENCODE_SNAPSHOT

    const sandbox = await (snapshot ? daytona.create({ snapshot }) : daytona.create()).catch((error) => {
      console.error("[ws/opencode] failed to create sandbox", peer.id, error)
      safeSend(peer, {
        type: "error",
        data: "Failed to start demo sandbox.",
      })
      peer.close(1011, "Failed to create sandbox")
      return
    })
    if (!sandbox) return

    const pty = await sandbox.process
      .createPty({
        id: `opencode-${peer.id}`,
        cwd: "/home/daytona",
        cols: 120,
        rows: 30,
        envs: {
          TERM: "xterm-256color",
          LANG: "en_US.UTF-8",
        },
        onData: (data: Uint8Array) => {
          safeSend(peer, {
            type: "output",
            data: decoder.decode(data),
          })
        },
      })
      .catch((error) => {
        console.error("[ws/opencode] failed to create pty", peer.id, error)
        safeSend(peer, {
          type: "error",
          data: "Failed to start demo terminal.",
        })
        peer.close(1011, "Failed to create terminal")
        return
      })

    if (!pty) {
      await sandbox.delete().catch(() => {})
      return
    }

    const session: Session = {
      sandbox,
      pty,
      ready: false,
      pendingInput: [],
    }
    sessions.set(peer.id, session)

    const connected = await pty
      .waitForConnection()
      .then(() => true)
      .catch((error) => {
        console.error("[ws/opencode] failed to connect pty", peer.id, error)
        safeSend(peer, {
          type: "error",
          data: "Failed to connect to the sandbox terminal.",
        })
        peer.close(1011, "Failed to connect terminal")
        return false
      })

    if (!connected) {
      await cleanup(peer.id)
      return
    }

    session.ready = true

    if (session.pendingSize) {
      await pty.resize(session.pendingSize.cols, session.pendingSize.rows).catch(() => {})
      session.pendingSize = undefined
    }

    for (const input of session.pendingInput) {
      await pty.sendInput(input).catch(() => {})
    }
    session.pendingInput.length = 0

    safeSend(peer, {
      type: "output",
      data: "\r\nLaunching OpenCode…\r\n",
    })

    await pty
      .sendInput(
        'if ! command -v opencode >/dev/null 2>&1; then echo "Installing OpenCode…"; npm i -g opencode-ai; fi\n',
      )
      .catch(() => {})
    await pty.sendInput("opencode\n").catch(() => {})
  },

  async message(peer: any, msg: any) {
    const session = sessions.get(peer.id)
    if (!session) return

    const payload = parseMessage(msg.text())
    if (!payload) return

    if (payload.type === "input") {
      if (!session.ready) {
        session.pendingInput.push(payload.data)
        return
      }
      await session.pty.sendInput(payload.data).catch(() => {})
      return
    }

    if (!session.ready) {
      session.pendingSize = { cols: payload.cols, rows: payload.rows }
      return
    }

    await session.pty.resize(payload.cols, payload.rows).catch(() => {})
  },

  async close(peer: any) {
    console.log("[ws/opencode] close", peer.id)
    await cleanup(peer.id)
  },

  async error(peer: any, error: any) {
    console.error("[ws/opencode] error", peer.id, error)
    await cleanup(peer.id)
  },
})
