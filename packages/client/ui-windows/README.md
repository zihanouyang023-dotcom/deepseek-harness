# @deepseek-ai/dsh-client-ui-windows

English | [中文](README.zh.md)

Windows-like desktop shell plugin. `Desktop` registers into the built-in `root` slot — the same seat ui-layout's `AppFrame` occupies — and declares the same four frame child slots (`sidebar`, `conversation`, `details`, `shell.overlay`) with identical specs, so the sidebar, conversation, details, and overlay plugins fill the desktop unchanged. The two layouts are alternatives, never co-loaded: a profile enables this package and disables `@deepseek-ai/dsh-client-ui-layout` (both declaring the same child slots is a load-time conflict by design).

The desktop renders a fixed left sidebar column (the native ui-sidebar: workspace browser, session list, add flow, settings) beside an infinite canvas over a dark multi-glow wallpaper. The canvas pans on a blank-area drag and zooms on the wheel anchored at the cursor, with world-space window coordinates — windows hold position across pan/zoom and are never clipped by the viewport; wheeling over a window scrolls that window's content instead of rezooming. Opening a session (selecting it in the sidebar, or creating one) pops its window into the canvas, maximized by default; the current session's window hosts the native conversation surface (plus the details pane while open), and every previously opened window stays mounted as a lightweight placeholder showing that session's title and running state, so opening a new session never tears a prior one down. Windows drag by the title bar, resize from the bottom-right handle, minimize/maximize, and close; geometry, minimize/maximize flags, z-order, the opened set, sidebar, and viewport state live in the persisted desktop store (`dsh.windows.desktop.v4`). The taskbar shows one button per opened session window plus the current session status, and a sidebar toggle.

The plugin provides `ctx.layout` — a structural twin of ui-layout's `ILayout` (`toggleSidebar` toggles the fixed left column, `openDetails`/`closeDetails` toggle the focused window's details pane) — so feature plugins that inject `layout` (sidebar, conversation, app-shell) activate unchanged. Registration precedes service provision, so a synchronously woken layout-dependent plugin never registers into an undeclared slot. The row ships disabled in the web-app bundle; see the [windows-desktop example](../../examples/windows-desktop/README.md) for the runnable overlay.

## Model Experience

None, as the desktop is browser chrome; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Themes apply only through ui-layout's presenter** — the body theme attributes are written by ui-layout's apply, so the desktop profile starts on the default light theme until the presenter is extracted or duplicated.
- **Close minimizes** — closing a window minimizes it to the taskbar; sessions persist and are removed through the sidebar's own flows.
- **One streaming window** — the client stage is a single current session, so only the current window streams a conversation; other windows are placeholders. Multi-window streaming needs the platform-level multi-pane stage (the per-window session claim is the stage-2 seam).
- **Static Chinese copy** — product copy is hard-coded Chinese; the locale namespace seat is deferred work.
