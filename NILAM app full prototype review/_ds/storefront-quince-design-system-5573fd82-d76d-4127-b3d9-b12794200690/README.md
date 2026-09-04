# Quince Design System

A unified design system for Quince — a direct-to-consumer retailer of elevated essentials (apparel, home, bedding, accessories). This system powers the Quince storefront (ecomm-ssr) and future Quince projects.

> **Source:** mirrored from the `storefront-ui-kit` monorepo (pnpm + turborepo). Canonical tokens live in `packages/ds-core/tokens/*`; React + Panda CSS components live in `packages/web-ui/src/components/*`. This design system re-expresses those tokens and components in plain CSS + static JSX so design agents can build branded artifacts without the full build chain.

---

## Index — what's in this folder

| File / folder | What it is |
| --- | --- |
| `README.md` | You are here. Brand context, content, visual foundations, iconography, index. |
| `SKILL.md` | Agent-skill manifest. Load this to work as a Quince brand designer. |
| `colors_and_type.css` | **Single source of truth** for CSS variables (colors, type, spacing, radii, shadows) + semantic type classes (`.q-rich-2xl-dec`, `.q-body-base-default`, …). Import first. |
| `fonts/` | Grosa (sans) + IvyPresto Headline/Text (decorative serif) — woff2. |
| `assets/` | Brand imagery (editorial patterns, product photography). |
| `preview/` | Small HTML cards that populate the Design System tab (one concept per card). |
| `ui_kits/storefront/` | Storefront UI kit: header, PLP, PDP, cart — hi-fi recreations as static JSX. |

### Source materials (not checked in — flag to user if you need deeper access)

- **Codebase:** `storefront-ui-kit` monorepo — `packages/ds-core/tokens`, `packages/web-ui/panda-config`, `packages/web-ui/src/components`, `apps/storybook`, `apps/next-kitchen-sink`.
- No Figma URL was provided in this session.

---

## Brand context

Quince sells "affordable luxury" — premium materials (cashmere, Mongolian cashmere, European linen, silk, Italian leather) at radically transparent factory-direct prices. The brand voice is calm, confident, and editorial. Visual language is restrained: paperwhite backgrounds, a single warm cantaloupe accent, a serif display face paired with a geometric sans, and lots of negative space.

**Products powered by this system:**
- **Storefront (ecomm-ssr)** — the main quince.com shopping experience (Next.js SSR).
- **Future projects** — any internal or consumer product that should feel unmistakably Quince.

The codebase contains both a **web-ui** package (React + Panda CSS) and an **RNKitchenSink** scaffold, so the token system is split into `spacingWeb` (rem) and `spacingApp` (px) — the values are identical, just unit-transformed.

---

## Content fundamentals

Quince copy is quiet, precise, and product-first. It rarely talks about itself.

**Tone & vibe.** Editorial and understated. Reads like a thoughtful boutique, not a marketplace. Reassuring, a little aspirational, never breathless. No exclamation points in running copy; numbers and concrete benefits do the selling.

**Voice.** Second person ("you") for shopping guidance, brand-first ("we") only when transparency is the point ("We work directly with the factories that make for top luxury brands"). Avoid "I".

**Casing.**
- Labels, buttons, eyebrows, nav, small titles → **UPPERCASE with +0.05em letter-spacing**. This is the system's most recognizable texture. Every `-caps` variant in the type system enforces it.
- Editorial headlines, hero statements, product titles in long form → **serif sentence case** (IvyPresto Headline, light weight). Tall, elegant, loose.
- Body copy → sentence case, never title case.

**Specifics.**
- Prices: `$49.90` (no trailing period, no "USD" unless disambiguating). Original prices shown with a strikethrough beside the current price.
- CTAs: short verbs in caps — `ADD TO BAG`, `CHECKOUT`, `SHOP NEW ARRIVALS`, `SHOP ALL`. Almost never more than three words.
- Badges: neutral facts, not exclamations — `NEW`, `BACK IN STOCK`, `LOW STOCK`, `BESTSELLER`.
- Material callouts: the material is the hero. "100% Mongolian cashmere", "Italian full-grain leather", "European flax linen". Weights and thicknesses are worth mentioning (e.g. `14-momme silk`).
- Emoji: **never.** No emoji in product copy, nav, toasts, or marketing. The closest thing to decoration is a serif pull-quote or an image.
- Unicode glyphs as icons: avoided. Icons are strictly from the in-house icon set.
- Inclusive voice: no gendered collective nouns; sizing copy is factual ("runs true", "size up for a relaxed fit").

**Examples (style reference — adapt, don't copy verbatim).**
- Hero eyebrow: `NEW ARRIVALS`
- Hero headline (serif): `Cashmere, rewritten.`
- Supporting line: `Mongolian-spun, factory-direct — the softest 30 you'll own.`
- Product tile title: `Mongolian Cashmere Crewneck Sweater`
- Product tile meta: `$49.90   $149.90` (current beside strike-through)
- Trust strip: `FREE SHIPPING OVER $75 · EASY RETURNS · 50–80% LESS THAN LUXURY BRANDS`
- Empty state: `Nothing here yet — start with new arrivals.`
- Error: `Something went wrong. Please try again.`

---

## Visual foundations

The Quince visual language is **editorial retail**: neutral paper tones, one warm accent, large serif moments floated in white space, photographic product imagery, restrained motion.

### Color

- **Primary accent:** `cantaloupe-100` (`#FFA273`) — warm peach-orange. Used on primary buttons, promo tags, focused chip states. Never used as a large background fill.
- **Text:** `darkgray` (`#21201F`) is the de-facto black. True black is **not** used. Pure white is paired with darkgray for high contrast.
- **Neutrals form a warm grey scale:** `paperwhite #F7F7F5` → `offwhite #EEEEEC` → `lightgray #D9D9D9` → `silvergray #8F8F8F` → `mediumgray #717171` → `gray #606060` → `darkgray #21201F`. Backgrounds hover between white and paperwhite; borders are `lightgray` at rest, `silvergray` on hover, `darkgray` on focus.
- **Editorial accent palette** (seasonal / campaign hits, used sparingly): `blue #BFCAE8`, `navy #2D313F`, `petal #E5CDBD`, `umber #80351B`, `warmgrey #D0D3BB`, `stone #DFDACE`.
- **Semantic:** `red-100 #AF3535` (error) on `red-20 #FDD8D8`; `green-100 #2D822B` (success) on `green-10 #ECF9EB` / `green-20 #D2F2D1`.
- **Transparency tokens** for image overlays: `white-trans-30/50/70`, `darkgray-trans-50`. Used on transparent-tag chips over product photography (with a `backdrop-filter: blur(2px)`).

### Typography

- **Grosa** — the sans. Geometric, slightly humanist, used at 400 + 500 only (no boldface). It does 99% of the interface work.
- **IvyPresto Headline (Light 300)** — the serif. High contrast, tall x-height, elegant. Used for editorial headlines, PDP product titles in marketing surfaces, and large hero moments. Always `-dec` suffix in the type scale.
- **Scale:** a 2-track system — `caps` (sans + uppercase + 0.05em tracking + medium weight) vs `dec` (serif + light weight, sentence case). The same size token (e.g. `title-lg`) ships both. Designers pick caps for taxonomy/navigation/small titles, dec for narrative headlines.
- **Body** is 14px (`body-base`) by default. 16px (`body-lg`) for long reading. 12px (`body-sm`) for captions and helper text. 10px (`body-xs`) for badges and dense chrome only.
- Grosa is responsive: `rich`, `title` sizes step up on `lg` (≥1200px) — see the `@media` block in `colors_and_type.css`.

### Spacing & layout

- Spacing is an **even, modular scale** in 2/4/6/8/10/12/16/20/24/32/40/48/56/64/80/100/120 px. Components primarily use 4–24; layout primarily uses 32–120.
- Breakpoints: `sm 360` / `md 768` / `lg 1200`. Desktop is 1200+.
- Layout is a wide single column with generous page gutters. Grids are 2-up on mobile, 4-up on desktop for product tiles. Whitespace is a design element, not residue.
- Fixed chrome: top nav only. No persistent footers in-app; the marketing footer appears at the bottom of every marketing page.

### Corner radii

Radii are **small**. Quince is not a rounded-card brand.
- `radius-none` (0) — images, cards, content surfaces. **Most Quince UI is square-cornered.**
- `radius-xs` (2) — focus outlines only.
- `radius-sm` (4) — inputs, subtle surfaces.
- `radius-md` (8) — tooltips, menu lists.
- `radius-lg` (16) — rare; only sheet/modal corners on large screens.
- `radius-round` (9999) — **buttons, chips, tags.** All pill-shaped controls use fully rounded.

### Borders & dividers

- Borders are always 1px, `lightgray` at rest, `silvergray` on hover, `darkgray` when active/focused, `red-100` on error.
- Dividers are 1px `lightgray` hairlines. No thick separators.
- Accordions expose their divider on the bottom of every item; decorative accordions use `darkgray` instead of `lightgray`.

### Shadows & elevation

Elevation is **whisper-quiet**. Three elevations exist.
- `shadow-above`  — `0 -6px 16px rgba(33,32,31,0.10)` — sticky bottom sheets, cart drawers rising.
- `shadow-below`  — `0 6px 16px rgba(33,32,31,0.10)`  — sticky headers, dropdowns.
- `shadow-tooltip` — layered 6+12 / 12+24 — tooltips only.

No brand shadow ever uses a tint (blue/gray); they are all translucent darkgray.

### Animation & interaction

- Transitions: `150ms ease-out` (color, border, bg), `200ms ease-in-out` (chevron rotations), `300ms ease-in-out` (accordion slide, modal slide up/down by 16px).
- No bounces, no springs, no scale-on-press. Everything is a short linear fade or translate.
- Skeletons "blink" between `offwhite` and `lightgray` on a 5s loop.
- Hover: buttons and chips **lighten** (offwhite fill, paperwhite fill). The primary button darkens subtly inside its own hue (`cantaloupe-100 → cantaloupe-90 → cantaloupe-80`).
- Press/active: one more step lighter (or in the primary case, one more shade of cantaloupe). Inputs shift border to `mediumgray`.
- Focus: 2px solid darkgray outline, 0.25rem offset — visible only on keyboard focus.

### Imagery

- Photography is **warm, natural light**. Mid-afternoon daylight color temperature. No heavy grain, no duotone, no B&W.
- Product shots: three modes — flat on paperwhite (PLP thumbnails), on-figure studio (editorial), and in-situ lifestyle (homepage / PDP gallery).
- Full-bleed hero images are common on the homepage; framed 4:5 tiles are the norm on PLP; 1:1 or 4:5 on PDPs.
- No heavy gradients over imagery. When text must sit on a photo, use `white-trans-70` capsules or `darkgray-trans-50` overlays sparingly.
- No hand-drawn illustrations. No repeating patterns (other than `assets/pattern-1.jpg`, `pattern-2.webp` which are editorial linen textures).

### Transparency & blur

Used only for chips/tags over imagery (`white-trans-70` + `backdrop-filter: blur(2px)`). No glass-morphism, no full-frame blurs.

### Cards

A Quince "card" is almost never a bordered, shadowed rectangle. The closest approximation is a product tile: a 4:5 image, no border, no shadow, with 8–12px of breathing room and plain text below it. Modals and sheets get borders and shadows; tiles don't.

---

## Iconography

- **In-house icon set, ~100+ strokes**, shipped as React SVG components in `packages/web-ui/src/icons/`. Every icon is a 20×20 outlined glyph, `stroke="currentColor"` with `strokeLinecap="square"` and `strokeLinejoin="round"`, stroke width ≈ 1px (`0.063rem`) via `vector-effect="non-scaling-stroke"`. Fills are rare; solid variants are suffixed `-solid-icon.tsx`.
- **Style:** thin-stroke, flat-capped, retail-friendly. Think truck, bag, bag-plus, hanger, bedding, dress, alarm, gift, installments, reward-star, crop, discount, star, outofstock, no-return.
- **Conventions:** `foo-icon.tsx` (outline) + `foo-solid-icon.tsx` (filled). Many icons come with a `-circle` variant (icon inside a stroked circle).
- **Flag icons** are separate, rectangular 3:2 SVGs in `icons/flags/` — `ca`, `de`, `gb`, `us`. Used in locale switchers.
- **Usage:** icons appear at 1rem (small) or 1.25rem (default). Button leading/trailing icons are sized to match: `lg` → 1.25rem, `md` → 1rem, `sm` → 0.75rem. Icon-only buttons use the `IconButton` component at 2rem minimum touch target.
- **This design system** does not ship the full icon set as SVG (the codebase holds 100+). For mockups we reference a close outline set — **CDN fallback: Lucide (`https://unpkg.com/lucide-static@latest`)** which matches the stroke style closely (1.5px vs 1px — tell the agent to set `stroke-width="1"` for tighter alignment). Flag in artwork when used. If a specific Quince glyph is needed, copy it directly from `storefront-ui-kit/packages/web-ui/src/icons/<name>.tsx`.
- **Emoji:** never used.
- **Unicode as icons:** not used — except the literal `/` separator in breadcrumbs.

---

## Typography font files

All four Grosa weights (regular + medium, upright + italic) and both IvyPresto variants (Headline Light, Text Light) were copied from the codebase into `fonts/`. No Google Fonts substitution required — the real .woff2 assets are present.

If you ever need to fall back (e.g. a standalone HTML bundle with no network), nearest Google Fonts matches are:
- **Grosa** → `DM Sans` or `Manrope` (both are humanist-geometric at similar optical size).
- **IvyPresto Headline** → `Playfair Display` (light weight) — flag as a substitution.

---

## Quick start for agents

1. Link `colors_and_type.css` first — it carries fonts, tokens, and the semantic type classes.
2. Use the CSS variables (`var(--color-cantaloupe-100)`, `var(--space-16)`, …) rather than re-inventing values.
3. For buttons, inputs, chips, accordions, and the product tile, import the matching JSX file from `ui_kits/storefront/`.
4. When composing a page, start with the `Header` + `Footer` and a `max-width: 1440px` centered main. Use `paperwhite` as the default page background only when imagery needs breathing room — the default is plain white.
5. For uppercase labels, use `.q-body-sm-caps` or `.q-body-base-caps`; for editorial headlines use `.q-rich-2xl-dec` or `.q-title-2xl-dec`. The serif + light-weight is the look.
