---
id: T-1
title: 统一审查失败归因规则
depends_on: []
files: [/Users/bb/Projects/pi-spec/rules/05-review-failure-handling.md, /Users/bb/Projects/pi-spec/tests/review-failure-handling.test.ts]
refs: [review-gates/failure-attribution/AC-1, review-gates/failure-attribution/AC-2, review-gates/independent-issue-task/AC-1]
parallel: true
verify: bun test tests/review-failure-handling.test.ts
status: todo
step: test
agent:
commit:
note:
---

## 目标
让主 agent 对三个只读审查门禁的 FAIL 统一归因、先记录再行动、按门禁限制返修轮次，并把独立问题分流为后续任务。

## 业务规则

### review-gates/failure-attribution/AC-1
约束 C-1：当 `review-engineer`、`pre-reviewer` 或 `acceptance-reviewer` 返回 FAIL 时，系统应在保持该角色只读的前提下，由主 agent 区分产品决策与可自动解决的问题并记录归因结果。

验收：
- 触发: 操作 执行一个存在关键测试遗漏的 TDD 任务
- Given: Red 与 Green 阶段均已完成，但测试未覆盖一条验收
- When: `review-engineer` 返回 FAIL
- Then: 任务没有完成且黑盒验收未启动，AI 决策台账出现该问题为可自动解决的归因记录

### review-gates/failure-attribution/AC-2
约束 C-2：如果归因或修复路径的记录未能写入决策台账，系统应停止派发修复并显示原因。

验收：
- 触发: 操作 在 AI 决策台账被写入非法内容后让 `review-engineer` 返回 FAIL
- Given: 归因需要写入 AI 决策台账
- When: 主 agent 完成归因并尝试记录
- Then: 界面显示台账非法的原因，没有派发任何修复

### review-gates/independent-issue-task/AC-1
约束 C-1：当审查发现的问题与当前任务的根因和预期结果可独立验证时，系统应为该问题新增独立后续任务，不得把它并入当前任务的自动返修。

验收：
- 触发: 操作 审查一个只负责公共输入校验的任务时发现一个独立的启动器问题
- Given: 启动器问题不影响当前输入校验任务的预期结果，且可以单独验证
- When: 主 agent 完成问题归因
- Then: 系统为启动器问题新增具有独立验证结论的后续任务，当前任务的自动返修范围仍只包含公共输入校验

## 涉及文件
- 新建 `/Users/bb/Projects/pi-spec/rules/05-review-failure-handling.md`：注入三个审查门禁共用的主 agent 归因与有界分流规则。
- 新建 `/Users/bb/Projects/pi-spec/tests/review-failure-handling.test.ts`：验证共用提示规则的必备句子和禁止句子。

## 函数清单
- `/Users/bb/Projects/pi-spec/tests/review-failure-handling.test.ts`
  - `readFailureHandlingRule`：读取统一审查失败处理规则。
  - `requiredStatements`：提供必须逐条存在的契约句子。
  - `forbiddenStatements`：提供必须不存在的冲突句子。

## 协作关系
规则文件由现有规则扩展按文件名顺序注入主 agent；它调用现有 `decision_record` 写入需求级台账，并把角色专用返修交给已加载的流程 skill。

## 验证方式
公开入口：启动加载本包规则的主 agent，并让任一指定审查角色返回 FAIL；测试以规则注入文件作为同一公开提示契约的静态入口。

必须出现的句子：
- `review-engineer、pre-reviewer 或 acceptance-reviewer 返回 FAIL 后，审查角色保持只读，由主 agent 逐条归因。`
- `当前改动直接造成且违反当前任务预期结果的问题属于当前任务；与当前任务根因和预期结果可独立验证的问题必须新增具有独立验证结论的后续任务，不得并入当前返修。`
- `主 agent 必须区分产品决策与可自动解决的问题，并在行动前通过 decision_record 记录归因与修复路径；记录失败时显示原因且不得派发修复。`
- `每个审查门禁独立计算自动返修轮次，一次归因、修复派发并再次调用原审查角色计为一轮，最多三轮。`
- `同一门禁第三轮重审仍未通过时，记录技术阻塞并停止，不再返修，不向用户询问纯技术问题，也不为该机械状态增加决策台账记录。`
- `修复派发失败、重审结果非法或证据不足均计入当前门禁的一轮并按未通过处理。`

必须不再出现的句子：
- `审查角色可以直接修改文件。`
- `审查失败后把所有发现并入当前任务。`
- `第三轮失败后继续自动返修。`
- `决策台账记录失败后仍可派发修复。`

错误场景：AI 台账非法时，规则契约必须同时要求显示写入原因和零修复派发；独立问题不得扩大当前任务返修范围。
