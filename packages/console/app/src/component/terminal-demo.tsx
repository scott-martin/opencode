import type { Ghostty, Terminal as Term, FitAddon } from "ghostty-web"
import { Show, createSignal, onCleanup } from "solid-js"

type TerminalColors = {
  background: string
  foreground: string
  cursor: string
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

const DEFAULT_TERMINAL_COLORS: Record<"light" | "dark", TerminalColors> = {
  light: {
    background: "#fcfcfc",
    foreground: "#211e1e",
    cursor: "#211e1e",
  },
  dark: {
    background: "#191515",
    foreground: "#d4d4d4",
    cursor: "#d4d4d4",
  },
}

const TUI_BOOT_MARKERS = ["\u001b[?1049h", "\u001b[?1047h", "\u001b[?47h", "\u001b[?25l"]

function looksLikeTuiBoot(output: string) {
  return TUI_BOOT_MARKERS.some((marker) => output.includes(marker))
}

function getWebSocketUrl() {
  const url = new URL(window.location.href)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = "/ws/opencode"
  url.search = ""
  url.hash = ""
  return url.toString()
}

function getTerminalColors(): TerminalColors {
  if (typeof window === "undefined") return DEFAULT_TERMINAL_COLORS.light
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches
  return dark ? DEFAULT_TERMINAL_COLORS.dark : DEFAULT_TERMINAL_COLORS.light
}

function parseServerMessage(input: unknown): ServerMessage | undefined {
  if (typeof input !== "string") return
  try {
    return JSON.parse(input) as ServerMessage
  } catch {
    return
  }
}

export function TerminalDemo() {
  let container!: HTMLDivElement
  const [started, setStarted] = createSignal(false)
  const [booted, setBooted] = createSignal(false)
  const [phase, setPhase] = createSignal<"sandbox" | "opencode">("sandbox")
  const [status, setStatus] = createSignal<"idle" | "connecting" | "running" | "error">("idle")

  let ghostty: Ghostty | undefined
  let term: Term | undefined
  let fitAddon: FitAddon | undefined
  let ws: WebSocket | undefined
  let handleResize: (() => void) | undefined
  let bootTimeout: number | undefined

  const send = (message: ClientMessage) => {
    if (ws?.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(message))
  }

  const isLoading = () => started() && !booted() && status() !== "error"

  const fitTerminal = () => {
    fitAddon?.fit()
    if (!term) return
    send({ type: "resize", cols: term.cols, rows: term.rows })
    term.focus()
  }

  const fitAfterPaint = () => {
    requestAnimationFrame(() => {
      fitTerminal()
      requestAnimationFrame(fitTerminal)
    })
  }

  const markBooted = () => {
    if (booted()) return
    setBooted(true)
    if (bootTimeout) {
      window.clearTimeout(bootTimeout)
      bootTimeout = undefined
    }
    fitAfterPaint()
  }

  const updatePhaseFromOutput = (output: string) => {
    if (output.includes("Starting a fresh sandbox")) {
      setPhase("sandbox")
    }
    if (output.includes("Launching OpenCode")) {
      setPhase("opencode")
    }
  }

  const loadingTitle = () => {
    if (status() === "connecting") return "Connecting…"
    if (phase() === "opencode") return "Launching OpenCode…"
    return "Starting sandbox…"
  }

  const loadingSubtitle = () => {
    if (phase() === "opencode") return "Booting the terminal UI"
    return "Provisioning a fresh sandbox"
  }

  const start = async () => {
    if (started()) return
    setStarted(true)
    setBooted(false)
    setPhase("sandbox")
    setStatus("connecting")

    const mod = await import("ghostty-web")
    ghostty = await mod.Ghostty.load()

    term = new mod.Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "IBM Plex Mono, monospace",
      allowTransparency: true,
      theme: getTerminalColors(),
      scrollback: 10_000,
      ghostty,
    })

    fitAddon = new mod.FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)

    fitAddon.observeResize()
    fitAddon.fit()

    const fonts = document.fonts?.ready
    fonts?.then(() => fitTerminal())

    const wsUrl = getWebSocketUrl()
    console.log("[opencode-demo] connecting", wsUrl)
    ws = new WebSocket(wsUrl)
    let outputBuffer = ""

    ws.addEventListener("message", (event) => {
      if (!term) return
      const message = parseServerMessage(event.data)
      if (!message) return
      if (message.type === "output") {
        outputBuffer = (outputBuffer + message.data).slice(-512)
        updatePhaseFromOutput(outputBuffer)
        if (!booted() && looksLikeTuiBoot(outputBuffer)) {
          markBooted()
        }
        term.write(message.data)
        return
      }
      setStatus("error")
      term.write(`\r\n${message.data}\r\n`)
    })

    ws.addEventListener("close", () => {
      console.log("[opencode-demo] websocket close")
      if (!term) return
      if (status() === "error") return
      setStatus("idle")
      term.write("\r\n[disconnected]\r\n")
    })

    ws.addEventListener("error", (event) => {
      console.error("[opencode-demo] websocket error", event)
      if (!term) return
      setStatus("error")
      term.write("\r\n[connection error]\r\n")
    })

    ws.addEventListener("open", () => {
      console.log("[opencode-demo] websocket open")
      if (!term) return
      setStatus("running")
      send({ type: "init", cols: term.cols, rows: term.rows })
      term.focus()

      if (bootTimeout) {
        window.clearTimeout(bootTimeout)
      }
      bootTimeout = window.setTimeout(() => {
        markBooted()
      }, 60_000)
    })

    term.onData((data) => {
      send({ type: "input", data })
    })

    term.onResize((size) => {
      send({ type: "resize", cols: size.cols, rows: size.rows })
    })

    handleResize = () => fitAddon?.fit()
    window.addEventListener("resize", handleResize)
  }

  onCleanup(() => {
    if (handleResize) {
      window.removeEventListener("resize", handleResize)
    }
    if (bootTimeout) {
      window.clearTimeout(bootTimeout)
    }
    ws?.close()
    term?.dispose()
  })

  const startFromOverlay = () => {
    start().catch((error) => {
      console.error("Failed to start demo terminal", error)
      setStatus("error")
    })
  }

  return (
    <div data-component="terminal-demo" data-status={status()} data-loading={isLoading() ? "" : undefined}>
      <div data-slot="terminal" ref={container} />
      <Show when={!started()}>
        <div data-slot="overlay" data-variant="start">
          <div data-slot="copy">
            <strong>Try OpenCode in your browser</strong>
            <p>Runs in a fresh sandbox.</p>
          </div>
          <button type="button" onClick={startFromOverlay}>
            Start live demo
          </button>
        </div>
      </Show>
      <Show when={isLoading()}>
        <div data-slot="overlay" data-variant="loading">
          <div data-slot="spinner" aria-hidden="true" />
          <div data-slot="copy">
            <strong>{loadingTitle()}</strong>
            <p>{loadingSubtitle()}</p>
          </div>
        </div>
      </Show>
    </div>
  )
}
