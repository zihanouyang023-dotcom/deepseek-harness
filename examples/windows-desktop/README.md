# windows-desktop

English | [中文](README.zh.md)

Runnable overlay that switches the Web UI from the three-column shell to the [windows desktop plugin](../../packages/client/ui-windows/README.md): one window per Workspace, a taskbar, and a start panel hosting the workspace browser. The workspace each window projects is the same directory that sandboxes its sessions, so the window's content is the sandbox's own projection.

## Run it

    pnpm dsh web --patch examples/windows-desktop/cordis.yml

Then open <http://127.0.0.1:3080>. The overlay disables `ui-layout` and enables `ui-windows`; both must flip together, because the two layouts register into the same `root` slot and declare the same frame child slots.
