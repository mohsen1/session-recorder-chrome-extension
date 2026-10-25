---
name: "Session Recorder by Proofline"
description: "Compact, clean and sharp tools for recording and reporting bugs."
colors:
  accent: "oklch(0.205 0.012 260)"
  accent-text: "oklch(0.49 0.13 255)"
  accent-ink: "#ffffff"
  accent-tint: "oklch(0.94 0.03 255)"
  accent-line: "oklch(0.49 0.13 255 / 0.5)"
  ink: "oklch(0.205 0.012 260)"
  ink-2: "oklch(0.44 0.012 260)"
  muted: "oklch(0.54 0.01 260)"
  line: "oklch(0.915 0.004 260)"
  bg: "#ffffff"
  surface: "#ffffff"
  surface-2: "oklch(0.962 0.003 260)"
  ok: "#24734f"
  warn: "#8a5c08"
  danger: "#b52f36"
  danger-tint: "rgba(229, 72, 77, 0.09)"
  accent-dark: "oklch(0.93 0.004 260)"
  accent-ink-dark: "oklch(0.19 0.01 260)"
  accent-text-dark: "oklch(0.72 0.11 255)"
  accent-tint-dark: "oklch(0.3 0.05 255)"
  accent-line-dark: "oklch(0.72 0.11 255 / 0.5)"
  ink-dark: "oklch(0.93 0.004 260)"
  ink-2-dark: "oklch(0.72 0.008 260)"
  muted-dark: "oklch(0.62 0.009 260)"
  line-dark: "oklch(0.275 0.008 260)"
  bg-dark: "oklch(0.2 0.006 260)"
  surface-dark: "oklch(0.2 0.006 260)"
  surface-2-dark: "oklch(0.235 0.007 260)"
  ok-dark: "#79c9a2"
  warn-dark: "#e2b861"
  danger-dark: "#fa9298"
  danger-tint-dark: "rgba(229, 72, 77, 0.14)"
  annotation-pin: "#1269ca"
  annotation-outline: "#1683ff"
typography:
  headline:
    fontFamily: "Geist Variable, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist Variable, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Geist Variable, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  prose:
    fontFamily: "Geist Variable, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Geist Variable, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
  meta:
    fontFamily: "Geist Variable, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
  code:
    fontFamily: "Geist Mono Variable, Geist Mono, ui-monospace, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  control: "5px"
  container: "6px"
  popover: "12px"
  composer: "26px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
    height: "32px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-stop:
    backgroundColor: "transparent"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  record-split:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "5px"
    height: "28px"
  settings-input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 9px"
  navigation-link:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "7px 10px"
  tab-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  capture-popover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.popover}"
    padding: "14px"
    width: "250px"
  annotation-composer:
    backgroundColor: "#ffffff"
    textColor: "#202124"
    rounded: "{rounded.composer}"
    padding: "6px 7px 6px 16px"
---

# Design System: Session Recorder

## Overview

**Creative North Star: "Report first"**

The approved replacement is compact, clean and sharp, drawing on the user’s Linear and Raycast references. Neutral surfaces, precise system typography and ink primary actions make evidence and writing easy to scan for QA and product teams. This system supersedes the previous warm, card-heavy direction.

The material is flat and practical: whitespace and hairlines establish structure, controls are small, and elevation signals a temporary layer. Light and dark themes follow system appearance, with explicit app theme attributes taking precedence. Captured screenshots are evidence; the replacement introduces no shipping raster decoration.

**Key Characteristics:**

- Compact controls with a readable document hierarchy.
- Neutral white or charcoal surfaces with quiet divisions.
- Ink actions and blue links use separate contrast roles.
- Blue selection geometry and numbered pins belong to live annotations.

Extracted from the current implementation on October 24, 2026. The user approved the replacement direction and composition. Independent screenshot review approved the composition; the final verdict resolved the text contrast, annotation pin contrast, and design persistence findings with a ship disposition. The surface-specific contract is [Report first](.impeccable/surfaces/entrypoints-share-app-tsx.md), and [PRODUCT.md](PRODUCT.md) records the approval.

## Colors

The palette combines neutral paper or charcoal with Proofline ink actions. The frontmatter contains the normative values; names ending in `-dark` override their unsuffixed roles in dark appearance. Unchanged colors retain their light value.

### Primary

Proofline’s console theme in `entrypoints/sidepanel/styles.css` owns the active palette. The official four-part mark is the only multicolor brand element. Geist and Geist Mono are bundled locally.

Proofline ink (`accent`) carries Record and File issue with a contrasting `accent-ink`. Proofline blue (`accent-text`) carries links and secondary action emphasis. Tint and line roles provide quieter selected states. The solid primary button keeps the fill-colored border.

### Secondary

Annotation blue has a functional selection role: the outline is bright and the numbered pin uses a deeper fill with white text. It is scoped to the live annotation overlay. Success, warning and danger tokens carry status meaning in both themes.

### Neutral

`bg` and `surface` form a continuous document canvas. `surface-2` distinguishes the rail, hover states and fields. `ink`, `ink-2` and `muted` carry reading hierarchy; `line` supplies hairlines. Prefer these semantic roles over hard-coded palette variants.

**The Accent Roles Rule.** Use the fill token for solid actions and the text token for blue labels, links and outlined actions. Theme-specific text and status colors must retain their distinct roles.

## Typography

The system uses bundled Geist and Geist Mono, with platform sans and monospace fallbacks. These are the user's approved compact application references; there is no marketing display face or oversized hero type.

Report titles use the `headline` role, reducing to 23px at the intermediate report breakpoint and 22px at the narrow breakpoint. Section headings use `title`; report prose uses `prose`; controls use `label`; captions and secondary metadata use `meta`. The settings app header uses 14px type; its active section title is 20px, reducing to 18px below 600px. The recording timer is 17px monospace at weight 500 with tabular numbers. Labels use normal sentence case.

**The Evidence Type Rule.** Use system sans for reading and control labels, and monospace with tabular numerals for timestamps, code and diagnostic values.

## Layout

The shared grammar is a compact navigation or control band next to a readable content area. Use small spacing steps for controls and larger gaps for document sections. Configuration groups remain flat with bottom hairlines. Existing settings session rows and temporary dialogs may use bounded containers.

The report implements a 180px rail and sticky 62px header. The content grid reserves 226px for metadata; the document has 46px top padding, horizontal padding of `clamp(24px, 4vw, 65px)`, 80px bottom padding and a 1100px maximum width. These dimensions describe this report surface, not a mandatory grid for every new screen.

At 1050px and below, the report rail becomes 154px, metadata 196px, and document padding 32px 26px 60px. At 760px and below, the rail disappears, a back action appears, the sticky header becomes 56px, metadata moves below the document, and document padding becomes 28px 20px 30px. The issue action remains visible. Captured evidence uses contain sizing, capped at 440px high on desktop and 350px on narrow screens.

Settings use a 960px page limit, 164px navigation and 28px gap; at 600px and below navigation wraps into padded rows with an underline for the current page. All tabs remain visible without horizontal scrolling. A compact brand breadcrumb and Help link form the app header; below 360px its title stacks beneath the brand rather than hiding it. The side panel uses 14px horizontal insets, a fixed control area, a scrolling live timeline and a pinned capture bar. The full recording timeline remains a secondary legacy surface linked from the report.

**The Quiet Structure Rule.** Separate document sections with space and selective hairlines; do not wrap each paragraph or settings group in a card.

## Elevation & Depth

The report and settings are flat, separated by tone and one-pixel borders. The shared subtle shadow token is disabled in dark appearance. Temporary layers retain local depth: the capture popover uses `0 8px 30px rgba(0, 0, 0, 0.16)`, the voice modal uses `0 16px 50px rgba(0, 0, 0, 0.28)`, and the annotation composer uses `0 2px 8px #00000016`. These exceptions must not become routine section-card styling.

**The Temporary Layer Rule.** Keep the workspace flat. Reserve stronger shadows for the capture popover, voice modal and anchored annotation composer.

## Shapes

Controls use the `control` radius and bounded small containers use `container`. The capture popover is softer at `popover`. Reserve full pills for compact status or tab chips, and the larger `composer` radius for the live annotation bar. Selection geometry is rectangular; numbered annotation pins use a 28px circle with one small corner. The report brand is a small CSS record ring, not a new image asset.

## Components

Primary buttons use coral fill, white text and weight 600. The report action has a 32px minimum height, 6px 12px padding and 12px type. Secondary buttons use a surface, line border and weight 500; ghost buttons remove the resting fill and border. Stop uses coral text and a translucent coral border. Hover changes tone or brightness. Disabled controls reduce opacity and remove the pointer cursor. Keyboard focus uses a two-pixel coral outline, with a three-pixel offset in the report.

File issue is a split action with a 32px repository picker segment. While filing, replace the workspace with a full-height progress screen: a centered 460px bordered panel, an inline Octocat and heading, the current issue title, destination, four compact stages, live status and Cancel. Stage-specific SVG activity icons exchange a packet, write lines, lift an upload arrow and draw a check; reduced motion shows static icons. Preserve system appearance. Repository settings are flat rows separated by hairlines, with a token per destination.

Record is centered above the session list: a 104px-wide, 28px-high split control with 5px corners, 12px semibold text, 8px horizontal main-button padding and a 22px options segment. Its popover contains capture detail and optional media controls. The former record-pill styling is not the current component contract.

The idle list has no visible section heading or post-recording banner. Each row shows its generated session name, relative recording time and duration; file sizes are omitted. Exact date/time remains available on the time label. The annotation close button has no outline ring; keyboard focus changes its existing border instead.

Settings fields use a tinted surface, 7px 9px padding, 12.5px type, a line border and two-pixel coral focus outline. Report metadata fields use the plain surface and 6px 8px padding. The report title is an editable borderless text area; the optional markdown editor is a 13px monospace field. Error and saving feedback stays near the relevant action.

Navigation uses 7px 10px padding, compact icons and quiet hover fills. Desktop settings navigation uses neutral ink and a tinted surface; narrow tabs use a coral underline. GitHub uses the official Octocat mark. Captured tab chips use a hairline border, muted 11px text and a small success dot. Evidence is a figure with a caption, preserved image proportions and optional numbered comments, rather than a nested card stack.

The annotation composer is an anchored 48px-minimum-height pill, at most 360px wide and clamped to the viewport. It contains a text area, optional dictation control and circular check action. Element selection uses a solid blue outline; freeform selection uses dashed blue. Enter submits, Shift+Enter inserts a line, and Escape returns to selection then exits. The shadow-root overlay follows system appearance independently of the app's theme attributes.

Control transitions generally use 150ms easing; the small live recording dot pulses over 1.6 seconds. Reduced-motion preference disables app animations and transitions. The overlay uses direct state changes without ornamental motion.

**The Compact Action Rule.** Keep the primary report action and record split control compact; their hierarchy comes from placement and color.

## Do's and Don'ts

### Do:

- Do follow system light and dark appearance and use the corresponding semantic tokens.
- Do keep recording and filing obvious while placing advanced controls in disclosures.
- Do preserve evidence proportions and keep writing readable at narrow widths.
- Do provide visible keyboard focus and respect reduced motion.

### Don't:

- Don't restore oversized record pills or nested card-heavy layouts.
- Don't use the coral fill token as small text when the text token is available.
- Don't apply coral action styling to blue annotation selection geometry.
- Don't replace captured evidence with decorative raster imagery.
