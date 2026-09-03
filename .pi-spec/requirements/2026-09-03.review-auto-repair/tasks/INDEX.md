# 任务索引

## 阶段一：并行实现
- [T-1 统一审查失败归因规则](01-review-failure-attribution.md) — 为三个只读审查门禁建立归因、记录、轮次与独立问题分流规则
- [T-2 自动返修 TDD 与黑盒验收](02-spec-flow-auto-repair.md) — 在需求流程中闭环 review-engineer 与 acceptance-reviewer 的有界返修
- [T-3 自动返修提交前审查](03-pre-review-auto-repair.md) — 在远端写入前闭环 pre-reviewer 的有界返修与产品升级

## 被否定的备选方案
- 让审查角色直接修改文件：破坏只读审查边界，也无法由主 agent 统一执行授权检查与轮次控制。
- 把三个门禁写成一个超大任务：会同时修改多个流程文件、超过单任务三条验收引用，并降低独立验证能力。
