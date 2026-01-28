import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { Log } from "@/util/log"
import { SessionStatus } from "./status"
import { SessionPrompt } from "./prompt"

export namespace SessionTitle {
  const log = Log.create({ service: "session.title" })
  const COOLDOWN = 60_000
  const last: Record<string, number> = {}

  export function init() {
    Bus.subscribe(SessionStatus.Event.Idle, async (event) => {
      const config = await Config.get()
      if (config.title?.auto === false) return

      const sessionID = event.properties.sessionID
      const now = Date.now()
      const prev = last[sessionID] ?? 0
      if (now - prev < COOLDOWN) return
      last[sessionID] = now

      log.info("regenerating title", { sessionID })
      await SessionPrompt.generateTitle({ sessionID }).catch((err) => {
        log.error("failed to regenerate title", { sessionID, error: err })
      })
    })
  }
}
