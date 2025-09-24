import { RGBA, Timeline } from "@opentui/core"
import { createComponentTimeline, useTimeline } from "@opentui/solid"
import { createContext, createMemo, useContext, type ParentProps } from "solid-js"

export type ShimmerProps = {
  text: string
  color: string
}

const DURATION = 2_500

const context = createContext<Timeline>()

export function ShimmerProvider(props: ParentProps) {
  const timeline = createComponentTimeline({
    duration: DURATION,
    loop: true,
  })
  return <context.Provider value={timeline}>{props.children}</context.Provider>
}

export function Shimmer(props: ShimmerProps) {
  const timeline = useContext(context)
  const characters = props.text.split("")
  const color = createMemo(() => RGBA.fromHex(props.color))

  const animation = characters.map((_, i) =>
    useTimeline(
      timeline!,
      { shimmer: 0.4 },
      { shimmer: 1 },
      {
        duration: DURATION / (props.text.length + 1),
        ease: "linear",
        alternate: true,
        loop: 2,
      },
      (i * (DURATION / (props.text.length + 1))) / 2,
    ),
  )

  return (
    <text live>
      {(() => {
        return characters.map((ch, i) => {
          const shimmer = animation[i]().shimmer
          const fg = RGBA.fromInts(color().r * 255, color().g * 255, color().b * 255, shimmer * 255)
          return <span style={{ fg }}>{ch}</span>
        })
      })()}
    </text>
  )
}
