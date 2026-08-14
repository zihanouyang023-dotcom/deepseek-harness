# Agent Note: The Windows-like desktop shell — an alternative root layout over the Workspace windows

Status: implemented

English | [中文](2026-08-15-windows-desktop-shell.zh.md)

> Scope: the `@deepseek-ai/dsh-client-ui-windows` plugin — how a second, mutually exclusive shell layout composes over the same feature plugins, and why the workspace is the window. The [slot system standard](2026-07-22-slot-type-chain-implementation.md) owns the registration semantics; the [web client architecture](2026-07-19-gui-web-client-architecture.md) owns the surrounding client stack.

## Problem

The three-column `AppFrame` renders every surface through one fixed skeleton. A desktop-shell alternative (one window per Workspace, a taskbar, a start panel) needs the same feature plugins — sidebar, conversation, details, overlay — to fill it unchanged, but the slot system gives the declaring entry exclusive render authority over its child slots, and two layouts cannot both declare the same frame slots.

## Decision

The desktop is a sibling root entry: `ui-windows` registers `Desktop` into the built-in `root` slot and declares the same four child slots (`sidebar`, `conversation`, `details`, `shell.overlay`) with structurally identical specs. The two layouts therefore never co-load — a load-time declaration conflict is the intended enforcement — and a profile enables the desktop only while disabling `ui-layout`. The plugin ships as a disabled row in the web-app bundle; the windows-desktop example overlay (and the user-level `$DSH_HOME` patch layer) flip both rows together.

`ui-windows` provides `ctx.layout` itself, a structural twin of ui-layout's `ILayout` (`toggleSidebar` toggles the start panel; `openDetails`/`closeDetails` toggle the focused window's details pane). Feature plugins inject `layout` as a service, so sidebar, conversation, and the app-shell activate unchanged; the slot names are the composition contract, not the frame implementation. The registration runs before the service provision inside one effect, so a synchronously woken layout-dependent plugin never registers into an undeclared slot.

One window renders per Host Workspace. The focused window is the one whose Workspace is the current session's cwd and hosts the conversation; every other window shows that Workspace's session overview; a current session with no matching Workspace renders in a static fallback window. Window geometry, z-order, minimize/maximize, and panel state live in a persisted root-scope store; interactions are title-bar drag, corner resize, double-click maximize, and raise on any pointer-down. The workspace directory each window shows is the same directory that sandboxes its sessions (session cwd = `sandbox-policy` workspace root), so the window is the sandbox's own projection — no host mechanism is added.

## Consequences

The default web composition is unchanged (the row is disabled), so the shipped snapshots stay valid; the desktop is one profile overlay away. The accepted costs: the desktop loses ui-layout's theme presenter (light theme only), close maps to minimize, only the focused window streams a conversation (the client stage is a single current session — multi-window streaming needs the platform-level multi-pane stage), and product copy is static Chinese pending the locale seat.

## Alternatives considered

| Rejected | One-line reason |
|---|---|
| Floating windows over `shell.overlay` beside `AppFrame` | The overlay entry cannot render the frame's `conversation` slot — render authority belongs to the declaring entry |
| Runtime shadowing of `root` while `ui-layout` stays loaded | Both entries declaring the same child slots is a load-time conflict; a profile switch is the one honest composition |
| One window per session | The Workspace is the directory that sandboxes sessions, so the Workspace is the window's domain anchor; sessions stay rows inside it |
| Re-using `ui-layout`'s `LayoutController` by value import | Cross-plugin value imports are a bundle purity error; the structural twin keeps each layout self-contained |
