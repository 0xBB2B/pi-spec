---
name: failure-attribution
description: 三个审查角色返回 FAIL 后，主 agent 在角色只读的前提下归因为产品决策或可自动解决的问题并记录
---
# 审查未通过的归因

## 目的
让审查未通过时先由主 agent 判断问题性质，而不是一律停下等用户。

## 逻辑
`review-engineer`、`pre-reviewer` 或 `acceptance-reviewer` 返回 FAIL 后，角色保持只读。主 agent 逐条读取问题，判断当前改动直接造成且违反当前任务预期结果的问题属于当前任务；再区分是产品决策还是可自动解决的问题，把归因与修复路径记入 AI 决策台账，然后进入自动返修或询问用户。

## 约束
- C-1：当 `review-engineer`、`pre-reviewer` 或 `acceptance-reviewer` 返回 FAIL 时，系统应在保持该角色只读的前提下，由主 agent 区分产品决策与可自动解决的问题并记录归因结果。
- C-2：如果归因或修复路径的记录未能写入决策台账，系统应停止派发修复并显示原因。

## 例子
`review-engineer` 报告测试漏掉一条验收，主 agent 判定为可自动解决的问题，在 AI 台账记下归因与修复路径，随后派发测试补充。

## 验收
### AC-1 FAIL 阻断放行并进入归因  ← C-1
- 触发: 操作 执行一个存在关键测试遗漏的 TDD 任务
- Given: Red 与 Green 阶段均已完成，但测试未覆盖一条验收
- When: `review-engineer` 返回 FAIL
- Then: 任务没有完成且黑盒验收未启动，AI 决策台账出现该问题为可自动解决的归因记录

### AC-2 记录失败停止派修  ← C-2
- 触发: 操作 在 AI 决策台账被写入非法内容后让 `review-engineer` 返回 FAIL
- Given: 归因需要写入 AI 决策台账
- When: 主 agent 完成归因并尝试记录
- Then: 界面显示台账非法的原因，没有派发任何修复
