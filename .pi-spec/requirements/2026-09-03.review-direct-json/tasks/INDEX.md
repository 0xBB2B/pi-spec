# 任务索引

## 阶段一（可并行）
- [T-1 提交前审查直接 JSON 门禁](01-pre-review-direct-json.md) — 直接调用 pre-reviewer，严格校验裁决对象与审查快照。
- [T-2 黑盒验收直接 JSON 门禁](02-acceptance-direct-json.md) — 直接调用 acceptance-reviewer，严格校验裁决对象并保留其报告。

## 被否定的备选方案
- 共用一个通用审查 JSON 解析器：两个角色的字段、外部证据和写入边界不同，共用抽象会扩大改动并削弱各自契约的可审查性。
- 仅移除 workflow、信任 Agent 自报 PASS：没有整体解析、精确字段与外部证据核对，会使门禁失效并违反失败关闭要求。
