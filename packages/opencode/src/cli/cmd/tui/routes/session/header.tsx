import { type Accessor, createMemo, Match, Show, Switch } from "solid-js"
import { useRouteData } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { useTheme } from "@tui/context/theme"
import { EmptyBorder, SplitBorder } from "@tui/component/border"
import type { Session } from "@opencode-ai/sdk/v2"
import { useKeybind } from "../../context/keybind"
import { useTerminalDimensions } from "@opentui/solid"

const Title = (props: { session: Accessor<Session> }) => {
  const { theme } = useTheme()
  return (
    <text fg={theme.text}>
      <span style={{ bold: true }}>#</span> <span style={{ bold: true }}>{props.session().title}</span>
    </text>
  )
}

export function Header() {
  const route = useRouteData("session")
  const sync = useSync()
  const session = createMemo(() => sync.session.get(route.sessionID)!)
  const shareEnabled = createMemo(() => sync.data.config.share !== "disabled")
  const showShare = createMemo(() => shareEnabled() && !session()?.share?.url)

  const { theme } = useTheme()
  const keybind = useKeybind()
  const dimensions = useTerminalDimensions()
  const tall = createMemo(() => dimensions().height > 40)

  return (
    <box flexShrink={0}>
      <Show when={!tall()}>
        <box
          height={1}
          border={["top"]}
          borderColor={theme.backgroundPanel}
          customBorderChars={{
            ...EmptyBorder,
            horizontal: "▄",
          }}
        />
      </Show>
      <box
        paddingTop={tall() ? 1 : 0}
        paddingBottom={tall() ? 1 : 0}
        paddingLeft={2}
        paddingRight={1}
        {...SplitBorder}
        border={["left"]}
        borderColor={theme.border}
        flexShrink={0}
        backgroundColor={theme.backgroundPanel}
      >
        <Switch>
          <Match when={session()?.parentID}>
            <box flexDirection="row" gap={2}>
              <text fg={theme.text}>
                <b>Subagent session</b>
              </text>
              <text fg={theme.text}>
                Prev <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle_reverse")}</span>
              </text>
              <text fg={theme.text}>
                Next <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle")}</span>
              </text>
              <box flexGrow={1} flexShrink={1} />
              <Show when={showShare()}>
                <text fg={theme.textMuted} wrapMode="none" flexShrink={0}>
                  /share{" "}
                </text>
              </Show>
            </box>
          </Match>
          <Match when={true}>
            <box flexDirection="row" justifyContent="space-between" gap={1}>
              <Title session={session} />
              <Show when={showShare()}>
                <text fg={theme.textMuted} wrapMode="none" flexShrink={0}>
                  /share{" "}
                </text>
              </Show>
            </box>
          </Match>
        </Switch>
      </box>
      <Show when={!tall()}>
        <box
          height={1}
          border={["bottom"]}
          borderColor={theme.backgroundPanel}
          customBorderChars={{
            ...EmptyBorder,
            horizontal: "▀",
          }}
        />
      </Show>
    </box>
  )
}
