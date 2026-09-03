---
name: spec-revise
description: 已有功能改动 / 修 bug / 结果与预期不符的处理流程——复现问题、对照现行规范归因（实现缺陷 / 规范缺陷 / 需求变更）、决定现场（进行中需求原地回退，已完成或无记录的开新需求目录），然后交给 spec-flow。用户报告 bug、要改已有功能、说结果不对时加载；/spec-revise 为强制入口；只由主 agent 加载。
---

# spec-revise：改动与修复的归因和路由

系统现行行为以 `.pi-spec/spec/` 下的规则文件为准，先读 `spec/INDEX.md` 再打开相关规则；`.pi-spec/requirements/` 下只读当前进行中的目录。本 skill 只做归因与路由，修改、执行与验收交给 spec-flow。

## 第一步：复现与归因

1. 按用户描述执行触发动作（命令 / 请求 / 操作），原样记录实际输出。
2. 读 `spec/INDEX.md`，打开相关规则文件，找到对应约束与验收；找不到即"规范无此行为"。
3. 归因，只能选一：

| 归因 | 判据 |
|---|---|
| 实现缺陷 | 实际行为 ≠ 规范，且用户认同规范是对的 |
| 规范缺陷 | 实际行为 = 规范，或规范无此行为，且用户说规范写错或漏了 |
| 需求变更 | 实际行为 = 规范，用户想要不同的行为 |

4. 用 `ask_user_question` 请用户确认归因，附复现证据与引用的规则原文。
5. 用户确认后调用 `decision_record`（actor ai，source `spec-revise/attribution`，scope 为受影响的 R/AC，decision 为归因结论，basis 为复现证据，alternatives 为另外两种归因，action 为第二步的路由）；用户改选其他归因时以 actor user 记录该选择。记录成功后才进入第二步。

## 第二步：决定现场

进行中目录 = `.pi-spec/requirements/*/requirements.md` 中 `status` 不为 `accepted`，且其 `refs` 或功能域与本问题相关的目录。

| 情况 | 处理 |
|---|---|
| 无进行中目录（历史代码，或相关需求已 accepted） | 开新需求目录，进入 spec-flow 阶段一。背景写清针对哪个规则文件的什么问题；修 bug 时把复现步骤写成该规则文件的一条新验收（触发 / Given 当前状态 / When 触发 / Then 正确行为） |
| 有进行中目录，归因为实现缺陷 | 按 `refs` 找到任务，`status: todo`、`note: <实际与期望的差异>`，需求 `status: executing`，进入 spec-flow 阶段四 |
| 有进行中目录，归因为规范缺陷或需求变更 | 修订对应规则文件的约束与验收并更新该目录 requirements.md 第 3 节，需求 `status: confirmed`，进入 spec-flow 阶段二（planner 增量规划） |

已 accepted 的目录一律只读，不得为修复而回改其中任何文件；规则文件的修订随新需求或原地回退在分支上进行。
