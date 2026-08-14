# windows-desktop

[English](README.md) | 中文

可运行的叠加层，把 Web 界面从三栏壳切换为 [windows 桌面插件](../../packages/client/ui-windows/README.zh.md)：每个 Workspace 一个窗口、底部任务栏，以及承载 workspace 浏览器的开始面板。每个窗口投影的 workspace 正是沙盒化其会话的那个目录——窗口内容就是沙盒自身的投影。

## 运行方式

    pnpm dsh web --patch examples/windows-desktop/cordis.yml

然后打开 <http://127.0.0.1:3080>。该叠加层禁用 `ui-layout` 并启用 `ui-windows`；两者必须同时翻转，因为两种布局注册进同一个 `root` 槽并声明同名的框架子槽。
