# Session Recorder design system

The brand is calm, precise and restrained. Aim for the discipline of Linear, Vercel or the Things app. Avoid generic AI styling: no purple-to-blue gradients, no glassmorphism, no crowded emoji, no neon glows, no five accent colours, no rounded cartoon look. Use one accent, plenty of quiet space, sharp typography and hairline borders.

## Logo

The logo lives at `design/logo.png` (512) and `design/logo-256.png`. It shows a coral record dot flowing into a stepped event timeline on a soft tile. Use it small. The mark's colours are the palette.

## Colour tokens

Light theme is the default.

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#16181d` | text and dark elements |
| `--ink-2` | `#3b3f47` | secondary text |
| `--muted` | `#767b85` | tertiary and meta text |
| `--line` | `#e7e7e3` | hairline borders |
| `--bg` | `#f7f7f5` | app background |
| `--surface` | `#ffffff` | cards and panels |
| `--surface-2` | `#fbfbfa` | insets |
| `--accent` | `#ff5a4d` | the one accent (record, primary call to action, active) |
| `--accent-ink` | `#ffffff` | text on accent |
| `--ok` | `#2f9e6f` | status only, use sparingly |
| `--warn` | `#c98a12` | status only, use sparingly |
| `--danger` | `#e5484d` | status only, use sparingly |

Dark theme applies through `@media (prefers-color-scheme: dark)` and `:root[data-theme=dark]`. Override these tokens and keep the rest as-is:

| Token | Value |
| --- | --- |
| `--ink` | `#ececea` |
| `--ink-2` | `#b9bcc2` |
| `--muted` | `#878b93` |
| `--line` | `#24272e` |
| `--bg` | `#0f1114` |
| `--surface` | `#16181d` |
| `--surface-2` | `#1b1e24` |
| `--accent` | `#ff6355` (slightly brighter) |

## Type

Use these font stacks and sizes:

- sans stack: `ui-sans-serif, -apple-system, "Segoe UI", Roboto, Inter, system-ui, sans-serif`
- mono stack for timestamps, counts and code: `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`
- side panel base is 13px with line-height 1.5; options base is 14.5px
- weights are 400 for body, 500 for labels, 600 for headings
- set letter-spacing to -0.01em on headings and use tabular numbers for figures

## Shape and depth

- radius is 8px for controls, 10 to 12px for cards and 999px for pills
- borders are 1px `--line`
- shadows are at most `0 1px 2px rgba(0,0,0,.04)` plus `0 1px 0 rgba(0,0,0,.02)`; dark mode uses borders, not shadows, and no large blurs
- space on a 4px grid (4, 8, 12, 16, 20, 24) and use generous padding

## Components

Record button. Use a confident pill or oval rather than a large candy button. Fill it with `--accent`, give it a white label and a small filled dot to its left, and add a subtle hover lift. The stop button uses an ink outline with a square. Keep the button about 44px tall.

Buttons. Primary buttons use an accent fill. Secondary buttons use a surface with a 1px line. Ghost buttons are transparent with muted text. Use an 8px radius and 500 weight, and no shadow on secondary buttons.

Ticker. Show a monospace `[mm:ss]` in `--muted` and the event text in `--ink-2`, one row per event, with hairline separators. Use small type icons as simple glyphs, not emoji. Put the newest event on top and keep it quiet.

Level cards for export. Present the radio group as selectable cards. The selected card gets a 1px accent ring and a faint accent tint. Show `~Nk tokens` in mono and a one-line "omits ..." note in `--muted`. If a level's estimate is over about 180k tokens, add a small `--warn` note that reads "large — may exceed model limits" and default the selection to L1.

Record state. Use a small pulsing `--accent` dot, never a flashing full bar.

Mic level meter. Use a thin horizontal bar in `--accent`, kept calm.

## Do and don't

Do:

- align to a grid and use whitespace
- keep one accent
- use hairlines, tabular numbers and real hierarchy

Don't:

- use gradients, apart from an optional 1% whisper on the hero
- use drop shadows larger than 2px blur
- use more than one accent hue
- use emoji as interface chrome
- set text in all-caps everywhere
- centre body text
