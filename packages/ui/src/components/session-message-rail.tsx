import { UserMessage } from "@opencode-ai/sdk/v2"
import { ComponentProps, Show, splitProps, createSignal, onMount, onCleanup } from "solid-js"
import { MessageNav } from "./message-nav"
import "./session-message-rail.css"
import { Portal } from "solid-js/web"

export interface SessionMessageRailProps extends ComponentProps<"div"> {
  messages: UserMessage[]
  current?: UserMessage
  wide?: boolean
  onMessageSelect: (message: UserMessage) => void
}

export function SessionMessageRail(props: SessionMessageRailProps) {
  const [local, others] = splitProps(props, ["messages", "current", "wide", "onMessageSelect", "class", "classList"])
  let anchorRef: HTMLDivElement | undefined
  const [position, setPosition] = createSignal({ top: 0, left: 0, height: 0 })

  const updatePosition = () => {
    if (anchorRef) {
      const rect = anchorRef.getBoundingClientRect()
      setPosition({ top: rect.top, left: rect.left, height: rect.height })
    }
  }

  onMount(() => {
    updatePosition()
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
  })

  onCleanup(() => {
    window.removeEventListener("scroll", updatePosition, true)
    window.removeEventListener("resize", updatePosition)
  })

  return (
    <Show when={(local.messages?.length ?? 0) > 1}>
      <div
        {...others}
        data-component="session-message-rail"
        data-wide={local.wide ? "" : undefined}
        classList={{
          ...(local.classList ?? {}),
          [local.class ?? ""]: !!local.class,
        }}
      >
        <div ref={(el) => (anchorRef = el)} data-slot="session-message-rail-anchor" />
        <Portal mount={document.body}>
          <div
            data-slot="session-message-rail-portal"
            style={{
              position: "fixed",
              top: `${position().top}px`,
              left: `${position().left}px`,
              height: `${position().height}px`,
            }}
          >
            <MessageNav
              messages={local.messages}
              current={local.current}
              onMessageSelect={local.onMessageSelect}
              size={local.wide ? "normal" : "compact"}
            />
          </div>
        </Portal>
      </div>
    </Show>
  )
}
