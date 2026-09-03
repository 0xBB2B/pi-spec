# @0xbb2b/pi-spec

pi 的需求驱动开发流程包。把「澄清需求 → 规则文件增删改（spec-first）→ 一任务一文件的自包含任务集 → TDD 三角色执行 → 黑盒验收 → PR 前审查」整条链路以 pi package 形式分发。

## 内容

| 目录 | 内容 |
|---|---|
| `skills/` | spec-docs（需求包格式）、spec-flow（需求生命周期）、spec-revise（改动与修复归因）、spec-sync（规范与代码对账）、git-commit、git-push |
| `prompts/` | `/spec-new`、`/spec-resume`、`/spec-revise`、`/spec-sync` |
| `agents/` | planner、test-engineer、impl-engineer、review-engineer、acceptance-reviewer、pre-reviewer 子代理定义 |
| `rules/` | 自动注入 system prompt 的流程规则：任务分流、执行授权、递进式澄清、决策记录 |
| `extensions/rules.ts` | 每轮对话前把 `rules/*.md` 按文件名顺序追加到 system prompt |
| `extensions/agents-bridge.ts` | 会话启动时把 `agents/*.md` 符号链接到 `~/.pi/agent/agents/` |
| `extensions/subagents-preflight.ts` | 会话启动时探测 pi-subagents 是否已加载，缺失时提示安装命令 |
| `extensions/decision-record.ts` | 注册 `decision_record` 工具：经材料性检查把一条 AI 或用户决定追加到需求目录的决策台账并返回回执 |
| `tests/` | `bun test tests` |

## 安装

本包依赖 `@tintinweb/pi-subagents`（0.19.0 及以上）：`Agent`、`SubagentWorkflow`、`StructuredOutput` 三个工具以及 `agents/` 下角色定义的加载都由它提供。两条命令按顺序执行：

```bash
pi install npm:@tintinweb/pi-subagents
pi install git:github.com/0xBB2B/pi-spec      # 本地开发改用 pi install /absolute/path/to/pi-spec
```

`extensions/subagents-preflight.ts` 会在每次会话启动时探测 pi-subagents 是否已加载，缺失时给出上述安装命令的提示。本包不捆绑 pi-subagents：捆绑副本与用户自装的那份会被 pi 当作两个扩展各加载一次，导致同名工具重复注册。

## 子代理为什么要桥接

pi package 只能分发 extensions、skills、prompts、themes 四类资源。pi-subagents 只从 `~/.pi/agent/agents/`、项目 `.pi/agents/` 与 `.agents/agents/` 发现子代理定义，不读 package。因此 `agents-bridge.ts` 在每次会话启动时把本包 `agents/` 下的每个定义以符号链接放进全局 agents 目录：

- 目标位置已是指向本包同一文件的链接：跳过。
- 目标位置已有其他文件或链接：不覆盖，会话内给出告警。
- 指向本包但源文件已不存在的旧链接：删除。

卸载时执行 `pi remove <source>`，再删除 `~/.pi/agent/agents/` 下指向本包的链接。

## 子代理的模型

各 agent 定义的 `model:` 字段指向作者自己的 provider 别名，安装到其他环境时按本机 provider 调整。
