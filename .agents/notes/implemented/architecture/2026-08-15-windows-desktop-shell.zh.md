# Agent Note:Windows 式桌面壳——固定侧边栏 + 会话窗口无限画布

Status: implemented

[English](2026-08-15-windows-desktop-shell.md) | 中文

> 范围:`@deepseek-ai/dsh-client-ui-windows` 插件——第二个互斥的壳布局如何复用同一批特性插件进行组合,以及为什么窗口的单元是会话。[slot 系统标准](2026-07-22-slot-type-chain-implementation.zh.md) 负责注册语义;[web 客户端架构](2026-07-19-gui-web-client-architecture.zh.md) 负责周边的客户端栈。

## Problem

三栏 `AppFrame` 通过一个固定骨架渲染所有界面。桌面壳替代方案需要同一批特性插件——侧边栏、会话、详情、浮层——原样填充,但 slot 系统把子槽的渲染权排他地授予声明方,而两种布局不能同时声明同一组框架槽。

## Decision

桌面是根条目的兄弟:`ui-windows` 把 `Desktop` 注册进内建 `root` 槽,并以结构相同的规格声明同样的四个子槽(`sidebar`、`conversation`、`details`、`shell.overlay`)。因此两种布局绝不共存——加载期声明冲突就是有意的强制约束——profile 只在禁用 `ui-layout` 的同时启用桌面。插件以禁用行形式随 web-app bundle 发布;windows-desktop 示例 overlay(以及用户级 `$DSH_HOME` patch 层)同时翻转这两行。

桌面渲染一个固定的左侧侧边栏列(原生 ui-sidebar 保持常驻,不再被塞进开始面板),其右侧是一块无限画布:空白处按住拖动平移世界坐标、滚轮以光标为锚点缩放,窗口坐标为世界坐标,因此平移缩放永不裁剪窗口。每个已列出的会话渲染一个独立窗口:当前会话的窗口承载原生 `conversation`(含详情面板),其余窗口保持挂载为轻量占位帧、显示该会话的标题与运行状态——打开会话绝不会拆毁先前的窗口。窗口几何、z 序、最小化/最大化、侧边栏与视口状态保存在持久化的根作用域 store(`dsh.windows.desktop.v3`);交互包括标题栏拖动、右下角缩放、双击最大化、任意按下置顶。

`ui-windows` 自行提供 `ctx.layout`,它是 ui-layout `ILayout` 的结构同型(`toggleSidebar` 切换固定左列;`openDetails`/`closeDetails` 切换聚焦窗口的详情面板)。特性插件以服务形式注入 `layout`,因此侧边栏、会话与 app-shell 无需改动即可激活;槽名才是组合契约,而不是框架实现。注册先于服务提供、二者同在一个 effect 内,因此被同步唤醒的依赖 layout 的插件绝不会向未声明的槽注册。

## Consequences

默认 web 组合不变(该行为禁用行),既有快照保持有效;桌面距你只差一层 profile overlay。接受的代价:桌面失去 ui-layout 的主题 presenter(仅浅色主题)、关闭映射为最小化、只有当前窗口流式渲染会话(客户端舞台是单一当前会话——每窗口的会话认领是阶段 2 的多窗格接口)、产品文案为静态中文(locale 席位待补)。

## Alternatives considered

| 被否方案 | 一句话理由 |
|---|---|
| 在 `shell.overlay` 上悬浮窗口、`AppFrame` 保持加载 | overlay 条目无法渲染框架的 `conversation` 槽——渲染权属于声明方 |
| 保持 `ui-layout` 加载、运行时遮蔽 `root` | 两个条目声明同名子槽是加载期冲突;profile 切换是唯一诚实的组合方式 |
| 每个 workspace 一个窗口 + 窗口内会话标签页 | 窗口内自定义标签条是非原生 chrome;原生会话切换器是侧边栏的 workspace/session 列表 |
| 把侧边栏塞进开始面板 | 侧边栏是一等常驻界面;弹出面板把它藏到一处额外手势之后 |
| 以值导入复用 `ui-layout` 的 `LayoutController` | 跨插件值导入是 bundle 纯净性错误;结构同型让两种布局各自独立 |
