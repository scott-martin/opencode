import type { Argv } from "yargs"
import path from "path"
import { UI } from "../ui"
import { cmd } from "./cmd"
import { Flag } from "../../flag/flag"
import { bootstrap } from "../bootstrap"
import { Command } from "../../command"
import { EOL } from "os"
import { select } from "@clack/prompts"
import { createOpencodeClient, type OpencodeClient, type ToolPart } from "@opencode-ai/sdk/v2"
import { Server } from "../../server/server"
import { Provider } from "../../provider/provider"
import { Agent } from "../../agent/agent"
import { resolveNetworkOptions, withNetworkOptions } from "../network"
import { Locale } from "@/util/locale"

const TOOL_ICON: Record<string, string> = {
  bash: "$",
  codesearch: "◇",
  edit: "←",
  glob: "✱",
  grep: "✱",
  list: "→",
  patch: "%",
  question: "→",
  read: "→",
  task: "◉",
  todoread: "⚙",
  todowrite: "⚙",
  webfetch: "%",
  websearch: "◈",
  write: "←",
}

export const RunCommand = cmd({
  command: "run [message..]",
  describe: "run opencode with a message",
  builder: (yargs: Argv) => {
    return withNetworkOptions(yargs)
      .positional("message", {
        describe: "message to send",
        type: "string",
        array: true,
        default: [],
      })
      .option("command", {
        describe: "the command to run, use message for args",
        type: "string",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continue the last session",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        describe: "session id to continue",
        type: "string",
      })
      .option("share", {
        type: "boolean",
        describe: "share the session",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use",
      })
      .option("format", {
        type: "string",
        choices: ["default", "json"],
        default: "default",
        describe: "format: default (formatted) or json (raw JSON events)",
      })
      .option("file", {
        alias: ["f"],
        type: "string",
        array: true,
        describe: "file(s) to attach to message",
      })
      .option("title", {
        type: "string",
        describe: "title for the session (uses truncated prompt if no value provided)",
      })
      .option("attach", {
        type: "string",
        describe: "attach to a running opencode server (e.g., http://localhost:4096)",
      })
      .option("variant", {
        type: "string",
        describe: "model variant (provider-specific reasoning effort, e.g., high, max, minimal)",
      })
  },
  handler: async (args) => {
    let message = [...args.message, ...(args["--"] || [])]
      .map((arg) => (arg.includes(" ") ? `"${arg.replace(/"/g, '\\"')}"` : arg))
      .join(" ")

    const fileParts: any[] = []
    if (args.file) {
      const files = Array.isArray(args.file) ? args.file : [args.file]

      for (const filePath of files) {
        const resolvedPath = path.resolve(process.cwd(), filePath)
        const file = Bun.file(resolvedPath)
        const stats = await file.stat().catch(() => {})
        if (!stats) {
          UI.error(`File not found: ${filePath}`)
          process.exit(1)
        }
        if (!(await file.exists())) {
          UI.error(`File not found: ${filePath}`)
          process.exit(1)
        }

        const stat = await file.stat()
        const mime = stat.isDirectory() ? "application/x-directory" : "text/plain"

        fileParts.push({
          type: "file",
          url: `file://${resolvedPath}`,
          filename: path.basename(resolvedPath),
          mime,
        })
      }
    }

    if (!process.stdin.isTTY) message += "\n" + (await Bun.stdin.text())

    if (message.trim().length === 0 && !args.command) {
      UI.error("You must provide a message or a command")
      process.exit(1)
    }

    const execute = async (sdk: OpencodeClient, sessionID: string) => {
      const normalizePath = (input?: string) => {
        if (!input) return ""
        if (path.isAbsolute(input)) return path.relative(process.cwd(), input) || "."
        return input
      }

      const formatInput = (input: Record<string, unknown>, omit?: string[]) => {
        const entries = Object.entries(input).filter(([key, value]) => {
          if (omit?.includes(key)) return false
          if (typeof value === "string") return true
          if (typeof value === "number") return true
          if (typeof value === "boolean") return true
          return false
        })
        if (entries.length === 0) return ""
        return `[${entries.map(([key, value]) => `${key}=${value}`).join(", ")}]`
      }

      const toolLine = (part: ToolPart) => {
        const state = part.state.status === "completed" ? part.state : undefined
        const input = (state?.input ?? {}) as Record<string, unknown>
        const meta = (state?.metadata ?? {}) as Record<string, unknown>
        if (part.tool === "read") {
          const filePath = typeof input.filePath === "string" ? input.filePath : ""
          const detail = formatInput(input, ["filePath"])
          if (!detail) return `Read ${normalizePath(filePath)}`
          return `Read ${normalizePath(filePath)} ${detail}`
        }
        if (part.tool === "write") {
          const filePath = typeof input.filePath === "string" ? input.filePath : ""
          return `Write ${normalizePath(filePath)}`
        }
        if (part.tool === "edit") {
          const filePath = typeof input.filePath === "string" ? input.filePath : ""
          const detail = formatInput({ replaceAll: input.replaceAll })
          if (!detail) return `Edit ${normalizePath(filePath)}`
          return `Edit ${normalizePath(filePath)} ${detail}`
        }
        if (part.tool === "glob") {
          const pattern = typeof input.pattern === "string" ? input.pattern : ""
          const dir = typeof input.path === "string" ? normalizePath(input.path) : ""
          const count = typeof meta.count === "number" ? meta.count : undefined
          const parts = [`Glob "${pattern}"`]
          if (dir) parts.push(`in ${dir}`)
          if (count !== undefined) parts.push(`(${count} matches)`)
          return parts.join(" ")
        }
        if (part.tool === "grep") {
          const pattern = typeof input.pattern === "string" ? input.pattern : ""
          const dir = typeof input.path === "string" ? normalizePath(input.path) : ""
          const matches = typeof meta.matches === "number" ? meta.matches : undefined
          const parts = [`Grep "${pattern}"`]
          if (dir) parts.push(`in ${dir}`)
          if (matches !== undefined) parts.push(`(${matches} matches)`)
          return parts.join(" ")
        }
        if (part.tool === "list") {
          const dir = typeof input.path === "string" ? normalizePath(input.path) : ""
          if (!dir) return "List"
          return `List ${dir}`
        }
        if (part.tool === "webfetch") {
          const url = typeof input.url === "string" ? input.url : ""
          if (!url) return "WebFetch"
          return `WebFetch ${url}`
        }
        if (part.tool === "codesearch") {
          const query = typeof input.query === "string" ? input.query : ""
          const results = typeof meta.results === "number" ? meta.results : undefined
          const parts = [`Exa Code Search "${query}"`]
          if (results !== undefined) parts.push(`(${results} results)`)
          return parts.join(" ")
        }
        if (part.tool === "websearch") {
          const query = typeof input.query === "string" ? input.query : ""
          const results = typeof meta.numResults === "number" ? meta.numResults : undefined
          const parts = [`Exa Web Search "${query}"`]
          if (results !== undefined) parts.push(`(${results} results)`)
          return parts.join(" ")
        }
        if (part.tool === "task") {
          const desc = typeof input.description === "string" ? input.description : "Task"
          const agent = typeof input.subagent_type === "string" ? input.subagent_type : "Task"
          return `${agent} Task "${desc}"`
        }
        if (part.tool === "todowrite" || part.tool === "todoread") {
          const count = Array.isArray(input.todos) ? input.todos.length : 0
          if (count) return `Todos (${count})`
          return "Todos"
        }
        if (part.tool === "question") {
          const count = Array.isArray(input.questions) ? input.questions.length : 0
          return `Asked ${count} question${count === 1 ? "" : "s"}`
        }
        if (part.tool === "patch") {
          return "Patch"
        }
        const detail = formatInput(input)
        if (!detail) return part.tool
        return `${part.tool} ${detail}`
      }

      const printTool = (part: ToolPart) => {
        if (part.tool === "bash") {
          const state = part.state.status === "completed" ? part.state : undefined
          if (!state) return
          UI.empty()
          const input = (state.input ?? {}) as Record<string, unknown>
          const meta = (state.metadata ?? {}) as Record<string, unknown>
          const desc = typeof input.description === "string" ? input.description : undefined
          const title = desc ?? state.title ?? "Shell"
          UI.println(UI.Style.TEXT_DIM + "# " + title)
          const command = typeof input.command === "string" ? input.command : ""
          if (command) UI.println(UI.Style.TEXT_NORMAL + "$ " + command)
          const output = typeof state.output === "string" ? state.output.trimEnd() : undefined
          const metaOutput = typeof meta.output === "string" ? meta.output.trimEnd() : undefined
          const result = output ?? metaOutput
          if (result) UI.println(UI.Style.TEXT_NORMAL + result)
          UI.empty()
          return
        }
        const icon = TOOL_ICON[part.tool] ?? "⚙"
        const line = toolLine(part)
        UI.println(UI.Style.TEXT_NORMAL + icon, UI.Style.TEXT_NORMAL + line)
      }

      const printUserMessage = () => {
        if (args.format === "json") return
        const trimmed = message.trim()
        if (!trimmed) return
        const single = trimmed.replace(/\s+/g, " ")
        UI.println(UI.Style.TEXT_NORMAL_BOLD + "▌", UI.Style.TEXT_NORMAL + single)
        UI.empty()
        userPrinted = true
        printHeader()
      }

      const outputJsonEvent = (type: string, data: Record<string, unknown>) => {
        if (args.format === "json") {
          process.stdout.write(JSON.stringify({ type, timestamp: Date.now(), sessionID, ...data }) + EOL)
          return true
        }
        return false
      }

      const events = await sdk.event.subscribe()
      let header: { agent: string; modelID: string } | undefined
      let headerPrinted = false
      let userPrinted = false
      const printHeader = () => {
        if (!process.stdout.isTTY) return
        if (!header || headerPrinted) return
        UI.empty()
        UI.println(
          UI.Style.TEXT_NORMAL + "▣  " + Locale.titlecase(header.agent) + UI.Style.TEXT_DIM + " · " + header.modelID,
        )
        UI.empty()
        headerPrinted = true
      }
      let errorMsg: string | undefined

      const eventProcessor = (async () => {
        for await (const event of events.stream) {
          if (event.type === "message.part.updated") {
            const part = event.properties.part
            if (part.sessionID !== sessionID) continue

            if (part.type === "tool" && part.state.status === "completed") {
              if (outputJsonEvent("tool_use", { part })) continue
              printTool(part as ToolPart)
            }

            if (part.type === "step-start") {
              if (outputJsonEvent("step_start", { part })) continue
            }

            if (part.type === "step-finish") {
              if (outputJsonEvent("step_finish", { part })) continue
            }

            if (part.type === "text" && part.time?.end) {
              if (outputJsonEvent("text", { part })) continue
              const isPiped = !process.stdout.isTTY
              if (!isPiped) UI.empty()
              if (!isPiped) UI.empty()
              process.stdout.write((isPiped ? part.text : UI.markdown(part.text)) + EOL)
              if (!isPiped) UI.empty()
              if (!isPiped) UI.empty()
            }
          }

          if (event.type === "message.updated") {
            const info = event.properties.info
            if (info.sessionID === sessionID && info.role === "assistant") {
              header = { agent: info.agent, modelID: info.modelID }
              if (userPrinted) printHeader()
            }
          }

          if (event.type === "session.error") {
            const props = event.properties
            if (props.sessionID !== sessionID || !props.error) continue
            let err = String(props.error.name)
            if ("data" in props.error && props.error.data && "message" in props.error.data) {
              err = String(props.error.data.message)
            }
            errorMsg = errorMsg ? errorMsg + EOL + err : err
            if (outputJsonEvent("error", { error: props.error })) continue
            UI.error(err)
          }

          if (event.type === "session.idle" && event.properties.sessionID === sessionID) {
            break
          }

          if (event.type === "permission.asked") {
            const permission = event.properties
            if (permission.sessionID !== sessionID) continue
            const result = await select({
              message: `Permission required: ${permission.permission} (${permission.patterns.join(", ")})`,
              options: [
                { value: "once", label: "Allow once" },
                { value: "always", label: "Always allow: " + permission.always.join(", ") },
                { value: "reject", label: "Reject" },
              ],
              initialValue: "once",
            }).catch(() => "reject")
            const response = (result.toString().includes("cancel") ? "reject" : result) as "once" | "always" | "reject"
            await sdk.permission.respond({
              sessionID,
              permissionID: permission.id,
              response,
            })
          }
        }
      })()

      // Validate agent if specified
      const resolvedAgent = await (async () => {
        if (!args.agent) return undefined
        const agent = await Agent.get(args.agent)
        if (!agent) {
          UI.println(
            UI.Style.TEXT_WARNING_BOLD + "!",
            UI.Style.TEXT_NORMAL,
            `agent "${args.agent}" not found. Falling back to default agent`,
          )
          return undefined
        }
        if (agent.mode === "subagent") {
          UI.println(
            UI.Style.TEXT_WARNING_BOLD + "!",
            UI.Style.TEXT_NORMAL,
            `agent "${args.agent}" is a subagent, not a primary agent. Falling back to default agent`,
          )
          return undefined
        }
        return args.agent
      })()

      printUserMessage()

      if (args.command) {
        await sdk.session.command({
          sessionID,
          agent: resolvedAgent,
          model: args.model,
          command: args.command,
          arguments: message,
          variant: args.variant,
        })
      } else {
        const modelParam = args.model ? Provider.parseModel(args.model) : undefined
        await sdk.session.prompt({
          sessionID,
          agent: resolvedAgent,
          model: modelParam,
          variant: args.variant,
          parts: [...fileParts, { type: "text", text: message }],
        })
      }

      await eventProcessor
      if (errorMsg) process.exit(1)
    }

    if (args.attach) {
      const sdk = createOpencodeClient({ baseUrl: args.attach })

      const sessionID = await (async () => {
        if (args.continue) {
          const result = await sdk.session.list()
          return result.data?.find((s) => !s.parentID)?.id
        }
        if (args.session) return args.session

        const title =
          args.title !== undefined
            ? args.title === ""
              ? message.slice(0, 50) + (message.length > 50 ? "..." : "")
              : args.title
            : undefined

        const result = await sdk.session.create(
          title
            ? {
                title,
                permission: [
                  {
                    permission: "question",
                    action: "deny",
                    pattern: "*",
                  },
                ],
              }
            : {
                permission: [
                  {
                    permission: "question",
                    action: "deny",
                    pattern: "*",
                  },
                ],
              },
        )
        return result.data?.id
      })()

      if (!sessionID) {
        UI.error("Session not found")
        process.exit(1)
      }

      const cfgResult = await sdk.config.get()
      if (cfgResult.data && (cfgResult.data.share === "auto" || Flag.OPENCODE_AUTO_SHARE || args.share)) {
        const shareResult = await sdk.session.share({ sessionID }).catch((error) => {
          if (error instanceof Error && error.message.includes("disabled")) {
            UI.println(UI.Style.TEXT_DANGER_BOLD + "!  " + error.message)
          }
          return { error }
        })
        if (!shareResult.error && "data" in shareResult && shareResult.data?.share?.url) {
          UI.println(UI.Style.TEXT_INFO_BOLD + "~  " + shareResult.data.share.url)
        }
      }

      return await execute(sdk, sessionID)
    }

    await bootstrap(process.cwd(), async () => {
      const opts = await resolveNetworkOptions(args)
      const server = Server.listen(opts)
      const sdk = createOpencodeClient({ baseUrl: `http://${server.hostname}:${server.port}` })

      if (args.command) {
        const exists = await Command.get(args.command)
        if (!exists) {
          server.stop()
          UI.error(`Command "${args.command}" not found`)
          process.exit(1)
        }
      }

      const sessionID = await (async () => {
        if (args.continue) {
          const result = await sdk.session.list()
          return result.data?.find((s) => !s.parentID)?.id
        }
        if (args.session) return args.session

        const title =
          args.title !== undefined
            ? args.title === ""
              ? message.slice(0, 50) + (message.length > 50 ? "..." : "")
              : args.title
            : undefined

        const result = await sdk.session.create(title ? { title } : {})
        return result.data?.id
      })()

      if (!sessionID) {
        server.stop()
        UI.error("Session not found")
        process.exit(1)
      }

      const cfgResult = await sdk.config.get()
      if (cfgResult.data && (cfgResult.data.share === "auto" || Flag.OPENCODE_AUTO_SHARE || args.share)) {
        const shareResult = await sdk.session.share({ sessionID }).catch((error) => {
          if (error instanceof Error && error.message.includes("disabled")) {
            UI.println(UI.Style.TEXT_DANGER_BOLD + "!  " + error.message)
          }
          return { error }
        })
        if (!shareResult.error && "data" in shareResult && shareResult.data?.share?.url) {
          UI.println(UI.Style.TEXT_INFO_BOLD + "~  " + shareResult.data.share.url)
        }
      }

      await execute(sdk, sessionID)
      server.stop()
    })
  },
})
