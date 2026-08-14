# @deepseek-ai/dsh-client-ui-windows

[English](README.md) | 中文

类 Windows 的桌面壳插件。`Desktop` 注册进内建 `root` 槽——即 ui-layout 的 `AppFrame` 所占据的同一席位——并声明规格完全相同的四个框架子槽（`sidebar`、`conversation`、`details`、`shell.overlay`），因此侧边栏、会话、详情与浮层插件无需改动即可填入桌面。两种布局互为替代、绝不共存：启用本包的同时必须在 profile 中禁用 `@deepseek-ai/dsh-client-ui-layout`（双方声明同名子槽的加载期冲突是有意设计）。

桌面渲染一个固定的左侧侧边栏列（原生 ui-sidebar：workspace 浏览器、会话列表、添加流程、设置入口），其右侧是一块铺在深色多重光晕壁纸上的无限画布。画布支持在空白处按住拖动平移、滚轮以光标为锚点缩放，窗口坐标采用世界坐标——窗口在平移缩放中保持位置、永不被视口裁剪；在窗口内滚动滚轮会滚动该窗口内容而非缩放画布。打开某会话（在侧边栏点它或新建）会把它弹进画布、默认最大化；当前会话的窗口承载原生会话界面（细节面板打开时并排显示），其余已打开的窗口保持挂载为轻量占位帧、显示该会话的标题与运行状态——因此打开新会话绝不会销毁先前的会话窗口。窗口支持标题栏拖动、右下角缩放、最小化/最大化与关闭；几何、最小化/最大化标记、z 序、已打开集合、侧边栏与视口状态保存在持久化的桌面 store（`dsh.windows.desktop.v4`）中。任务栏为每个已打开会话窗口提供一个按钮并显示当前会话状态，附一个侧边栏开关。

插件提供 `ctx.layout`——它是 ui-layout `ILayout` 的结构同型（`toggleSidebar` 切换固定左列，`openDetails`/`closeDetails` 切换聚焦窗口的详情面板）——因此注入 `layout` 的特性插件（侧边栏、会话、app-shell）无需改动即可激活。注册先于服务提供，从而被同步唤醒的依赖 layout 的插件绝不会向未声明的槽注册。该行在 web-app bundle 中默认禁用；可运行的启用示例见 [windows-desktop 示例](../../examples/windows-desktop/README.zh.md)。

## Model Experience

无——桌面是浏览器界面，此包不会进入任何模型请求。

#### KV Cache effect

无；此包既不组装也不发送任何 provider 请求。

## Known Limitations and Deferred Work

- **主题只经 ui-layout 的 presenter 生效**——body 主题属性由 ui-layout 的 apply 写入，因此在 presenter 被抽取或复制之前，桌面 profile 以默认浅色主题启动。
- **关闭即最小化**——关闭窗口会把窗口最小化到任务栏；会话记录持续存在，仅通过侧边栏自身流程移除。
- **单流式窗口**——客户端舞台是单一当前会话，因此只有当前窗口流式渲染会话，其余窗口是占位帧。多窗口流式渲染需要平台级多窗格舞台（每窗口的会话认领正是阶段 2 的接口）。
- **静态中文文案**——产品文案为硬编码中文；locale 命名空间席位属后续工作。
