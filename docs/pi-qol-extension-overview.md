# pi-qol 扩展概览（vstack）

本文档记录对上游仓库 **[vanillagreencom/vstack](https://github.com/vanillagreencom/vstack)** 中 **`pi-extensions/pi-qol`** 的阅读结论：定位、功能清单，以及各功能对应的主要源文件。便于在本仓库（dotpi）中对照或移植思路。

> **说明**：实现依赖 **`@earendil-works/pi-coding-agent`** 与 **`@earendil-works/pi-tui`**（与 `@mariozechner/*` API 兼容、包名不同）。入口由 `package.json` 的 `pi.extensions` 指向 `./extensions/qol.ts`。

---

## 定位

**pi-qol**（npm：`@vanillagreen/pi-qol`）是面向 **Pi Coding Agent** 的 **Quality-of-Life（体验增强）** 扩展，主要包括：

- 紧凑状态栏（仓库、分支、模型、thinking level、上下文占用等）
- π 紧凑提示编辑器或带 QOL 行为的默认编辑器（多行草稿、图片 chip 等）
- 会话自动命名、`/rename`、历史会话搜索与上下文导入
- `/context` 上下文窗口分解、`/handoff` 新会话交接草稿
- 危险 `bash` 命令前的权限门
- 多通道通知（终端 bell、OSC、tmux、可选 UI 等）
- 可定制的 compaction（含空闲触发、分支摘要、远程 HTTP 等）
- 折叠「Thinking」块旁的计时器
- 与 **pi-caveman**、**pi-agents-tmux** 的轻量集成（徽章、快捷键、子窗格标记）

安装与命令说明以官方 **README** 为准：  
<https://github.com/vanillagreencom/vstack/blob/main/pi-extensions/pi-qol/README.md>

---

## 仓库内路径约定

下文路径均相对于 vstack 仓库中的目录：

`pi-extensions/pi-qol/`

---

## 顶层文件

| 文件                        | 作用                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `README.md`                 | 功能说明、安装（`pi install npm:@vanillagreen/pi-qol` / vstack）、命令表、设置分组说明                                  |
| `package.json`              | npm 包元数据；`pi.extensions: ["./extensions/qol.ts"]`；`vstack.extensionManager.settings` 内为 QOL 设置面板完整 schema |
| `assets/settings-panel.png` | 设置面板截图                                                                                                            |
| `assets/session-search.gif` | 会话搜索演示                                                                                                            |
| `assets/context-usage.png`  | `/context` 用量示意图                                                                                                   |

---

## 入口与编排

| 功能           | 说明                                                                  | 主要文件            |
| -------------- | --------------------------------------------------------------------- | ------------------- |
| **扩展总入口** | 防重复安装、总开关 `enabled`、注册命令/快捷键、订阅事件、组合各子模块 | `extensions/qol.ts` |

---

## 设置与共享代码

| 功能               | 说明                                                    | 主要文件                                             |
| ------------------ | ------------------------------------------------------- | ---------------------------------------------------- |
| **设置 UI schema** | 各选项的 label、default、category、是否需 reload 等     | `package.json`（`vstack.extensionManager.settings`） |
| **设置读取**       | `settingBoolean` / `settingNumber` / `settingString` 等 | `extensions/qol/settings.ts`                         |
| **常量与符号**     | 消息类型、默认模型、Symbol key、间隔毫秒数等            | `extensions/qol/constants.ts`                        |
| **ANSI**           | 如 `stripAnsi`，供状态栏、编辑器、会话名规范化等        | `extensions/qol/ansi.ts`                             |
| **小工具**         | 如错误字符串化                                          | `extensions/qol/util.ts`                             |

---

## 状态栏与 tmux / 会话标题

| 功能                       | 说明                                                                                              | 主要文件                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **紧凑状态栏**             | 项目名、分支与脏标记、模型显示名、thinking level、上下文余量百分比与条形进度；可选替换内置 footer | `extensions/qol/statusline.ts`                                                             |
| **子 agent / tmux 子窗格** | 状态栏右侧子代理相关标记（与 pi-agents-tmux 配合）                                                | `extensions/qol/agent-statusline.ts`（由 `statusline.ts` import）                          |
| **Caveman 状态徽章**       | 状态栏显示 caveman 模式图标（加载 pi-caveman 时）                                                 | `extensions/qol/bridges.ts`、`extensions/qol/statusline.ts`、`extensions/qol/constants.ts` |

---

## 编辑器与输入

| 功能                              | 说明                                                                                                                         | 主要文件                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **π 紧凑编辑器 / Qol 包装编辑器** | `QolCompactPromptEditor`、`QolEditor`；Shift+Enter（及可配置 fallback）插入换行而非提交；`Alt+C` 循环 caveman 模式（若可用） | `extensions/qol/editor.ts`        |
| **斜杠命令补全样式**              | 对 `/` 前缀的补全项做主题高亮；`/qol`、`/search` 等参数补全                                                                  | `extensions/qol/editor.ts`        |
| **图片占位与附件计数**            | `[Image #N]` 等 chip 样式；草稿附件状态                                                                                      | `extensions/qol/images.ts`        |
| **待发送队列预览**                | 对 Pi pending-queue 的主题/对齐类 patch                                                                                      | `extensions/qol/pending-queue.ts` |

---

## 会话命名

| 功能                                    | 说明                                                        | 主要文件                           |
| --------------------------------------- | ----------------------------------------------------------- | ---------------------------------- |
| **自动命名 / `/rename` / `qol:rename`** | 基于首条用户消息或全文调用模型生成会话名；前缀、fallback 等 | `extensions/qol/session-rename.ts` |

相关命令在入口 `extensions/qol.ts` 中注册（如 `rename`、`qol:rename`、`qol:rename:full`）。

---

## 会话搜索与上下文导入

| 功能                   | 说明                                                      | 主要文件                                     |
| ---------------------- | --------------------------------------------------------- | -------------------------------------------- |
| **会话搜索 UI 与命令** | `/search`、`/search:refresh`、快捷键、从旧会话恢复/分叉等 | `extensions/qol/session-search/index.ts`     |
| **索引与缓存**         | 会话列表与 TTL 等                                         | `extensions/qol/session-search/cache.ts`     |
| **搜索逻辑**           | 匹配与限制                                                | `extensions/qol/session-search/search.ts`    |
| **TUI 组件**           | 弹层与交互                                                | `extensions/qol/session-search/component.ts` |
| **导入上下文**         | 与 summarizer 等配合的上下文类型                          | `extensions/qol/session-search/context.ts`   |
| **类型定义**           | 共享类型                                                  | `extensions/qol/session-search/types.ts`     |

---

## 上下文用量 `/context`

| 功能               | 说明                                    | 主要文件                          |
| ------------------ | --------------------------------------- | --------------------------------- |
| **上下文窗口分解** | Claude 风格分类用量展示与自定义消息渲染 | `extensions/qol/context-usage.ts` |

---

## 会话交接 `/handoff`

| 功能         | 说明                                       | 主要文件                    |
| ------------ | ------------------------------------------ | --------------------------- |
| **交接草稿** | 为新会话生成聚焦提示；可选先打开编辑器审阅 | `extensions/qol/handoff.ts` |

---

## 通知

| 功能                 | 说明                                                                           | 主要文件                          |
| -------------------- | ------------------------------------------------------------------------------ | --------------------------------- |
| **发送通知**         | 多通道：bell、OSC、tmux message/window mark、可选 UI 等                        | `extensions/qol/notifications.ts` |
| **触发条件用的解析** | 从 agent 结束等事件取助手文本、判断「需要方向」、critical 关键词、任务完成统计 | `extensions/qol/agent-end.ts`     |
| **跨扩展桥**         | Question 服务、caveman bridge 等                                               | `extensions/qol/bridges.ts`       |

---

## 权限门（危险 bash）

| 功能              | 说明                                                               | 主要文件                            |
| ----------------- | ------------------------------------------------------------------ | ----------------------------------- |
| **bash 命令确认** | 按字面片段或 `/regex/flags` 匹配；交互确认；非交互模式下匹配则阻止 | `extensions/qol/permission-gate.ts` |

预览行数/宽度等配置在 `status-message.ts` 摘要与 `package.json` 设置中均有体现。

---

## Compaction

| 功能                     | 说明                                                                | 主要文件                        |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------- |
| **自定义 compaction**    | 替换或补充 Pi 默认摘要；profile；可选包含上一轮摘要；失败回退；通知 | `extensions/qol/compaction.ts`  |
| **分支 `/tree` 摘要**    | 可选使用同一套 summarizer                                           | 同上（`compaction.ts`）         |
| **远程 HTTP summarizer** | 可配置远程端点                                                      | 同上                            |
| **空闲自动 compaction**  | 空闲时间与 token 阈值等                                             | 同上；默认值等在 `constants.ts` |

---

## Thinking 计时

| 功能                     | 说明                                           | 主要文件                           |
| ------------------------ | ---------------------------------------------- | ---------------------------------- |
| **折叠 Thinking 旁计时** | 对 UI 打补丁，在折叠的思考标签旁显示经过时间等 | `extensions/qol/thinking-timer.ts` |

---

## `/qol` 与状态摘要

| 功能             | 说明                                                                                                                | 主要文件                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **QOL 状态文本** | 汇总当前与输入、重命名、搜索、compaction、通知、权限门、thinking 计时等相关的开关与参数（供 `/qol` 或打印模式使用） | `extensions/qol/status-message.ts` |

---

## 依赖关系简图（逻辑上）

```text
extensions/qol.ts
  ├── constants, settings, util
  ├── thinking-timer, pending-queue (patches)
  ├── editor (+ images, ansi, bridges, constants, settings)
  ├── statusline (+ agent-statusline, ansi, bridges, constants, settings)
  ├── session-rename
  ├── session-search/*
  ├── context-usage
  ├── handoff
  ├── notifications (+ bridges, agent-end, …)
  ├── permission-gate
  └── compaction (+ status-message 读取 compaction 配置)
```

---

## dotpi 仓库中的移植

本仓库在 `src/extensions/compact-statusline/` 实现紧凑状态栏的**子集**（`initCompactStatusline`，由 `src/extensions/index.ts` 加载）。行为说明、子代理桥接与 **Z.ai** 配额展示见 [`README.md`](../src/extensions/compact-statusline/README.md)；开关与 git 超时见同目录 **`settings.ts`**（静态常量，非 vstack 设置面板、亦非 `DOTPI_*` 环境变量）。

与上游 pi-qol 的差异包括但不限于：使用 `Symbol.for("dotpi.compact-statusline.subagent-bridge")` 作为可选子代理桥接键（避免与 vstack 生态其它扩展的 `Symbol.for("vstack.*")` 冲突）、未移植 caveman / tmux 会话标题等模块；`gitBadge` 等对默认分支的判定以 dotpi 实现为准。

**`/context` 上下文用量**：见 `src/extensions/context-usage/`（`initContextUsage`），消息类型字符串为 `dotpi.context-usage`，逻辑自上游 `extensions/qol/context-usage.ts` 移植。

**Compaction**：见 `src/extensions/compaction/`（`initCompaction`），对应上游 `extensions/qol/compaction.ts`：`session_before_compact` / `session_before_tree`、可选空闲定时 `ctx.compact`；摘要始终用**当前会话模型**；配置为同目录 **`settings.ts`** 静态常量（`details.source` 为 `dotpi`）。

---

## 维护说明

- 上游变更以 **vstack `main` 分支** 为准；版本号见 npm 包 `package.json` 的 `version` 字段。
- 若在本仓库实现类似能力，建议对照 **`extensions/qol.ts`** 的事件订阅顺序与各模块的 `pi.on` / `registerCommand` 用法。

---

_文档根据公开仓库 README 与源码树整理，不保证与上游每一提交完全一致。_
