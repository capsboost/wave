---
name: Wave Anime
description: Cyberpunk & retrowave design system for high-performance anime tracking and streaming
colors:
  primary: "#FF003C"
  cyber-cyan: "#00F0FF"
  data-purple: "#BD00FF"
  void-black: "#020204"
  surface: "#131317"
  surface-glass: "rgba(10, 10, 15, 0.7)"
  surface-container-low: "#1b1b1f"
  surface-container: "#1f1f23"
  surface-container-high: "#2a292e"
  surface-container-highest: "#353439"
  on-surface: "#e5e1e7"
  on-surface-variant: "#e9bcba"
  outline: "#af8786"
  outline-variant: "#5f3e3e"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Outfit, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: "0.1em"
rounded:
  none: "0px"
  sm: "0px"
  md: "0px"
spacing:
  gutter: "clamp(16px, 2vw, 24px)"
  page-margin-desktop: "clamp(32px, 5vw, 64px)"
  stack-sm: "8px"
  stack-md: "16px"
  stack-lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "#ff3366"
  button-secondary:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.cyber-cyan}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  card-anime:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.none}"
---

# Design System: Wave Anime

## Overview

**Creative North Star: "The Neon Retrowave Terminal"**

Wave Anime is built around an unapologetic, high-contrast cyberpunk and retrowave visual identity. Inspired by futuristic heads-up displays (HUDs), neon terminal interfaces, and brutalist digital layout, the interface prioritizes high-energy visual distinction and immediate clarity for anime fans.

The visual experience relies on pitch-black void surfaces (`#020204`), sharp geometric cuts (`clip-corner` and `clip-chip`), stark typography pairings, and electric neon highlights (`#FF003C` crimson, `#00F0FF` cyan, and `#BD00FF` purple). Smooth backdrop blurs (`surface-glass`) create depth without compromising the angular aesthetic.

**Key Characteristics:**
- Stark `#020204` void backgrounds paired with vibrant neon accents.
- Angular cutouts and clipped corners (`clip-corner`) instead of rounded cards or pill buttons.
- Distinct triple-font hierarchy: Space Grotesk for titles, Outfit for descriptions, and JetBrains Mono for metadata chips.
- Interactive neon glows and custom crimson scrollbars.
- Keyboard focus uses a clear cyan outline; reduced-motion preferences disable smooth scrolling and decorative motion.
- Page margins and grid gutters scale fluidly from compact mobile spacing to the desktop maximum.

## Colors

The palette pairs a deep void background with targeted high-chroma neon accents to deliver an intense HUD feel.

### Primary
- **Neon Crimson** (`#FF003C`): Used for primary action buttons, active navigation indicators, key highlights, progress bars, and custom scrollbars.

### Secondary
- **Cyber Cyan** (`#00F0FF`): Used for interactive accents, active filter states, status indicators, and secondary action hover states.

### Tertiary
- **Data Purple** (`#BD00FF`): Reserved for special tags, badges, administrative elements, and broadcast highlights.

### Neutral
- **Void Black** (`#020204`): Deep background void for maximum contrast.
- **Dark Surface** (`#131317`): Base container background for cards, modals, and sidebar navigation.
- **Glass Overlay** (`rgba(10, 10, 15, 0.7)`): Translucent backdrop filter background.
- **On-Surface Text** (`#e5e1e7`): Primary readable text.
- **Muted Variant Text** (`#e9bcba`): Secondary text, timestamps, and metadata descriptions.
- **Outline Border** (`#353439`): Subtle container boundary stroke.

### Named Rules
**The Neon Signal Rule.** Primary Neon Crimson (`#FF003C`) is reserved for primary actions, active state indicators, and critical signals. Never flood container backgrounds with solid neon red.

## Typography

**Display Font:** Space Grotesk (sans-serif)
**Body Font:** Outfit (sans-serif)
**Label/Mono Font:** JetBrains Mono (monospace)

**Character:** Space Grotesk brings an angular, techno-brutalist weight to headings, Outfit provides ultra-clean body readability, while JetBrains Mono reinforces the terminal HUD identity for tags, timers, and metadata.

### Hierarchy
- **Display** (Bold, 64px / mobile 40px, line-height 1.1, letter-spacing -0.02em): Used for hero headers and major page title sections.
- **Headline** (Semi-bold, 32px / 24px, line-height 1.2): Used for section headers and anime title headers.
- **Title** (Semi-bold, 24px, line-height 1.2): Used for component headings and card titles.
- **Body** (Regular, 16px / 18px, line-height 1.5): Used for descriptions, comment text, and main content.
- **Label** (Medium uppercase, 12px / 14px, letter-spacing 0.1em): Used for metadata chips, episode tags, timestamps, and status labels.

### Named Rules
**The HUD Label Rule.** All technical metadata, episode numbers, status chips, and button labels must use JetBrains Mono in uppercase with explicit letter-spacing (`letter-spacing: 0.1em`).

## Layout

Layouts follow a responsive grid with structured spacing tokens (`stack-sm: 8px`, `stack-md: 16px`, `stack-lg: 32px`, `gutter: 24px`). Desktop margins expand to `64px`, tablet to `32px`, and mobile to `16px`.

Grid containers prioritize full-width media presentation with floating navigation bars and multi-column anime cards.

## Elevation & Depth

Wave Anime relies on **flat glassmorphism and border contrast** rather than soft ambient drop shadows. Depth is achieved via:
1. Backdrop filter blur (`backdrop-blur-md` with `rgba(10, 10, 15, 0.7)`).
2. High-contrast border strokes (`#353439` default, shifting to `#00F0FF` cyan on hover).
3. Neon glow highlights (`box-shadow: 0 0 15px rgba(255, 0, 60, 0.4)`).

### Named Rules
**The Anti-Shadow Rule.** Traditional soft gray drop shadows are prohibited. Surfaces are flat at rest, utilizing border strokes or targeted neon glows for elevation.

## Shapes

Shapes enforce an angular cyberpunk geometry across all UI elements.

- **Radius Strategy:** Zero border radius (`border-radius: 0px`).
- **Clipping Strategy:** Use CSS `clip-path` utility classes (`clip-corner` and `clip-chip`) to create chamfered/angled cutouts on cards, buttons, and badges.
- **Borders:** Thin 1px solid borders using `#353439` or accent colors.

### Named Rules
**The Zero-Radius Rule.** Standard rounded corners (`border-radius: 8px` or `rounded-lg`) are strictly forbidden. All containers must be sharp rectangles or chamfered clip shapes.

## Components

### Buttons
- **Shape:** Angular rectangular or `clip-corner` cutout (`border-radius: 0px`).
- **Primary:** Background `#FF003C`, text `#ffffff`, font `JetBrains Mono` bold uppercase. Hover shifts to `#ff3366` with slight glow.
- **Secondary:** Background `#1f1f23`, border `#5f3e3e`, text `#00F0FF`. Hover shifts border to `#00F0FF` with background tint.
- **Ghost/Icon:** Transparent background, icon in `#e5e1e7`, hover shifts icon color to `#00F0FF`.

### Chips & Tags
- **Style:** Background `#1b1b1f`, text `#00F0FF` or `#FF003C`, border `#353439`.
- **Typography:** `JetBrains Mono` 12px uppercase (`text-label-caps`).

### Cards & Containers
- **Corner Style:** Sharp 0px radius or `clip-corner`.
- **Background:** `#131317` (`surface`) or `#1b1b1f` (`surface-container-low`).
- **Border:** 1px solid `#353439`.
- **Hover:** Border shifts to `#00F0FF` cyan or `#FF003C` crimson, card scales slightly or brightens.

### Inputs & Fields
- **Style:** Background `#1b1b1f`, text `#e5e1e7`, border `#353439`, 0px radius.
- **Focus:** 1px border `#FF003C` with subtle crimson glow ring.

### Navigation
- **Style:** Sticky glassmorphism header (`background: rgba(10, 10, 15, 0.7)`, `backdrop-blur-md`).
- **Active State:** Neon crimson bottom border line and active text highlight.

## Do's and Don'ts

### Do:
- **Do** use `Space Grotesk` for all major headings and titles.
- **Do** use `JetBrains Mono` uppercase for all metadata, chips, timers, and button labels.
- **Do** enforce sharp 0px corners and `clip-corner` cutout shapes.
- **Do** use `#FF003C` crimson and `#00F0FF` cyan for state transitions and hover glows.

### Don't:
- **Don't** use standard rounded corners (`rounded-lg`, `rounded-md`, or `border-radius: 8px`).
- **Don't** use soft ambient drop shadows on dark backgrounds.
- **Don't** use generic system sans-serif fonts for headings or labels.
- **Don't** flood screen backgrounds with bright neon red or cyan.
