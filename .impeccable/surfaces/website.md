---
version: 1
slug: "website"
primary_target: "website/index.html"
related_targets: ["website/site.css", "scripts/website/layout.mjs", "scripts/website/pages-home.mjs", "scripts/website/pages-features.mjs", "scripts/website/pages-compare.mjs", "scripts/website/build.mjs"]
---

# Website: from captured bug to actionable issue

Mode: Persuade (home); Read (features, comparisons, guides and help). This is a public website extension of the established compact Linear/Raycast direction. The scoped token contract is [docs/website/DESIGN.md](../../docs/website/DESIGN.md). Root `DESIGN.md`, `.impeccable/design.json` and `PRODUCT.md` remain unchanged.

## Direction contract

THESIS: Make the captured bug → annotated evidence → actionable GitHub issue workflow understandable before asking someone to install.

OWN-WORLD: Flat, typography-led pages in the existing neutral white/charcoal palette. Coral actions and links, blue annotation geometry and focus. System light/dark, no theme switch. Larger website reading sizes are a surface exception to the compact extension, not a replacement identity.

STORY: Lead with the bug-to-issue promise and installation action, show an explicitly synthetic report, then explain recording, annotation, filing, optional accounts, data handling and agent handoff. Nine feature pages expose specific capability, setup and limitation details. Five paid-product comparisons explain fit, workflow and pricing with cited, dated vendor sources, including reasons to choose each competitor.

FIRST VIEWPORT: Shared sticky brand/navigation and Add to Chrome; the home headline, explanatory lede, primary install and secondary feature link; provider-charge caveat; then the report figure. Document pages lead with breadcrumb and h1. The report figure demonstrates draft, annotations and diagnostic evidence in two panes, stacked on narrow screens.

FORM: Code-led extension of the established direction. No new image comp was required or approved. The home illustration is HTML with labeled synthetic checkout data, not product proof or a screenshot. Use actual evidence when presenting real captured outcomes.

## Scoped behavior and exceptions

- Website type uses the existing platform stack with a larger document and home headline ramp. This observation does not introduce a global display-font rule.
- The 70rem shell and 42rem prose measure support reading; controls remain restrained. Page indexes are rows and comparisons are tables.
- At 760px and below, navigation scrolls in a second visible row, home columns stack and the report illustration stacks. The primary installation action stays in the header.
- At 600px and below, comparison tables stack one aspect at a time. Each product or column value retains a visible label; original column headers remain visually clipped and duplicate labels are hidden from assistive technology. Apply this to vendor comparisons and the comparison hub.
- Index rows stack at 620px; facts at 520px; footer columns change at 860px. At 420px the synthetic report repository segment is omitted while File issue remains represented.
- Focus uses the website's blue outline. Only the synthetic report frame and comment use the website shadow vocabulary. These exceptions do not alter extension controls or tokens.
- The install band repeats the cost caveat; availability tags distinguish local features from optional own-account services. Content truth remains in product and implementation evidence.

## Evidence and status

Recorded October 25, 2026 from `website/site.css`, `website/index.html`, `scripts/website/layout.mjs`, `scripts/website/pages-home.mjs`, `scripts/website/pages-features.mjs`, `scripts/website/pages-compare.mjs`, existing `docs/website/DESIGN.md` and `PRODUCT.md`.

The material mobile comparison readability finding has a source-level repair: the stylesheet stacks tables at 600px and the generator supplies per-cell labels. The reviewer gave that focused repair a ship verdict: mobile comparisons were readable and complete, the desktop table was retained, and all recaptures were valid. The parent also reported all 31 site checks and the desktop/mobile crawler passing. This is scoped verification, not a new whole-site visual or accessibility audit.

Not canonized or repaired: wider application token drift and the stylesheet’s overridden document-lede declaration. The effective prose role is recorded rather than legitimizing an unused value. This pass is documentation-only within its two-file boundary; the parent separately corrected the stylesheet header’s contract path. The incumbent system-stack home headline is recorded as scoped implementation evidence, not a global display-face prescription.

## Build and maintenance

Generated HTML is committed; browsing requires no build. Edit page content in `scripts/website/`, then run `node scripts/website/build.mjs` to regenerate pages, sitemap and `llms.txt`. Legacy guide main content is retained while the shared frame changes. `node scripts/website/check.mjs` validates links, anchors, metadata, JSON-LD, sitemap/llms coverage and leaks. Root-token preservation and mobile table behavior remain review obligations.

Keep internal links relative through the generator's `~/` token so the website works at the GitHub Pages subpath and a local root. Preserve honest, sourced comparisons when vendor plans change; pricing check dates are content evidence, not visual-system tokens.
