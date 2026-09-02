---
name: tdd-review-gate
---

# TDD 审查门禁

## 1. 行为规则

当任务采用 TDD 时，系统应依次完成 `test-engineer`、`impl-engineer`、`review-engineer`，且后一个阶段不得在前一个阶段完成前启动。

当 `review-engineer` 返回 GO 时，系统应继续执行任务验证，并仅在验证通过后将任务标记为完成。

如果 `review-engineer` 未返回 GO、返回 NO-GO 或无法形成可信结论，系统应将任务标记为失败、记录原因并停止派发后续任务或黑盒验收。

系统应仅以 `review-engineer` 名称提供 TDD Review 角色，不再以 `req-reviewer` 或 `requirements-reviewer` 名称提供该角色。

当本规则生效时，如果已有 TDD 任务已完成实现但尚未最终接受，系统应先补做 `review-engineer` 审查，再决定是否进入黑盒验收。

## 2. 对外接口

- TDD 阶段顺序：`test-engineer → impl-engineer → review-engineer → verify → done`。
- Review 输出：首行必须是 `## 结论 GO` 或 `## 结论 NO-GO`；首行不合规时视为没有明确 GO，不能从正文后续的 GO 推断通过。
- Review 失败：任务进入失败状态并显示原因，不自动重试或返修。
- 角色名称：仅 `review-engineer` 可用于 TDD Review；旧名称不可用。
- 断点恢复：尚未最终接受且缺少 Review 的 Green 任务先补审，取得 GO 后重新验证。

## 3. 验收例子

### 严格执行三阶段
- 触发: 操作 执行一个需要修改可观察行为的 TDD 任务
- Given: 任务已确认并处于可执行状态
- When: 用户启动该任务的实施流程
- Then: 界面依次显示 `test-engineer` 完成、`impl-engineer` 完成、`review-engineer` 完成，且不存在阶段重叠或跳过

### GO 后完成任务
- 触发: 操作 执行一个审查结论为 GO 的 TDD 任务
- Given: Red 与 Green 阶段均已完成，审查所需证据齐全
- When: `review-engineer` 返回 GO
- Then: 系统运行任务验证，并仅在验证通过后把任务标记为完成

### NO-GO 阻断后续流程
- 触发: 操作 执行一个存在关键测试遗漏的 TDD 任务
- Given: Red 与 Green 阶段均已完成，但测试未覆盖一条验收标准
- When: `review-engineer` 返回 NO-GO
- Then: 任务被标记为失败并显示具体原因，后续任务和黑盒验收均未启动

### 仅保留新角色名称
- 触发: 操作 刷新角色目录并查看可用 TDD 角色
- Given: 审查门禁已安装且角色目录已刷新
- When: 用户查看或调用 TDD Review 角色
- Then: `review-engineer` 可用，`req-reviewer` 与 `requirements-reviewer` 均不可用

### 既有任务补做审查
- 触发: 操作 恢复一个已完成 Green、尚未最终接受的 TDD 任务
- Given: 任务已有通过的实现与测试证据，但没有审查工程师结论
- When: 用户恢复该任务
- Then: 系统先启动 `review-engineer`，未取得 GO 前不进入黑盒验收
