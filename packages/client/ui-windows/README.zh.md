# @deepseek-ai/dsh-client-ui-windows

[English](README.md) | 中文

类 Windows 的桌面壳插件。`Desktop` 注册进内建 `root` 槽——即 ui-layout 的 `AppFrame` 所占据的同一席位——并声明规格完全相同的四个框架子槽（`sidebar`、`conversation`、`details`、`shell.overlay`），因此侧边栏、会话、详情与浮层插件无需改动即可填入桌面。两种布局互为替代、绝不共存：启用本包的同时必须在 profile 中禁用 `@deepseek-ai/dsh-client-ui-layout`（双方声明同名子槽的加载期冲突是有意设计）。

桌面为每个 Host Workspace 投影一个窗口。当前会话所属 workspace 的窗口处于聚焦状态，承载会话界面（详情面板打开时并排显示）；其余窗口显示该 workspace 的会话概览（先按 workspace 账本顺序、再按同 cwd 未入账会话的最近活跃顺序），并提供新建会话操作。当前会话的 cwd 没有对应 workspace 时，渲染一个静态回退窗口，保证会话界面不会消失。窗口支持标题栏拖动、右下角缩放、最小化/最大化，且任何窗框指针按下都会将其置顶；几何、最小化/最大化标记、z 序与面板状态保存在持久化的桌面 store（`dsh.windows.desktop.v1`）中。任务栏为每个 workspace 提供一个按钮并显示当前会话状态；开始按钮切换开始面板，面板承载 `sidebar` 槽（其中包含 workspace 浏览器与添加流程）。workspace 基线就绪且为空时，开始面板自动打开。

插件提供 `ctx.layout`——ui-layout `ILayout` 的结构同型（`toggleSidebar` 切换开始面板，`openDetails`/`closeDetails` 切换聚焦窗口的详情面板）——因此注入 `layout` 的特性插件（侧边栏、会话、app-shell）无需改动即可激活。注册先于服务提供，从而被同步唤醒的依赖 layout 的插件绝不会向未声明的槽注册。该行在 web-app bundle 中默认禁用；可运行的启用示例见 [windows-desktop 示例](../../examples/windows-desktop/README.zh.md)。

## Model Experience

无——桌面是浏览器界面，此包不会进入任何模型请求。

#### KV Cache effect

无；此包既不组装也不发送任何 provider 请求。

## Known Limitations and Deferred Work

- **主题只经 ui-layout 的 presenter 生效**——body 主题属性由 ui-layout 的 apply 写入，因此在 presenter 被抽取或复制之前，桌面 profile 以默认浅色主题启动。
- **关闭即最小化**——关闭窗口会把窗口最小化到任务栏；workspace 记录持续存在，仅能通过侧边栏的删除流程移除。
- **单聚焦窗口**——客户端舞台是单一当前会话，因此只有聚焦窗口流式渲染会话，其余窗口是实时概览。多窗口流式渲染需要平台级的多窗格舞台支持。
- **静态中文文案**——产品文案为硬编码中文；locale 命名空间席位属后续工作。
- **聚焦跟随会话而非点击**——置顶非聚焦窗口只改变 z 序；选中其中某个会话才会真正聚焦该窗口。
