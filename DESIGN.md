# Design System: ScriptureFlow Live Pro

## 1. Visual Theme & Atmosphere
- **Atmosphere:** A high-agency, cockpit-dense broadcast console designed for church media teams and live video engineers. Clinical, ultra-legible, and dark — optimized for low-light sound booths and live OBS/vMix production environments.
- **Density:** Cockpit Dense (8 / 10) — High data clarity without visual clutter.
- **Variance:** Asymmetric Ergonomic (7 / 10) — Clear 3-zone functional spatial allocation (Library → Slide Deck → Live Stage & AI HUD).
- **Motion:** Fluid Hardware-Accelerated (6 / 10) — Spring-physics transitions for live slide changes, pulse animations for active OBS broadcasts.

---

## 2. Color Palette & Roles
- **Abyss Base** (`#090D16`) — Deepest structural backdrop behind all panels.
- **Panel Surface** (`#0F172A`) — Primary 3-zone container surfaces and header/footer bars.
- **Card Fill** (`#1E293B`) — Interactive slide cards, library items, and inputs.
- **Card Hover** (`#334155`) — Interactive hover state.
- **Starlight White** (`#F8FAFC`) — Primary text, scriptures, and slide lyrics.
- **Muted Steel** (`#94A3B8`) — Metadata, shortcuts, and secondary labels.
- **Royal Blue Accent** (`#3B82F6`) — Primary actions, active tab borders, selection rings.
- **Emerald Broadcast Live** (`#10B981`) — Active live OBS broadcast state and active slide glow.
- **Danger Crimson** (`#EF4444`) — Emergency panic bar clear text action.
- **Warning Gold** (`#F59E0B`) — Emergency clear background action.

*(Max 1 primary accent: Royal Blue #3B82F6. Live state: Emerald #10B981. Pure black #000000 and neon purple/pink gradients are strictly BANNED).*

---

## 3. Typography Architecture
- **Display & Headlines:** `Geist` or `Outfit` — Track-tight (-0.02em), controlled scale, weight-driven hierarchy (600/700/800).
- **Body & Lyrics:** `Geist` or `Satoshi` — Relaxed leading (1.4), max 65 characters per line, ultra-legible on dark surfaces.
- **Monospace (Data & VU Meters):** `Geist Mono` or `JetBrains Mono` — Used for verse numbers, audio decibel levels (`-14 dB`), hotkey shortcuts, and timestamps.
- **Banned:** `Inter`, generic browser default fonts, and serif fonts (`Times New Roman`, `Georgia`).

---

## 4. Component Stylings

### A. Slide Deck Cards (Verse & Stanza Cards)
- **Normal State:** Slate card (`#1E293B`) with 1px border (`#334155`), rounded corners (10px).
- **Hover State:** `-2px` Y-axis translate with `#475569` border.
- **Active Live State:** Glowing 2px Emerald border (`#10B981`) with `box-shadow: 0 0 16px rgba(16, 185, 129, 0.4)` and a pulsing `🟢 LIVE NOW` badge.

### B. Command Palette (`Ctrl + K`)
- Floating glassmorphic modal (`#0F172A` at 95% opacity with `backdrop-filter: blur(12px)`).
- Instant natural language parsing (`Jn 3:16`, `Gen 1:1`, `Way Maker`) with keyboard arrow key navigation and Enter execution.

### C. Worship Medley Deck
- Multi-song preloaded cards with collapsible accordions (`🎵 SONG 1`, `🎵 SONG 2`, `🎵 SONG 3`).
- All 3 to 4 planned worship songs preloaded on screen simultaneously for 1-click medley transitions.

### D. Persistent Emergency Panic Bar
- Fixed 56px bottom bar containing high-contrast emergency buttons:
  - `Clear Text (F1)` — Red (`#EF4444`)
  - `Clear BG (F2)` — Gold (`#F59E0B`)
  - `Blackout (F3)` — Dark Slate (`#1E293B`)
  - `Church Logo (F4)` — Dark Slate (`#1E293B`)

---

## 5. Layout Principles & Grid Systems
- **3-Zone Grid System:**
  - **Zone 1 (Left Library):** Fixed 280px width for **BIBLE**, **SONGS**, and **SETLIST**.
  - **Zone 2 (Center Workspace):** Flexible `1fr` area for Single Song Deck or Worship Medley Deck.
  - **Zone 3 (Right Preview/HUD):** Fixed 340px width for Live Stage Preview iframe and docked AI Scripture HUD.
- **Spatial Separation:** No overlapping elements — every element occupies its own clean spatial zone.
- **Dynamic Auto-Fitting (`fitText`):** Text size automatically adjusts based on line count so long scriptures never clip or overflow.

---

## 6. Motion & Animation Rules
- **Live Slide Transition:** Smooth `0.3s cubic-bezier(0.16, 1, 0.3, 1)` fade and micro-scale (`0.97` → `1.0`).
- **Live Broadcast Pulse:** Continuous `2s` opacity pulse (`0.8` → `1.0`) on the active live badge.
- **Hardware Acceleration:** All animations must use `transform` (`translate3d`, `scale3d`) and `opacity` exclusively for zero frame drops in OBS.

---

## 7. Explicit Anti-Patterns (Banned AI Tells)
- No pure black (`#000000`)
- No `Inter` font
- No neon purple/pink button glows
- No emojis anywhere in the system UI
- No overlapping windows — AI HUD must dock cleanly into the right sidebar
- No multi-step book/chapter dropdowns (replaced by `Ctrl+K` command palette)
- No duplicated tabs or search bars

---

## 8. Universal Theme Contract & Medley System Architecture
- **Presentation Layer Independence:** Themes (e.g. Bento Studio Pro, Classic Studio Pro, or future custom layouts) strictly control visual styling, card geometry, typography classes, and surface tokens.
- **Universal Business Logic & Settings Contract:** All functional features and configuration settings operate as a unified source of truth across all themes:
  - `state.showBibleMedleyButtons`: Controls dynamic visibility of quick slot buttons (`S1`, `S2`, `S3`) on the Bible library list.
  - `state.showMedleyView`: Controls dynamic visibility of quick slot buttons (`S1`, `S2`, `S3`) on the Songs library list.
  - `state.bibleMedleyChangeTarget`: Controls whether Bible medley column "Change" triggers chapter selection (`'chapter'`) or translation switching (`'version'`), including contextual button labels and tooltips.
  - `state.isMedleyMode`: Controls whether the center workspace renders a single passage/song deck or the multi-slot Medley Deck.
  - All theme renderers (`renderLibrary`, `renderBentoLibrary`, `renderDeck`, `renderBentoDeck`, etc.) must consume these unified state flags.

---

## 9. 0ms Latency & Non-GPU Backdrop Filter Mandate (All Themes)
- **Zero Full-Screen Gaussian Blurs**: `backdrop-filter: blur(...)` is strictly banned on full-screen modal backdrops, large panels, decks, slide cards, toolbars, settings, menus, and popovers. Use crisp, high-performance solid/semi-transparent background fills (`rgba(8, 8, 12, 0.88)` / `#131218` in dark mode, `#ffffff` in light mode).
- **0ms Instant In-Place Updates**: All clicks, slide projections, verse selections, song selections, menu toggles, and modal openings must update state and DOM classes immediately in-place (< 1ms execution time).
- **Zero Full-DOM Teardowns on Hot Paths**: Never execute `innerHTML = ''` or rebuild entire decks, libraries, or agendas when selecting a slide. Update classes (`.live`, `.active`) and inject/remove badges in-place.
- **Fast Interactive Transitions**: Interactive elements must not have sluggish 150ms–250ms transitions. Hover/active transitions must be `<= 0.04s` or instant (`0s`). Modals and popovers must open/close in `<= 0.05s`.
