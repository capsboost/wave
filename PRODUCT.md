# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Anime enthusiasts and casual viewers discovering, tracking, and watching anime across desktop and mobile browsers. Community members also engage in episode comments, receive notifications, and manage watch history across devices; site administrators monitor analytics and broadcast system updates.

## Product Purpose

Wave Anime provides a fast anime discovery, tracking, and streaming experience with cached data, watch progress, community features, and a cyberpunk interface. It reduces typical slow API load times by caching synchronized streaming data in serverless PostgreSQL while providing automated intro/outro skipping and cross-session watch-state sync.

## Positioning

Unlike standard anime aggregation websites or slow wrapper apps, Wave Anime decouples long-running third-party API sync (Anikoto, AniList) into a background engine, serving edge-rendered data instantly from Neon Database alongside a signature brutalist cyberpunk aesthetic.

## Operating Context

Web application used on desktop and mobile browsers. Primary activities include streaming episodes with video player controls, tracking episode progress, writing/upvoting comments, viewing notifications, and managing watchlists.

## Capabilities and Constraints

- **Capabilities**:
  - Edge-fast anime browsing and detail pages using serverless Postgres.
  - Video streaming with AniSkip automatic OP/ED skipping.
  - User authentication and session persistence via Better Auth.
  - Episode-level community comments and upvotes.
  - Real-time in-app notification system for replies and broadcasts.
  - Admin dashboard with privacy-focused traffic analytics and announcements.
- **Constraints**:
  - Heavy background API sync logic must run outside Next.js on the Render Express backend to adhere to Vercel Hobby serverless timeouts (10-60s limit).
  - Anikoto API rate limits (60 requests / 120s) require strict pagination and delays in background tasks.
  - Keep Vercel Hobby request work lightweight while preserving backend account and watch-state behavior.
  - Maintain clear, standard terminology across responsive desktop and mobile experiences.

## Brand Commitments

- **Name**: Wave Anime
- **Visual Language**: Retrowave / Cyberpunk theme.
- **Palette**: `void-black` (`#020204`), `neon-crimson` (`#FF003C`), `cyber-cyan` (`#00F0FF`), `data-purple` (`#BD00FF`).
- **Geometrics**: Angular brutalist styling with `clip-corner` and `clip-chip` shapes; avoiding standard rounded corners (`rounded-lg`).
- **Typography**: Space Grotesk (headings), Outfit (body text), JetBrains Mono (labels/chips/code).

## Evidence on Hand

- Source code in `app/`, `components/`, `db/`, `store/`, and `backend/`.
- Repository documentation in `README.md` and system rules in `AGENTS.md`.

## Product Principles

1. **Instant Response First**: Prioritize local Neon database queries over heavy runtime API fetching to keep page loads fast and responsive.
2. **Cyberpunk Authenticity (Visuals Only)**: Enforce sharp geometric cutouts, stark contrast, and neon highlights across all UI surfaces without falling back to generic rounded components. However, *text content and labels must remain straightforward, clear, and standard* (avoid overly stylized jargon like "Databanks").
3. **Decoupled Heavy Lifting**: Offload long-running background tasks and external rate-limited syncing to dedicated services.
4. **Seamless Resume**: Maintain friction-free watch state and history sync across user sessions.

## Accessibility & Inclusion

- High-contrast neon-on-dark visual hierarchy for clear legibility.
- Keyboard accessible video playback and navigation controls.
- Clear, specific, and standard terminology for all user-facing text to ensure maximum usability and avoid confusion.
