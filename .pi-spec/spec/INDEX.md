# 规范索引

## review-gates

- [direct-acceptance](review-gates/direct-acceptance.md) — 黑盒验收由主 agent 直接调用 acceptance-reviewer，验收者唯一写报告，主 agent 只核对严格 JSON 与报告一致性
- [direct-pre-review](review-gates/direct-pre-review.md) — 提交前审查由主 agent 直接调用 pre-reviewer，只依据严格 JSON 与审查快照决定是否远端写入
- [strict-json-verdict](review-gates/strict-json-verdict.md) — 直接审查角色的完整最终回复必须是唯一严格 JSON 对象，任何偏差都失败关闭
