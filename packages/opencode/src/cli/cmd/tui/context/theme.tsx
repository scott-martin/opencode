import { SyntaxStyle, RGBA } from "@opentui/core"
import { createMemo, createSignal } from "solid-js"
import { useSync } from "@tui/context/sync"
import { createSimpleContext } from "./helper"
import aura from "./theme/aura.json" with { type: "json" }
import ayu from "./theme/ayu.json" with { type: "json" }
import catppuccin from "./theme/catppuccin.json" with { type: "json" }
import cobalt2 from "./theme/cobalt2.json" with { type: "json" }
import dracula from "./theme/dracula.json" with { type: "json" }
import everforest from "./theme/everforest.json" with { type: "json" }
import github from "./theme/github.json" with { type: "json" }
import gruvbox from "./theme/gruvbox.json" with { type: "json" }
import kanagawa from "./theme/kanagawa.json" with { type: "json" }
import material from "./theme/material.json" with { type: "json" }
import matrix from "./theme/matrix.json" with { type: "json" }
import monokai from "./theme/monokai.json" with { type: "json" }
import nightowl from "./theme/nightowl.json" with { type: "json" }
import nord from "./theme/nord.json" with { type: "json" }
import onedark from "./theme/one-dark.json" with { type: "json" }
import opencode from "./theme/opencode.json" with { type: "json" }
import palenight from "./theme/palenight.json" with { type: "json" }
import rosepine from "./theme/rosepine.json" with { type: "json" }
import solarized from "./theme/solarized.json" with { type: "json" }
import synthwave84 from "./theme/synthwave84.json" with { type: "json" }
import tokyonight from "./theme/tokyonight.json" with { type: "json" }
import vesper from "./theme/vesper.json" with { type: "json" }
import zenburn from "./theme/zenburn.json" with { type: "json" }
import { useKV } from "./kv"
import type { Terminal } from "../util/terminal"

type Theme = {
  primary: RGBA
  secondary: RGBA
  accent: RGBA
  error: RGBA
  warning: RGBA
  success: RGBA
  info: RGBA
  text: RGBA
  textMuted: RGBA
  background: RGBA
  backgroundPanel: RGBA
  backgroundElement: RGBA
  border: RGBA
  borderActive: RGBA
  borderSubtle: RGBA
  diffAdded: RGBA
  diffRemoved: RGBA
  diffContext: RGBA
  diffHunkHeader: RGBA
  diffHighlightAdded: RGBA
  diffHighlightRemoved: RGBA
  diffAddedBg: RGBA
  diffRemovedBg: RGBA
  diffContextBg: RGBA
  diffLineNumber: RGBA
  diffAddedLineNumberBg: RGBA
  diffRemovedLineNumberBg: RGBA
  markdownText: RGBA
  markdownHeading: RGBA
  markdownLink: RGBA
  markdownLinkText: RGBA
  markdownCode: RGBA
  markdownBlockQuote: RGBA
  markdownEmph: RGBA
  markdownStrong: RGBA
  markdownHorizontalRule: RGBA
  markdownListItem: RGBA
  markdownListEnumeration: RGBA
  markdownImage: RGBA
  markdownImageText: RGBA
  markdownCodeBlock: RGBA
  syntaxComment: RGBA
  syntaxKeyword: RGBA
  syntaxFunction: RGBA
  syntaxVariable: RGBA
  syntaxString: RGBA
  syntaxNumber: RGBA
  syntaxType: RGBA
  syntaxOperator: RGBA
  syntaxPunctuation: RGBA
}

type HexColor = `#${string}`
type RefName = string
type Variant = {
  dark: HexColor | RefName
  light: HexColor | RefName
}
type ColorValue = HexColor | RefName | Variant | RGBA
type ThemeJson = {
  $schema?: string
  defs?: Record<string, HexColor | RefName>
  theme: Record<keyof Theme, ColorValue>
}

export const DEFAULT_THEMES: Record<string, ThemeJson> = {
  aura,
  ayu,
  catppuccin,
  cobalt2,
  dracula,
  everforest,
  github,
  gruvbox,
  kanagawa,
  material,
  matrix,
  monokai,
  nightowl,
  nord,
  ["one-dark"]: onedark,
  opencode,
  palenight,
  rosepine,
  solarized,
  synthwave84,
  tokyonight,
  vesper,
  zenburn,
}

function resolveTheme(theme: ThemeJson, mode: "dark" | "light") {
  const defs = theme.defs ?? {}
  function resolveColor(c: ColorValue): RGBA {
    if (c instanceof RGBA) return c
    if (typeof c === "string") return c.startsWith("#") ? RGBA.fromHex(c) : resolveColor(defs[c])
    return resolveColor(c[mode])
  }
  return Object.fromEntries(
    Object.entries(theme.theme).map(([key, value]) => {
      return [key, resolveColor(value)]
    }),
  ) as Theme
}

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: (props: { mode: "dark" | "light"; system: Terminal.Colors }) => {
    const sync = useSync()
    const kv = useKV()

    const [theme, setTheme] = createSignal(sync.data.config.theme ?? kv.get("theme", "opencode"))
    const [mode, setMode] = createSignal(props.mode)

    console.log(generateSystem(props.system, mode()))
    const themes: Record<string, ThemeJson> = {
      ...DEFAULT_THEMES,
    }
    if (props.system.colors[0]) themes.system = generateSystem(props.system, mode())

    const values = createMemo(() => {
      return resolveTheme(themes[theme()] ?? themes.opencode, mode())
    })

    const syntax = createMemo(() => {
      return SyntaxStyle.fromTheme([
        {
          scope: ["prompt"],
          style: {
            foreground: values().accent,
          },
        },
        {
          scope: ["extmark.file"],
          style: {
            foreground: values().warning,
            bold: true,
          },
        },
        {
          scope: ["extmark.agent"],
          style: {
            foreground: values().secondary,
            bold: true,
          },
        },
        {
          scope: ["extmark.paste"],
          style: {
            foreground: values().background,
            background: values().warning,
            bold: true,
          },
        },
        {
          scope: ["comment"],
          style: {
            foreground: values().syntaxComment,
            italic: true,
          },
        },
        {
          scope: ["comment.documentation"],
          style: {
            foreground: values().syntaxComment,
            italic: true,
          },
        },
        {
          scope: ["string", "symbol"],
          style: {
            foreground: values().syntaxString,
          },
        },
        {
          scope: ["number", "boolean"],
          style: {
            foreground: values().syntaxNumber,
          },
        },
        {
          scope: ["character.special"],
          style: {
            foreground: values().syntaxString,
          },
        },
        {
          scope: ["keyword.return", "keyword.conditional", "keyword.repeat", "keyword.coroutine"],
          style: {
            foreground: values().syntaxKeyword,
            italic: true,
          },
        },
        {
          scope: ["keyword.type"],
          style: {
            foreground: values().syntaxType,
            bold: true,
            italic: true,
          },
        },
        {
          scope: ["keyword.function", "function.method"],
          style: {
            foreground: values().syntaxFunction,
          },
        },
        {
          scope: ["keyword"],
          style: {
            foreground: values().syntaxKeyword,
            italic: true,
          },
        },
        {
          scope: ["keyword.import"],
          style: {
            foreground: values().syntaxKeyword,
          },
        },
        {
          scope: ["operator", "keyword.operator", "punctuation.delimiter"],
          style: {
            foreground: values().syntaxOperator,
          },
        },
        {
          scope: ["keyword.conditional.ternary"],
          style: {
            foreground: values().syntaxOperator,
          },
        },
        {
          scope: ["variable", "variable.parameter", "function.method.call", "function.call"],
          style: {
            foreground: values().syntaxVariable,
          },
        },
        {
          scope: ["variable.member", "function", "constructor"],
          style: {
            foreground: values().syntaxFunction,
          },
        },
        {
          scope: ["type", "module"],
          style: {
            foreground: values().syntaxType,
          },
        },
        {
          scope: ["constant"],
          style: {
            foreground: values().syntaxNumber,
          },
        },
        {
          scope: ["property"],
          style: {
            foreground: values().syntaxVariable,
          },
        },
        {
          scope: ["class"],
          style: {
            foreground: values().syntaxType,
          },
        },
        {
          scope: ["parameter"],
          style: {
            foreground: values().syntaxVariable,
          },
        },
        {
          scope: ["punctuation", "punctuation.bracket"],
          style: {
            foreground: values().syntaxPunctuation,
          },
        },
        {
          scope: [
            "variable.builtin",
            "type.builtin",
            "function.builtin",
            "module.builtin",
            "constant.builtin",
          ],
          style: {
            foreground: values().error,
          },
        },
        {
          scope: ["variable.super"],
          style: {
            foreground: values().error,
          },
        },
        {
          scope: ["string.escape", "string.regexp"],
          style: {
            foreground: values().syntaxKeyword,
          },
        },
        {
          scope: ["keyword.directive"],
          style: {
            foreground: values().syntaxKeyword,
            italic: true,
          },
        },
        {
          scope: ["punctuation.special"],
          style: {
            foreground: values().syntaxOperator,
          },
        },
        {
          scope: ["keyword.modifier"],
          style: {
            foreground: values().syntaxKeyword,
            italic: true,
          },
        },
        {
          scope: ["keyword.exception"],
          style: {
            foreground: values().syntaxKeyword,
            italic: true,
          },
        },
        // Markdown specific styles
        {
          scope: ["markup.heading"],
          style: {
            foreground: values().markdownHeading,
            bold: true,
          },
        },
        {
          scope: ["markup.heading.1"],
          style: {
            foreground: values().markdownHeading,
            bold: true,
          },
        },
        {
          scope: ["markup.heading.2"],
          style: {
            foreground: values().markdownHeading,
            bold: true,
          },
        },
        {
          scope: ["markup.heading.3"],
          style: {
            foreground: values().markdownHeading,
            bold: true,
          },
        },
        {
          scope: ["markup.heading.4"],
          style: {
            foreground: values().markdownHeading,
            bold: true,
          },
        },
        {
          scope: ["markup.heading.5"],
          style: {
            foreground: values().markdownHeading,
            bold: true,
          },
        },
        {
          scope: ["markup.heading.6"],
          style: {
            foreground: values().markdownHeading,
            bold: true,
          },
        },
        {
          scope: ["markup.bold", "markup.strong"],
          style: {
            foreground: values().markdownStrong,
            bold: true,
          },
        },
        {
          scope: ["markup.italic"],
          style: {
            foreground: values().markdownEmph,
            italic: true,
          },
        },
        {
          scope: ["markup.list"],
          style: {
            foreground: values().markdownListItem,
          },
        },
        {
          scope: ["markup.quote"],
          style: {
            foreground: values().markdownBlockQuote,
            italic: true,
          },
        },
        {
          scope: ["markup.raw", "markup.raw.block"],
          style: {
            foreground: values().markdownCode,
          },
        },
        {
          scope: ["markup.raw.inline"],
          style: {
            foreground: values().markdownCode,
            background: values().background,
          },
        },
        {
          scope: ["markup.link"],
          style: {
            foreground: values().markdownLink,
            underline: true,
          },
        },
        {
          scope: ["markup.link.label"],
          style: {
            foreground: values().markdownLinkText,
            underline: true,
          },
        },
        {
          scope: ["markup.link.url"],
          style: {
            foreground: values().markdownLink,
            underline: true,
          },
        },
        {
          scope: ["label"],
          style: {
            foreground: values().markdownLinkText,
          },
        },
        {
          scope: ["spell", "nospell"],
          style: {
            foreground: values().text,
          },
        },
        {
          scope: ["conceal"],
          style: {
            foreground: values().textMuted,
          },
        },
        // Additional common highlight groups
        {
          scope: ["string.special", "string.special.url"],
          style: {
            foreground: values().markdownLink,
            underline: true,
          },
        },
        {
          scope: ["character"],
          style: {
            foreground: values().syntaxString,
          },
        },
        {
          scope: ["float"],
          style: {
            foreground: values().syntaxNumber,
          },
        },
        {
          scope: ["comment.error"],
          style: {
            foreground: values().error,
            italic: true,
            bold: true,
          },
        },
        {
          scope: ["comment.warning"],
          style: {
            foreground: values().warning,
            italic: true,
            bold: true,
          },
        },
        {
          scope: ["comment.todo", "comment.note"],
          style: {
            foreground: values().info,
            italic: true,
            bold: true,
          },
        },
        {
          scope: ["namespace"],
          style: {
            foreground: values().syntaxType,
          },
        },
        {
          scope: ["field"],
          style: {
            foreground: values().syntaxVariable,
          },
        },
        {
          scope: ["type.definition"],
          style: {
            foreground: values().syntaxType,
            bold: true,
          },
        },
        {
          scope: ["keyword.export"],
          style: {
            foreground: values().syntaxKeyword,
          },
        },
        {
          scope: ["attribute", "annotation"],
          style: {
            foreground: values().warning,
          },
        },
        {
          scope: ["tag"],
          style: {
            foreground: values().error,
          },
        },
        {
          scope: ["tag.attribute"],
          style: {
            foreground: values().syntaxKeyword,
          },
        },
        {
          scope: ["tag.delimiter"],
          style: {
            foreground: values().syntaxOperator,
          },
        },
        {
          scope: ["markup.strikethrough"],
          style: {
            foreground: values().textMuted,
          },
        },
        {
          scope: ["markup.underline"],
          style: {
            foreground: values().text,
            underline: true,
          },
        },
        {
          scope: ["markup.list.checked"],
          style: {
            foreground: values().success,
          },
        },
        {
          scope: ["markup.list.unchecked"],
          style: {
            foreground: values().textMuted,
          },
        },
        {
          scope: ["diff.plus"],
          style: {
            foreground: values().diffAdded,
          },
        },
        {
          scope: ["diff.minus"],
          style: {
            foreground: values().diffRemoved,
          },
        },
        {
          scope: ["diff.delta"],
          style: {
            foreground: values().diffContext,
          },
        },
        {
          scope: ["error"],
          style: {
            foreground: values().error,
            bold: true,
          },
        },
        {
          scope: ["warning"],
          style: {
            foreground: values().warning,
            bold: true,
          },
        },
        {
          scope: ["info"],
          style: {
            foreground: values().info,
          },
        },
        {
          scope: ["debug"],
          style: {
            foreground: values().textMuted,
          },
        },
      ])
    })

    return {
      theme: new Proxy(values(), {
        get(_target, prop) {
          // @ts-expect-error
          return values()[prop]
        },
      }),
      get selected() {
        return theme()
      },
      all() {
        return themes
      },
      syntax,
      mode,
      setMode(mode: "dark" | "light") {
        setMode(mode)
      },
      set(theme: string) {
        setTheme(theme)
        kv.set("theme", theme)
      },
      get ready() {
        return sync.ready
      },
    }
  },
})

function generateSystem(colors: Terminal.Colors, mode: "dark" | "light"): ThemeJson {
  const bg = colors.background ?? colors.colors[0]
  const isDark = mode == "dark"

  // Generate gray scale based on terminal background
  const grays = generateGrayScale(bg, isDark)
  const textMuted = generateMutedTextColor(bg, isDark)

  // ANSI color references
  const ansiColors = {
    black: colors.colors[0],
    red: colors.colors[1],
    green: colors.colors[2],
    yellow: colors.colors[3],
    blue: colors.colors[4],
    magenta: colors.colors[5],
    cyan: colors.colors[6],
    white: colors.colors[7],
  }

  return {
    theme: {
      // Primary colors using ANSI
      primary: ansiColors.cyan,
      secondary: ansiColors.magenta,
      accent: ansiColors.cyan,

      // Status colors using ANSI
      error: ansiColors.red,
      warning: ansiColors.yellow,
      success: ansiColors.green,
      info: ansiColors.cyan,

      // Text colors
      text: colors.foreground ?? ansiColors.white,
      textMuted,

      // Background colors
      background: bg,
      backgroundPanel: grays[2],
      backgroundElement: grays[3],

      // Border colors
      borderSubtle: grays[6],
      border: grays[7],
      borderActive: grays[8],

      // Diff colors
      diffAdded: ansiColors.green,
      diffRemoved: ansiColors.red,
      diffContext: grays[7],
      diffHunkHeader: grays[7],
      diffHighlightAdded: ansiColors.green,
      diffHighlightRemoved: ansiColors.red,
      diffAddedBg: grays[2],
      diffRemovedBg: grays[2],
      diffContextBg: grays[1],
      diffLineNumber: grays[6],
      diffAddedLineNumberBg: grays[3],
      diffRemovedLineNumberBg: grays[3],

      // Markdown colors
      markdownText: colors.foreground ?? ansiColors.white,
      markdownHeading: colors.foreground ?? ansiColors.white,
      markdownLink: ansiColors.blue,
      markdownLinkText: ansiColors.cyan,
      markdownCode: ansiColors.green,
      markdownBlockQuote: ansiColors.yellow,
      markdownEmph: ansiColors.yellow,
      markdownStrong: colors.foreground ?? ansiColors.white,
      markdownHorizontalRule: grays[7],
      markdownListItem: ansiColors.blue,
      markdownListEnumeration: ansiColors.cyan,
      markdownImage: ansiColors.blue,
      markdownImageText: ansiColors.cyan,
      markdownCodeBlock: colors.foreground ?? ansiColors.white,

      // Syntax colors
      syntaxComment: textMuted,
      syntaxKeyword: ansiColors.magenta,
      syntaxFunction: ansiColors.blue,
      syntaxVariable: colors.foreground ?? ansiColors.white,
      syntaxString: ansiColors.green,
      syntaxNumber: ansiColors.yellow,
      syntaxType: ansiColors.cyan,
      syntaxOperator: ansiColors.cyan,
      syntaxPunctuation: colors.foreground ?? ansiColors.white,
    },
  }
}

function generateGrayScale(bg: RGBA, isDark: boolean): Record<number, RGBA> {
  const grays: Record<number, RGBA> = {}

  const bgR = bg.r
  const bgG = bg.g
  const bgB = bg.b

  const luminance = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB

  for (let i = 1; i <= 12; i++) {
    const factor = i / 12.0

    let grayValue: number
    let newR: number
    let newG: number
    let newB: number

    if (isDark) {
      if (luminance < 10) {
        grayValue = Math.floor(factor * 0.4 * 255)
        newR = grayValue
        newG = grayValue
        newB = grayValue
      } else {
        const newLum = luminance + (255 - luminance) * factor * 0.4
        const ratio = newLum / luminance
        newR = Math.min(bgR * ratio, 255)
        newG = Math.min(bgG * ratio, 255)
        newB = Math.min(bgB * ratio, 255)
      }
    } else {
      if (luminance > 245) {
        grayValue = Math.floor(255 - factor * 0.4 * 255)
        newR = grayValue
        newG = grayValue
        newB = grayValue
      } else {
        const newLum = luminance * (1 - factor * 0.4)
        const ratio = newLum / luminance
        newR = Math.max(bgR * ratio, 0)
        newG = Math.max(bgG * ratio, 0)
        newB = Math.max(bgB * ratio, 0)
      }
    }

    grays[i] = RGBA.fromInts(Math.floor(newR), Math.floor(newG), Math.floor(newB))
  }

  return grays
}

function generateMutedTextColor(bg: RGBA, isDark: boolean): RGBA {
  const bgR = bg.r
  const bgG = bg.g
  const bgB = bg.b

  const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB

  let grayValue: number

  if (isDark) {
    if (bgLum < 10) {
      // Very dark/black background
      grayValue = 180 // #b4b4b4
    } else {
      // Scale up for lighter dark backgrounds
      grayValue = Math.min(Math.floor(160 + bgLum * 0.3), 200)
    }
  } else {
    if (bgLum > 245) {
      // Very light/white background
      grayValue = 75 // #4b4b4b
    } else {
      // Scale down for darker light backgrounds
      grayValue = Math.max(Math.floor(100 - (255 - bgLum) * 0.2), 60)
    }
  }

  return RGBA.fromInts(grayValue, grayValue, grayValue)
}
