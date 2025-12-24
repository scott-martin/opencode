import { createContext, createMemo, createSignal, For, Show, useContext, type ParentProps } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/context/theme"
import { useKeybind } from "@tui/context/keybind"
import { useKV } from "@tui/context/kv"
import { entries, groupBy, pipe } from "remeda"
import type { KeybindsConfig } from "@opencode-ai/sdk/v2"

type ShortcutInfo = {
  key: keyof KeybindsConfig
  title: string
  category: string
}

const SHORTCUTS: ShortcutInfo[] = [
  // General
  { key: "leader", title: "Leader key", category: "General" },
  { key: "app_exit", title: "Exit the app", category: "General" },
  { key: "command_list", title: "Command list", category: "General" },
  { key: "shortcuts_view", title: "View shortcuts", category: "General" },
  { key: "status_view", title: "View status", category: "General" },
  { key: "theme_list", title: "Switch theme", category: "General" },
  { key: "editor_open", title: "Open external editor", category: "General" },
  { key: "terminal_suspend", title: "Suspend terminal", category: "General" },
  { key: "terminal_title_toggle", title: "Toggle terminal title", category: "General" },

  // Session
  { key: "session_new", title: "New session", category: "Session" },
  { key: "session_list", title: "Switch session", category: "Session" },
  { key: "session_timeline", title: "Jump to message", category: "Session" },
  { key: "session_fork", title: "Fork from message", category: "Session" },
  { key: "session_rename", title: "Rename session", category: "Session" },
  { key: "session_share", title: "Share session", category: "Session" },
  { key: "session_unshare", title: "Unshare session", category: "Session" },
  { key: "session_export", title: "Export session", category: "Session" },
  { key: "session_compact", title: "Compact session", category: "Session" },
  { key: "session_interrupt", title: "Interrupt session", category: "Session" },
  { key: "session_child_cycle", title: "Next child session", category: "Session" },
  { key: "session_child_cycle_reverse", title: "Previous child session", category: "Session" },
  { key: "session_parent", title: "Go to parent session", category: "Session" },
  { key: "sidebar_toggle", title: "Toggle sidebar", category: "Session" },
  { key: "scrollbar_toggle", title: "Toggle scrollbar", category: "Session" },
  { key: "username_toggle", title: "Toggle username", category: "Session" },
  { key: "tool_details", title: "Toggle tool details", category: "Session" },

  // Messages
  { key: "messages_page_up", title: "Page up", category: "Navigation" },
  { key: "messages_page_down", title: "Page down", category: "Navigation" },
  { key: "messages_half_page_up", title: "Half page up", category: "Navigation" },
  { key: "messages_half_page_down", title: "Half page down", category: "Navigation" },
  { key: "messages_first", title: "First message", category: "Navigation" },
  { key: "messages_last", title: "Last message", category: "Navigation" },
  { key: "messages_next", title: "Next message", category: "Navigation" },
  { key: "messages_previous", title: "Previous message", category: "Navigation" },
  { key: "messages_last_user", title: "Last user message", category: "Navigation" },
  { key: "messages_copy", title: "Copy last message", category: "Navigation" },
  { key: "messages_undo", title: "Undo message", category: "Navigation" },
  { key: "messages_redo", title: "Redo message", category: "Navigation" },
  { key: "messages_toggle_conceal", title: "Toggle code conceal", category: "Navigation" },

  // Agent & Model
  { key: "agent_list", title: "Switch agent", category: "Agent" },
  { key: "agent_cycle", title: "Next agent", category: "Agent" },
  { key: "agent_cycle_reverse", title: "Previous agent", category: "Agent" },
  { key: "model_list", title: "Switch model", category: "Agent" },
  { key: "model_cycle_recent", title: "Next recent model", category: "Agent" },
  { key: "model_cycle_recent_reverse", title: "Previous recent model", category: "Agent" },
  { key: "model_cycle_favorite", title: "Next favorite model", category: "Agent" },
  { key: "model_cycle_favorite_reverse", title: "Previous favorite model", category: "Agent" },

  // Input
  { key: "input_submit", title: "Submit", category: "Input" },
  { key: "input_newline", title: "New line", category: "Input" },
  { key: "input_clear", title: "Clear", category: "Input" },
  { key: "input_paste", title: "Paste", category: "Input" },
  { key: "input_undo", title: "Undo", category: "Input" },
  { key: "input_redo", title: "Redo", category: "Input" },
  { key: "input_move_left", title: "Move left", category: "Input" },
  { key: "input_move_right", title: "Move right", category: "Input" },
  { key: "input_move_up", title: "Move up", category: "Input" },
  { key: "input_move_down", title: "Move down", category: "Input" },
  { key: "input_word_forward", title: "Word forward", category: "Input" },
  { key: "input_word_backward", title: "Word backward", category: "Input" },
  { key: "input_line_home", title: "Line start", category: "Input" },
  { key: "input_line_end", title: "Line end", category: "Input" },
  { key: "input_visual_line_home", title: "Visual line start", category: "Input" },
  { key: "input_visual_line_end", title: "Visual line end", category: "Input" },
  { key: "input_buffer_home", title: "Buffer start", category: "Input" },
  { key: "input_buffer_end", title: "Buffer end", category: "Input" },
  { key: "input_backspace", title: "Backspace", category: "Input" },
  { key: "input_delete", title: "Delete", category: "Input" },
  { key: "input_delete_line", title: "Delete line", category: "Input" },
  { key: "input_delete_to_line_end", title: "Delete to line end", category: "Input" },
  { key: "input_delete_to_line_start", title: "Delete to line start", category: "Input" },
  { key: "input_delete_word_forward", title: "Delete word forward", category: "Input" },
  { key: "input_delete_word_backward", title: "Delete word backward", category: "Input" },
  { key: "input_select_left", title: "Select left", category: "Input" },
  { key: "input_select_right", title: "Select right", category: "Input" },
  { key: "input_select_up", title: "Select up", category: "Input" },
  { key: "input_select_down", title: "Select down", category: "Input" },
  { key: "input_select_word_forward", title: "Select word forward", category: "Input" },
  { key: "input_select_word_backward", title: "Select word backward", category: "Input" },
  { key: "input_select_line_home", title: "Select to line start", category: "Input" },
  { key: "input_select_line_end", title: "Select to line end", category: "Input" },
  { key: "input_select_visual_line_home", title: "Select to visual line start", category: "Input" },
  { key: "input_select_visual_line_end", title: "Select to visual line end", category: "Input" },
  { key: "input_select_buffer_home", title: "Select to buffer start", category: "Input" },
  { key: "input_select_buffer_end", title: "Select to buffer end", category: "Input" },

  // History
  { key: "history_previous", title: "Previous history", category: "History" },
  { key: "history_next", title: "Next history", category: "History" },

  // Home
  { key: "tips_toggle", title: "Toggle tips", category: "Home" },
]

const CATEGORY_ORDER = ["General", "Session", "Navigation", "Agent", "Input", "History", "Home"]

function categorySort(a: string, b: string) {
  const indexA = CATEGORY_ORDER.indexOf(a)
  const indexB = CATEGORY_ORDER.indexOf(b)
  if (indexA === -1 && indexB === -1) return a.localeCompare(b)
  if (indexA === -1) return 1
  if (indexB === -1) return -1
  return indexA - indexB
}

type ShortcutsContext = {
  visible: () => boolean
  show: () => void
  hide: () => void
  toggle: () => void
}

const ctx = createContext<ShortcutsContext>()
const [globalVisible, setGlobalVisible] = createSignal(false)

export function useShortcuts() {
  const value = useContext(ctx)
  if (!value) {
    throw new Error("useShortcuts must be used within a ShortcutsProvider")
  }
  return value
}

export function ShortcutsProvider(props: ParentProps) {
  const value: ShortcutsContext = {
    visible: globalVisible,
    show: () => setGlobalVisible(true),
    hide: () => setGlobalVisible(false),
    toggle: () => setGlobalVisible((v) => !v),
  }

  return <ctx.Provider value={value}>{props.children}</ctx.Provider>
}

export function ShortcutsPanel() {
  return (
    <Show when={globalVisible()}>
      <DialogShortcuts onClose={() => setGlobalVisible(false)} />
    </Show>
  )
}

export function DialogShortcuts(props: { onClose: () => void }) {
  const { theme } = useTheme()
  const keybind = useKeybind()
  const kv = useKV()
  const dimensions = useTerminalDimensions()

  const [activeTab, setActiveTab] = createSignal(0)

  useKeyboard((evt) => {
    if (evt.ctrl && evt.name === "/") {
      props.onClose()
    }
    if (evt.name === "left" || (evt.ctrl && evt.name === "h")) {
      setActiveTab((prev) => Math.max(0, prev - 1))
    }
    if (evt.name === "right" || (evt.ctrl && evt.name === "l")) {
      setActiveTab((prev) => Math.min(tabs().length - 1, prev + 1))
    }
    if (evt.name === "tab" && !evt.shift) {
      setActiveTab((prev) => (prev + 1) % tabs().length)
    }
    if (evt.name === "tab" && evt.shift) {
      setActiveTab((prev) => (prev - 1 + tabs().length) % tabs().length)
    }
  })

  const shortcuts = createMemo(() => {
    return SHORTCUTS.filter((s) => {
      const kb = keybind.print(s.key)
      return kb && kb !== "none"
    })
  })

  const grouped = createMemo(() => {
    return pipe(
      shortcuts(),
      groupBy((x) => x.category),
      entries(),
      (arr) => arr.toSorted((a, b) => categorySort(a[0], b[0])),
    )
  })

  const tabs = createMemo(() => grouped().map(([category]) => category))

  const currentShortcuts = createMemo(() => {
    const tab = tabs()[activeTab()]
    return grouped().find(([category]) => category === tab)?.[1] ?? []
  })

  const columnCount = createMemo(() => {
    const width = dimensions().width
    if (width >= 150) return 3
    if (width >= 100) return 2
    return 1
  })

  const maxContentRows = createMemo(() => {
    const cols = columnCount()
    let max = 0
    for (const [, items] of grouped()) {
      const rows = Math.ceil(items.length / cols)
      if (rows > max) max = rows
    }
    return max
  })

  const usedShortcuts = createMemo(() => kv.get("used_shortcuts", []) as string[])

  const usedCount = createMemo(() => shortcuts().filter((s) => usedShortcuts().includes(s.key)).length)

  const totalCount = createMemo(() => shortcuts().length)

  const progressFilled = createMemo(() => (totalCount() > 0 ? Math.round((usedCount() / totalCount()) * 10) : 0))

  const columns = createMemo(() => {
    const items = currentShortcuts()
    const cols = columnCount()
    const result: ShortcutInfo[][] = Array.from({ length: cols }, () => [])
    items.forEach((item, i) => {
      result[i % cols].push(item)
    })
    return result
  })

  return (
    <box
      flexDirection="column"
      width={dimensions().width}
      backgroundColor={theme.backgroundPanel}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
    >
      <box flexDirection="row" paddingBottom={2} alignItems="center">
        <box flexGrow={1} />
        <box flexDirection="row" gap={2} alignItems="center">
          <For each={tabs()}>
            {(tab, index) => (
              <box
                onMouseUp={() => setActiveTab(index())}
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={activeTab() === index() ? theme.backgroundElement : undefined}
              >
                <text
                  fg={activeTab() === index() ? theme.text : theme.textMuted}
                  attributes={activeTab() === index() ? TextAttributes.BOLD : undefined}
                >
                  {tab}
                </text>
              </box>
            )}
          </For>
        </box>
        <box flexGrow={1} />
        <text fg={theme.textMuted} paddingRight={2}>
          ctrl+/
        </text>
      </box>

      <scrollbox height={Math.min(8, maxContentRows())} scrollbarOptions={{ visible: false }}>
        <box flexDirection="row" height={maxContentRows()}>
          <box flexGrow={1} />
          <box
            flexDirection="row"
            gap={8}
            width={dimensions().width >= 150 ? Math.floor((dimensions().width * 2) / 3) : undefined}
          >
            <For each={columns()}>
              {(column) => (
                <box flexDirection="column" flexGrow={1} flexBasis={0}>
                  <For each={column}>
                    {(shortcut) => {
                      const kb = keybind.print(shortcut.key)
                      const used = createMemo(() => usedShortcuts().includes(shortcut.key))
                      return (
                        <Show when={kb}>
                          <box flexDirection="row" gap={2}>
                            <text fg={used() ? theme.success : theme.textMuted} flexGrow={1}>
                              {shortcut.title}
                            </text>
                            <text fg={used() ? theme.success : theme.text}>{kb}</text>
                          </box>
                        </Show>
                      )
                    }}
                  </For>
                </box>
              )}
            </For>
          </box>
          <box flexGrow={1} />
        </box>
      </scrollbox>
      <box paddingTop={2} flexDirection="row" justifyContent="center" gap={2}>
        <text>
          <span style={{ fg: theme.success }}>{"━".repeat(progressFilled())}</span>
          <span style={{ fg: theme.textMuted }}>{"━".repeat(10 - progressFilled())}</span>
        </text>
        <text>
          <span style={{ fg: theme.text }}>
            {usedCount()}/{totalCount()}
          </span>
          <span style={{ fg: theme.textMuted }}> shortcuts used</span>
        </text>
      </box>
    </box>
  )
}
