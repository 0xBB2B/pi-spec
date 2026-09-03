# 规范索引

## review-gates

- [auto-repair](review-gates/auto-repair.md) — 不需要产品决策且不超出既有授权的审查问题，由主 agent 自动派发测试与实现修复并再次调用原审查角色
- [direct-acceptance](review-gates/direct-acceptance.md) — 黑盒验收由主 agent 直接调用 acceptance-reviewer，验收者唯一写报告，主 agent 只核对严格 JSON 与报告一致性
- [direct-pre-review](review-gates/direct-pre-review.md) — 提交前审查由主 agent 直接调用 pre-reviewer，只依据严格 JSON 与审查快照决定是否远端写入
- [failure-attribution](review-gates/failure-attribution.md) — 三个审查角色返回 FAIL 后，主 agent 在角色只读的前提下归因为产品决策或可自动解决的问题并记录
- [independent-issue-task](review-gates/independent-issue-task.md) — 审查发现的与当前任务根因无关且可独立验证的问题，新增后续任务而不并入当前返修
- [product-decision-escalation](review-gates/product-decision-escalation.md) — 只有会改变外部行为、数据、安全、权限或验收标准的审查问题才询问用户，未回答的问题不留痕
- [repair-round-limit](review-gates/repair-round-limit.md) — 同一审查门禁的自动返修最多三轮，第三轮仍未通过即记录技术阻塞并停止
- [strict-json-verdict](review-gates/strict-json-verdict.md) — 直接审查角色的完整最终回复必须是唯一严格 JSON 对象，任何偏差都失败关闭
