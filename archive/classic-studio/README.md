# ScriptureFlow Live - Classic Studio Pro (Archived Variant)

## Purpose & Context
This folder contains the archived snapshot of **Classic Studio Pro**, the traditional 3-zone broadcast console layout (Zone 1: Sidebar with Agenda + Library, Zone 2: Slide Workspace Deck, Zone 3: Stage Preview + AI Speech Feed).

It has been archived from the main application runtime to streamline ScriptureFlow Live around the flagship **Bento Studio Pro** layout, reducing dual-DOM maintenance and bundle size while preserving this layout for future review, tablet adaptations, or standalone projects.

---

## File Contents
- index.html: Complete working snapshot containing the #classic-layout-root markup, classic header, mobile zone tabs, 3-zone deck, and associated modal dialogs.

## Associated Core Files (in root)
- css/main.css: Core CSS styling for the Classic studio layout (#app-workspace, #zone-library, #zone-deck, #zone-preview, #app-header).
- js/theme-manager.js: Layout specification previously registered under THEME_LAYOUT_SPECS.classic with resizers (esizer-left, esizer-right, esizer-agenda).

## How to Run or Review Standalone
To view or test the Classic layout independently:
1. You can open rchive/classic-studio/index.html directly in a browser or serve it via a local HTTP server.
2. Note that relative paths to css/, js/, and ibles/ point to the project parent directory (../../).
