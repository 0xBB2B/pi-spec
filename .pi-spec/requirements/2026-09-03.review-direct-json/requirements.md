---
name: review-direct-json
title: 审查者直接返回严格 JSON
status: planned
created: 2026-09-03
---

# 审查者直接返回严格 JSON

## 1. 背景

现行规范中，提交前审查（`pre-reviewer`）与黑盒验收（`acceptance-reviewer`）都通过单 Agent workflow 调用，并依赖 workflow 层的 Schema 校验裁决。这两个角色只调用一次、没有阶段串联，workflow 只增加一层展示与编排开销，也让主 agent 无法直接核对返回值与审查快照或验收报告的一致性。问题解决后，用户执行提交前审查或验收时看不到多余的 workflow，主 agent 拿到的是一个可完整校验的 JSON 对象，任何不合法结果都被当场拒绝。

## 2. 目标与非目标

### 非目标

- 不改变三个 TDD 角色继续通过带 Schema 的 workflow 编排返回结构化对象。
- 不让 `pre-reviewer` 修改任何文件，也不让 `acceptance-reviewer` 修改指定验收报告以外的文件。
- 不把两个角色的 JSON 结果持久化到需求目录。
- 不重新设计两个角色已有的裁决字段、枚举或 PASS/FAIL 语义。

### 目标

- 提交前审查与黑盒验收为审查启动 workflow 的次数为 0。
- 依据首行、结论段或 PASS/FAIL 子串做出流程裁决的次数为 0。
- 返回值不是唯一 JSON 对象、字段集合不精确、字段语义矛盾或与外部证据不一致时，放行远端写入或接受需求的次数为 0。

## 3. 术语

| 术语 | 定义 |
|---|---|
| 严格 JSON | 直接审查角色的完整最终回复可作为一个整体解析为唯一、非空且非数组的 JSON 对象；对象前后没有说明文字、围栏或其他内容，字段集合与约定完全一致。 |
| 审查快照 | 提交前审查启动时记录的分支头与工作区状态标识，用于核对审查结果对应的正是待推送的内容。 |
| 外部证据 | 提交前审查使用调用方采集的审查快照；黑盒验收使用调用方指定路径下的验收报告。 |

## 4. 需求

### R-1 提交前审查直接返回 JSON

当系统执行提交前审查时，系统应由主 agent 直接调用 `pre-reviewer`，不得为该审查启动 workflow，并应仅依据严格 JSON 中的完整裁决字段、PASS/FAIL 语义和审查快照一致性决定是否允许远端写入。

### R-2 黑盒验收直接返回 JSON

当系统执行黑盒验收时，系统应由主 agent 直接调用 `acceptance-reviewer`，不得为该验收启动 workflow，并应仅依据严格 JSON 中的完整裁决字段、PASS/FAIL 语义、逐条验收结果与验收报告的一致性决定是否接受需求。

### R-3 非严格 JSON 结果失败关闭

如果直接审查角色的完整最终回复不是唯一、非空且非数组的 JSON 对象，含有约定外字段、缺少必需字段、字段语义矛盾，或与外部证据不一致，系统应把该门禁视为 FAIL，停止后续动作并显示具体原因，不得从自然语言中推断通过。

### R-4 验收报告写入边界

当系统执行黑盒验收时，系统应仅允许 `acceptance-reviewer` 写入调用方指定的验收报告，主 agent 不得转录、覆盖或回滚该报告。

### R-5 验收门禁失败保留报告

如果 `acceptance-reviewer` 已写入验收报告但直接 JSON 门禁失败，系统应保留本次报告作为诊断证据，并不得把需求置为 accepted。

## 5. 行为方案

用户触发提交前审查后，主 agent 先记录审查快照，再直接调用 `pre-reviewer` 并等待完整最终回复。提交前审查对象必须精确包含 `phase`、`verdict`、`summary`、`issues`、`evidence`、`reviewedHead`、`contentFingerprint` 与 `blockingFindings`。PASS 时 `phase` 为 `pre-review`，`issues` 与 `blockingFindings` 为空，`evidence` 非空，两个快照字段与调用方记录完全一致；FAIL 时 `issues` 与 `blockingFindings` 均非空。主 agent 在远端写入前仍按既有流程重新采集并核对快照。

用户触发黑盒验收后，主 agent 把验收文件路径、唯一允许写入的验收报告路径与启动方式交给 `acceptance-reviewer`。验收者逐条执行验收、写入指定报告，再直接返回完整最终回复。验收对象必须精确包含 `phase`、`verdict`、`summary`、`issues`、`evidence`、`acceptanceResult`、`reportPath`、`items` 与 `uncovered`；每个 `items` 条目必须精确包含 `id`、`result`、`observed` 与 `difference`。PASS 时 `phase` 为 `acceptance`、`acceptanceResult` 为 `accepted`、逐条结果非空且全部为 PASS、`issues` 与 `uncovered` 为空、报告路径精确匹配，并且指定报告结论为 accepted。FAIL 时 `acceptanceResult` 为 `rejected`，且问题、未覆盖项或失败条目至少存在一项。

主 agent 对两个角色的完整最终回复各执行一次整体 JSON 解析，拒绝空值、数组、前后附加文本与任何约定外字段，再核对字段类型、枚举及上述 PASS/FAIL 组合。只有对象语义与外部证据全部一致且 `verdict` 为 PASS 时才继续推送或接受需求。解析、字段、语义或一致性核对任一失败时，界面显示具体失败原因并停止；提交前审查保留本地提交且不执行远端写入，黑盒验收保留本次报告但不接受需求。

## 6. 边界与已知坑

- 数据量与并发：两个角色每次审查只调用一次，不并发调用同一角色。
- 失败与重试：返回值非法或不一致时直接失败关闭，不自动重试；用户可修正后重新触发。
- 上下游约束：两个角色的直接回复没有工具层 Schema 保证，主 agent 必须自行完成整体解析、精确字段与语义校验；三个 TDD 角色不采用这条直接解析路径。
- 快照约束：审查快照在调用前及放行前必须按既有流程重新采集，采集失败或发生变化即停止。
- 报告约束：验收报告可能先于直接 JSON 门禁结果写入；门禁失败时保留报告，主 agent 不成为第二个报告写入者。
- 已知坑：只删除 workflow 调用而不补上主 agent 侧的整体解析、字段、语义与一致性核对，会让流程从“过度编排”退化为“无门禁”；两者必须同时改。

## 7. 验收标准

### AC-1 验收与提交前审查直接 JSON 裁决  ← R-1, R-2
- 触发: 操作 执行需求黑盒验收或提交前只读审查
- Given: `acceptance-reviewer` 或 `pre-reviewer` 作为流程门禁被主 agent 直接调用
- When: 对应 Agent 完成审查并返回字段集合与 PASS/FAIL 语义均符合约定的严格 JSON
- Then: 界面没有为该审查显示 workflow，系统仅依据有效 `verdict`、完整裁决字段及外部证据一致性决定接受、远端写入或阻断

### AC-2 提交前审查非法结果失败关闭  ← R-3
- 触发: 操作 让 `pre-reviewer` 返回前后带说明文字、围栏、额外字段、字段缺失、字段矛盾、数组或无法解析的结果
- Given: 本地提交已完成，远端尚未写入
- When: Agent 调用结束
- Then: 系统把门禁视为 FAIL，显示解析失败或校验失败的具体原因，没有执行任何远端写入，本地提交保持不变

### AC-3 验收结果与报告不一致时拒绝  ← R-3, R-5
- 触发: 操作 让 `acceptance-reviewer` 返回 `verdict` 为 PASS 但报告路径与调用方指定路径不同，或报告结论为 rejected 的结果
- Given: 需求处于 accepting 状态，验收者已写入本次验收报告
- When: 主 agent 核对返回对象与指定验收报告
- Then: 本次报告保留，需求没有被置为 accepted，界面显示对象与报告不一致的具体字段

### AC-4 验收报告由验收者唯一写入  ← R-4, R-5
- 触发: 操作 执行黑盒验收并让验收者写入指定报告后返回非严格 JSON
- Given: 调用方已指定唯一验收报告路径并保存其调用前内容
- When: `acceptance-reviewer` 写入本次报告后返回前后带说明文字的最终回复
- Then: 指定路径保留验收者写入的本次报告，主 agent 没有转录、覆盖或恢复调用前内容，需求没有被置为 accepted
