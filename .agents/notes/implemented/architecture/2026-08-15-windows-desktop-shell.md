# Agent Note: The Windows-like desktop shell — a fixed sidebar beside an infinite canvas of session windows

Status: implemented

English | [中文](2026-08-15-windows-desktop-shell.zh.md)

> Scope: the `@deepseek-ai/dsh-client-ui-windows` plugin — how a second, mutually exclusive shell layout composes over the same feature plugins, and why the session is the window. The [slot system standard](2026-07-22-slot-type-chain-implementation.md) owns the registration semantics; the [web client architecture](2026-07-19-gui-web-client-architecture.md) owns the surrounding client stack.

## Problem

The three-column `AppFrame` renders every surface through one fixed skeleton. A desktop-shell alternative needs the same feature plugins — sidebar, conversation, details, overlay — to fill it unchanged, but the slot system gives the declaring entry exclusive render authority over its child slots, and two layouts cannot both declare the same frame slots.

## Decision

The desktop is a sibling root entry: `ui-windows` registers `Desktop` into the built-in `root` slot and declares the same four child slots (`sidebar`, `conversation`, `details`, `shell.overlay`) with structurally identical specs. The two layouts therefore never co-load — a load-time declaration conflict is the intended enforcement — and a profile enables the desktop only while disabling `ui-layout`. The plugin ships as a disabled row in the web-app bundle; the windows-desktop example overlay (and the user-level `$DSH_HOME` patch layer) flip both rows together.

The desktop renders a fixed left sidebar column (the native ui-sidebar stays resident, not reparented into a start panel) beside an infinite canvas: blank-area drag pans world space, the wheel zooms anchored at the cursor, and window coordinates are world coordinates so pan/zoom never clips a window. One window renders per listed session: the current session's window hosts the native `conversation` (plus the details pane), and every other window stays mounted as a lightweight placeholder showing that session's title and running state — opening a session never tears a prior window down. Window geometry, z-order, minimize/maximize, sidebar, and viewport state live in a persisted root-scope store (`dsh.windows.desktop.v3`); interactions are title-bar drag, corner resize, double-click maximize, and raise on any pointer-down.

`ui-windows` provides `ctx.layout` itself, a structural twin of ui-layout's `ILayout` (`toggleSidebar` toggles the fixed left column; `openDetails`/`closeDetails` toggle the focused window's details pane). Feature plugins inject `layout` as a service, so sidebar, conversation, and the app-shell activate unchanged; the slot names are the composition contract, not the frame implementation. The registration runs before the service provision inside one effect, so a synchronously woken layout-dependent plugin never registers into an undeclared slot.

## Consequences

The default web composition is unchanged (the row is disabled), so the shipped snapshots stay valid; the desktop is one profile overlay away. The accepted costs: the desktop loses ui-layout's theme presenter (light theme only), close maps to minimize, only the current window streams a conversation (the client stage is a single current session — the per-window session claim is the stage-2 multi-pane seam), and product copy is static Chinese pending the locale seat.

## Alternatives considered

| Rejected | One-line reason |
|---|---|
| Floating windows over `shell.overlay` beside `AppFrame` | The overlay entry cannot render the frame's `conversation` slot — render authority belongs to the declaring entry |
| Runtime shadowing of `root` while `ui-layout` stays loaded | Both entries declaring the same child slots is a load-time conflict; a profile switch is the one honest composition |
| One window per Workspace with in-window session tabs | A custom in-window tab strip is non-native chrome; the native session switcher is the sidebar's workspace/session list |
| Moving the sidebar into a start panel | The sidebar is a resident first-class surface; a popup panel hides it behind an extra gesture |
| Re-using `ui-layout`'s `LayoutController` by value import | Cross-plugin value imports are a bundle purity error; the structural twin keeps each layout self-contained |
