# @deepseek-ai/dsh-client-ui-windows

English | [中文](README.zh.md)

Windows-like desktop shell plugin. `Desktop` registers into the built-in `root` slot — the same seat ui-layout's `AppFrame` occupies — and declares the same four frame child slots (`sidebar`, `conversation`, `details`, `shell.overlay`) with identical specs, so the sidebar, conversation, details, and overlay plugins fill the desktop unchanged. The two layouts are alternatives, never co-loaded: a profile enables this package and disables `@deepseek-ai/dsh-client-ui-layout` (both declaring the same child slots is a load-time conflict by design).

The desktop projects one window per Host Workspace. The window of the current session's workspace is focused and hosts the conversation (plus the details pane while open); every other window shows that workspace's session overview (account order first, same-cwd extras by recency) with a New Session action. A current session whose cwd has no Workspace renders in a static fallback window so the conversation surface never disappears. Windows drag by the title bar, resize from the bottom-right handle, minimize/maximize, and raise on any chrome pointer-down; geometry, minimize/maximize flags, z-order, and panel state live in the persisted desktop store (`dsh.windows.desktop.v1`). The taskbar shows one button per Workspace plus the current session status; the start button toggles a start panel that hosts the `sidebar` seat, which carries the workspace browser and add flow. On an empty, ready Workspace baseline the start panel opens automatically.

The plugin provides `ctx.layout` — a structural twin of ui-layout's `ILayout` (`toggleSidebar` toggles the start panel, `openDetails`/`closeDetails` toggle the focused window's details pane) — so feature plugins that inject `layout` (sidebar, conversation, app-shell) activate unchanged. Registration precedes service provision, so a synchronously woken layout-dependent plugin never registers into an undeclared slot. The row ships disabled in the web-app bundle; see the [windows-desktop example](../../examples/windows-desktop/README.md) for the runnable overlay.

## Model Experience

None, as the desktop is browser chrome; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Themes apply only through ui-layout's presenter** — the body theme attributes are written by ui-layout's apply, so the desktop profile starts on the default light theme until the presenter is extracted or duplicated.
- **Close minimizes** — closing a window minimizes it to the taskbar; workspaces persist in the registry and are removed only through the sidebar's delete flow.
- **One focused window** — the client stage is a single current session, so only the focused window streams a conversation; other windows are live overviews. Multi-window streaming needs the platform-level multi-pane stage.
- **Static Chinese copy** — product copy is hard-coded Chinese; the locale namespace seat is deferred work.
- **Focus follows the session, not clicks** — raising a non-focused window only changes z-order; selecting a session inside it is what focuses the window.
