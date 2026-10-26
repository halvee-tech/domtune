# DOMTune 可行性验证结论

日期：2026-10-25  
验证版本：DOMTune PoC 0.2.1

## 核心结论

DOMTune 的核心产品路径已经得到端到端验证：用户可以在真实开发网页中直接选择 DOM 元素、即时调整视觉属性、生成带页面上下文和源码位置的结构化 ChangeSet，并让该 ChangeSet 主动回到原 Codex 会话，触发 Agent 读取变更、定位源码、修改代码和执行验证。

这证明产品不需要让用户在网页与 AI 对话之间手工复制 CSS、截图或提示词。网页操作可以成为 Agent 的结构化输入，且能够继续原会话，而不是新建另一个 Agent。

当前 PoC 已足以支持创建独立仓库并进入工程化阶段。

## 已验证的完整链路

```text
Codex 当前会话
  → open_domtune(workspace, targetUrl)
  → 创建 sessionId 并返回带 session 的目标页面 URL
  → Vite 插件向真实开发页面注入 DOMTune Overlay
  → 用户选择真实 DOM 元素
  → 读取 computed style、selector、viewport 和源码提示
  → 用户即时修改页面样式
  → Overlay 生成并保存 ChangeSet
  → 会话内 MCP App Bridge 检测到待处理 ChangeSet
  → Bridge 调用 ui/message
  → 原 Codex 会话自动开始下一轮
  → Agent 调用 get_domtune_change_set
  → apply-visual-tuning Skill 定位并修改源码
  → Agent 验证结果并调用 report_domtune_change_result
```

实测 ChangeSet 已正确包含：

- 目标页面 URL 与会话 ID。
- 真实 DOM selector，例如 `main > section.hero > article.metric-card`。
- viewport 尺寸。
- 项目 workspace。
- 源码位置，例如 `examples/vite-app/src/style.css:43`。
- 属性的修改前后值，例如 `padding: 32px → 40px`。
- 来源标记 `browser-overlay`。

## 最终架构判断

DOMTune 不应被实现为只存在于 Codex 会话中的编辑器。最终产品由三个相互独立的部分组成。

### Browser Overlay

运行在用户的真实开发网页中，负责：

- 选择和高亮真实 DOM。
- 读取 computed style。
- 即时应用视觉草稿。
- 捕获 selector、viewport、组件和源码信息。
- 生成并提交 ChangeSet。

MVP 使用 Vite 插件注入 Shadow DOM Overlay，避免污染业务页面样式。

### Local Bridge and MCP Server

运行在本地，负责：

- 管理 DOMTune session。
- 持久化 ChangeSet。
- 将网页与 Codex 会话关联。
- 暴露读取、保存和结果回报工具。
- 将数据存储在持久化 `PLUGIN_DATA`，避免插件升级导致数据丢失。

### Conversation Bridge

运行在 Codex 托管的 MCP App 中，负责：

- 绑定当前会话与 sessionId。
- 通过 `tools/call` 读取待处理 ChangeSet。
- 调用 `ui/message` 向原会话发送 follow-up。
- 记录 ChangeSet 已经通知会话，避免重复触发。

普通网页不能直接调用当前 Codex 会话的 `ui/message`，因此这个轻量会话 Bridge 必须保留。

## 已确定的技术决策

1. Codex 本地插件使用 stdio MCP，而不是把本地 HTTP MCP 当作主传输。
2. MCP App 内的数据读写使用标准 `tools/call`，不直接从 iframe 请求 localhost。
3. `ui/message` 只由 Codex 托管的 MCP App 调用。
4. 真实页面编辑器由 Vite 开发插件注入，后续可以扩展为浏览器插件。
5. Overlay 使用 Shadow DOM，降低与业务页面 CSS、事件和层级冲突。
6. ChangeSet 是网页、MCP 和 Agent 之间的稳定协议，不把整段 DOM 或大量提示词直接塞进会话。
7. 页面操作只表达用户的视觉意图；Agent 仍负责将意图转换为可维护的源码修改。
8. Agent 修改前必须验证 workspace、源码映射、响应式规则和共享组件影响范围。

## 当前 ChangeSet 最小结构

```ts
interface ChangeSet {
  id: string;
  sessionId: string;
  origin: "embedded" | "browser-overlay";
  workspace: string;
  pageUrl: string;
  viewport: { width: number; height: number };
  target: {
    selector: string;
    label: string;
    source: { file: string; line: number };
  };
  changes: Array<{
    property: string;
    before: string;
    after: string;
  }>;
  status: "pending" | "applied" | "failed";
  conversationNotifiedAt?: string;
}
```

生产版本应继续对这个协议做版本控制，而不是让 UI、MCP 工具和 Agent 各自定义数据格式。

## MVP 已覆盖范围

- Vite 开发环境注入。
- 真实 DOM 选择与组件根节点提升。
- Shadow DOM 操作面板。
- Padding、border radius、font size 和 background color 调节。
- 页面内即时视觉反馈。
- selector、viewport、workspace 和源码提示捕获。
- ChangeSet 本地持久化。
- 同一 Codex 会话自动回流。
- Codex Skill 驱动的源码应用工作流。
- 插件本地市场安装、版本升级和持久化数据目录。

## 尚未解决的问题

### 自动源码映射

当前 MVP 使用 `data-visual-source="file:line"` 提供可靠的最小源码映射。生产版本需要研究：

- React Fiber 与组件源码定位。
- Vue 组件实例与 SFC 定位。
- Vite source map 和 CSS source map。
- CSS Modules、Tailwind 和 CSS-in-JS。
- 同一 DOM 样式由多个源码位置共同决定的情况。

### 修改语义

当前只记录最终 CSS 属性值。生产版本需要区分：

- 应修改 token、utility class、组件 prop，还是局部 CSS。
- 修改组件定义还是单个实例。
- 当前 viewport 的局部意图是否应影响其他断点。
- hover、focus、disabled、dark mode 等状态。

### 操作能力

需要增加：

- 撤销和重做。
- 多元素与批量修改。
- margin、gap、宽高、布局、字体、边框、阴影等属性。
- 拖拽、对齐、间距标尺和盒模型可视化。
- 页面路由切换后的状态保持。
- 截图和视觉差异证据。

### 安全与稳定性

需要补充：

- session token 和来源校验。
- 本地端口冲突处理。
- 多会话、多窗口和多个开发服务器隔离。
- ChangeSet 幂等性和重复消息保护。
- Overlay 与业务事件系统的冲突测试。
- 大型页面和频繁 DOM 更新下的性能测试。

## 新仓库建议结构

```text
dom-tune/
├── apps/
│   ├── example-vite/
│   └── integration-tests/
├── packages/
│   ├── overlay-core/
│   ├── vite-plugin/
│   ├── change-set-schema/
│   ├── local-bridge/
│   ├── mcp-server/
│   ├── codex-plugin/
│   └── apply-skill/
├── docs/
│   ├── architecture.md
│   ├── change-set-protocol.md
│   └── source-mapping.md
└── package.json
```

建议使用 TypeScript monorepo，共享 ChangeSet 类型、校验规则和测试 fixture。

## 下一阶段优先级

### P0 仓库化

- 将当前 PoC 拆分为独立 package。
- 建立统一 lint、typecheck、test 和 build。
- 为 ChangeSet 增加 schema version 和运行时校验。
- 建立可重复的端到端测试 fixture。

### P1 真实项目接入

- 将 Vite 插件接入一个真实 React 或 Vue 项目。
- 自动识别组件根节点。
- 完成第一版 source map 定位。
- 验证 Agent 修改的确是业务项目源码，而不是 fixture。

### P2 修改质量

- 识别设计 token、Tailwind class 和共享组件。
- 加入响应式和交互状态保护。
- 修改后自动刷新页面并生成视觉对比。
- 将验证证据写回 ChangeSet。

### P3 产品化

- 浏览器扩展或跨构建工具注入方案。
- 多框架 adapter。
- 权限、隐私和诊断日志。
- Claude Code 等其他 Agent 的 Bridge adapter。

## 下一阶段验收标准

新仓库的第一个工程化版本应满足：

1. 在真实 React 或 Vue 项目中通过一条配置启用 Overlay。
2. 能选择至少三类组件并定位到正确源码文件。
3. 网页提交后，原 Codex 会话自动收到 ChangeSet。
4. Agent 能修改源码并让浏览器刷新后呈现相同视觉结果。
5. 修改不会破坏至少一个未编辑 viewport。
6. 成功或失败状态会写回 ChangeSet，并包含验证证据。
7. 重复提交、刷新页面和重启插件不会重复触发同一 ChangeSet。

## 暂不纳入范围

- 生产环境网页上的无授权编辑。
- 将任意第三方网页反向生成完整源码。
- 在没有源码映射证据时自动大范围重构。
- 第一阶段同时支持所有构建工具和前端框架。
- 用视觉编辑器替代设计系统和人工代码审查。

## PoC 资产位置

当前验证代码位于：

```text
/Users/halveel./Documents/Codex/2026-10-25/new-chat/outputs/dom-tune-poc
```

其中关键实现为：

- `src/vite-plugin.ts`：真实网页 Overlay 注入。
- `src/mcp.ts`：MCP 工具和 UI 资源。
- `src/ui.ts`：Codex 会话 Bridge。
- `src/store.ts`：ChangeSet 持久化。
- `skills/apply-visual-tuning/SKILL.md`：Agent 应用流程。
- `examples/vite-app`：真实 DOM 验证 fixture。

创建新仓库时，应迁移实现和本结论文档，但不要迁移缓存、测试 ChangeSet、`node_modules` 或本地插件安装目录。
