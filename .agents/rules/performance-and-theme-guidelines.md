# ScriptureFlow Live Pro - Core Architecture & Developer Rules

## 1. 0ms Latency & Tactile Responsiveness Mandate (Compulsory)
- **Instant In-Place State & Visual Updates**: All user clicks, slide projections, verse selections, song selections, menu toggles, and modal openings must update state and DOM classes immediately in-place (< 1ms execution time).
- **Zero Full-DOM Rebuilding on Hot Paths**: Never execute `innerHTML = ''` or rebuild entire decks, libraries, or agendas when simply selecting a slide or switching an active card. Update classes (`.live`, `.active`, `.live-active`, etc.) and inject/remove badges in-place.
- **Ultra-Fast Interactive Transitions**: Interactive UI elements (buttons, segmented pills, tabs, option items, slide cards) must NOT have sluggish multi-property transitions (150ms–250ms). Hover/active transitions must be `<= 0.04s` or instant (`0s`), ensuring snappy, tactile feedback.
- **Instant Modal & Popover Display**: Modals (Settings, Search, Reset, Import) and popovers must open/close in `<= 0.05s` or instantly without blocking JavaScript execution.

## 2. Non-GPU Backdrop Filter Directive (Compulsory)
- **Strict Prohibition on GPU-Heavy Gaussian Blurs**: NEVER use `backdrop-filter: blur(...)` or `-webkit-backdrop-filter: blur(...)` across full-screen modal backdrops, large panels, decks, slide cards, toolbars, settings, menus, popovers, or floating dialogs in any existing or subsequent themes (Classic, Bento, or any future themes).
- **High-Performance Solid & Alpha Surfaces**: Modals, popovers, and panels must ALWAYS use crisp, hardware-accelerated solid/semi-transparent background fills (e.g. `rgba(8, 8, 12, 0.88)` / `#131218` in dark mode, `#ffffff` in light mode) with high-contrast 1px borders (`rgba(255, 255, 255, 0.1)`).
- **Zero Frame Drops**: Eliminating full-screen GPU blur ensures 60–120fps fluid rendering without lag, stutter, or GPU rasterization bottlenecks.

## 3. Multi-Theme Consistency (Classic, Bento, & Subsequent Themes)
- Any new theme, layout, or modal added to the application must strictly adhere to this 0ms in-place rendering pattern and non-GPU blur standard.
- Active slide indicators, live badges, and borders across all themes must update in-place without triggering layout thrashing or deck re-renders.

## 4. Notification Layering & UI Principles
- **Topmost Layer**: Notifications (toasts, alerts, status banners) must ALWAYS render with the highest stacking order (`z-index: 100000+`) above all modals, custom dialogs, sheets, and popovers.
- **Emoji Restriction**: Use industry-standard SVG icons (Lucide, Heroicons, Material) instead of unrequested emojis.
