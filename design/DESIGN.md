# Session Recorder — design system

The brand is calm, precise, and restrained — Linear / Vercel / Things-app level of
discipline. NOT "AI slop": no purple→blue gradients, no glassmorphism, no emoji
soup, no neon glows, no 5 accent colors, no rounded-everything cartoon look.
One accent, lots of quiet, sharp typography, hairline borders.

## Logo
`design/logo.png` (512) / `design/logo-256.png` — a coral record dot flowing into
a stepped event timeline on a soft tile. Use it small and confident. The mark's
colors ARE the palette.

## Color tokens

Light (default):
- `--ink: #16181d`        text / dark elements
- `--ink-2: #3b3f47`      secondary text
- `--muted: #767b85`      tertiary / meta text
- `--line: #e7e7e3`       hairline borders
- `--bg: #f7f7f5`         app background
- `--surface: #ffffff`    cards / panels
- `--surface-2: #fbfbfa`  insets
- `--accent: #ff5a4d`     THE one accent (record, primary CTA, active)
- `--accent-ink: #ffffff` text on accent
- `--ok: #2f9e6f` · `--warn: #c98a12` · `--danger: #e5484d` (use sparingly, for status only)

Dark (`@media (prefers-color-scheme: dark)` and `:root[data-theme=dark]`):
- `--ink: #ececea` · `--ink-2: #b9bcc2` · `--muted: #878b93`
- `--line: #24272e` · `--bg: #0f1114` · `--surface: #16181d` · `--surface-2: #1b1e24`
- `--accent: #ff6355` (slightly brighter) · rest as-is.

## Type
- Sans stack: `ui-sans-serif, -apple-system, "Segoe UI", Roboto, Inter, system-ui, sans-serif`.
- Mono (timestamps, counts, code): `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`.
- Side panel base 13px / line-height 1.5. Options base 14.5px. Weights: 400 body,
  500 labels, 600 headings. Letter-spacing: -0.01em on headings. Tabular-nums for numbers.

## Shape & depth
- Radius: 8px controls, 10–12px cards, 999px pills.
- Borders: 1px `--line`. Shadows: at most `0 1px 2px rgba(0,0,0,.04)` +
  `0 1px 0 rgba(0,0,0,.02)`; dark mode uses borders, not shadows. NO big blurs.
- 4px spacing grid (4/8/12/16/20/24). Generous padding; let things breathe.

## Components
- **Record button**: not a huge candy button. A confident pill/oval, `--accent`
  fill, white label, a small filled dot to its left, subtle hover lift. Stop =
  ink outline button with a square. Keep it ~44px tall.
- **Buttons**: primary = accent fill; secondary = surface + 1px line; ghost =
  transparent, muted text. 8px radius, 500 weight, no shadow on secondary.
- **Ticker**: monospace `[mm:ss]` in `--muted`, event text in `--ink-2`, one row
  per event, hairline separators, tiny type icons as simple glyphs (not emoji
  zoo). Newest on top, quiet.
- **Level cards (export)**: radio group as selectable cards; selected = accent
  1px ring + faint accent tint; show `~Nk tokens` in mono; a one-line "omits …"
  in `--muted`. If a level's estimate exceeds ~180k tokens, mark it with a small
  `--warn` "large — may exceed model limits" note and default the selection to L1.
- **REC state**: a small pulsing `--accent` dot; never a flashing full bar.
- Mic level meter: a thin horizontal bar, `--accent`, calm.

## Do / don't
- DO align to a grid, use whitespace, keep one accent, use hairlines, tabular
  numbers, real hierarchy.
- DON'T use gradients (except an optional 1% whisper on the hero), drop shadows
  bigger than 2px blur, more than one accent hue, emoji as UI chrome, ALL-CAPS
  everywhere, or centered body text.
