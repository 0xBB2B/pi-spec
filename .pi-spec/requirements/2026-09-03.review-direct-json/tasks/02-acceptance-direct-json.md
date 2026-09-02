---
id: T-2
title: 黑盒验收直接 JSON 门禁
depends_on: []
files: [/Users/bb/Projects/pi-spec/skills/spec-flow/SKILL.md, /Users/bb/Projects/pi-spec/agents/acceptance-reviewer.md, /Users/bb/Projects/pi-spec/tests/acceptance-direct-json.test.ts]
refs: [R-2, R-3, R-4, R-5, AC-1, AC-3, AC-4]
parallel: true
verify: bun test tests/acceptance-direct-json.test.ts
status: todo
step: test
agent: ""
commit: ""
note: ""
---

## 1. 目标

黑盒验收由主 agent 直接调用 `acceptance-reviewer`，只有严格 JSON 与指定验收报告一致时才接受需求，门禁失败时不改写验收者报告。

## 2. 业务规则

### R-2 黑盒验收直接返回 JSON

当系统执行黑盒验收时，系统应由主 agent 直接调用 `acceptance-reviewer`，不得为该验收启动 workflow，并应仅依据严格 JSON 中的完整裁决字段、PASS/FAIL 语义、逐条验收结果与验收报告的一致性决定是否接受需求。

### R-3 非严格 JSON 结果失败关闭

如果直接审查角色的完整最终回复不是唯一、非空且非数组的 JSON 对象，含有约定外字段、缺少必需字段、字段语义矛盾，或与外部证据不一致，系统应把该门禁视为 FAIL，停止后续动作并显示具体原因，不得从自然语言中推断通过。

### R-4 验收报告写入边界

当系统执行黑盒验收时，系统应仅允许 `acceptance-reviewer` 写入调用方指定的验收报告，主 agent 不得转录、覆盖或回滚该报告。

### R-5 验收门禁失败保留报告

如果 `acceptance-reviewer` 已写入验收报告但直接 JSON 门禁失败，系统应保留本次报告作为诊断证据，并不得把需求置为 accepted。

### AC-1 验收与提交前审查直接 JSON 裁决

- 触发: 操作 执行需求黑盒验收或提交前只读审查
- Given: `acceptance-reviewer` 或 `pre-reviewer` 作为流程门禁被主 agent 直接调用
- When: 对应 Agent 完成审查并返回字段集合与 PASS/FAIL 语义均符合约定的严格 JSON
- Then: 界面没有为该审查显示 workflow，系统仅依据有效 `verdict`、完整裁决字段及外部证据一致性决定接受、远端写入或阻断

### AC-3 验收结果与报告不一致时拒绝

- 触发: 操作 让 `acceptance-reviewer` 返回 `verdict` 为 PASS 但报告路径与调用方指定路径不同，或报告结论为 rejected 的结果
- Given: 需求处于 accepting 状态，验收者已写入本次验收报告
- When: 主 agent 核对返回对象与指定验收报告
- Then: 本次报告保留，需求没有被置为 accepted，界面显示对象与报告不一致的具体字段

### AC-4 验收报告由验收者唯一写入

- 触发: 操作 执行黑盒验收并让验收者写入指定报告后返回非严格 JSON
- Given: 调用方已指定唯一验收报告路径并保存其调用前内容
- When: `acceptance-reviewer` 写入本次报告后返回前后带说明文字的最终回复
- Then: 指定路径保留验收者写入的本次报告，主 agent 没有转录、覆盖或恢复调用前内容，需求没有被置为 accepted

### 裁决约束

- 完整最终回复只整体执行一次 JSON 解析；拒绝空值、数组、前后文字、围栏和无法解析的内容，不做截取或自然语言推断。
- 顶层字段必须精确为 `phase`、`verdict`、`summary`、`issues`、`evidence`、`acceptanceResult`、`reportPath`、`items`、`uncovered`；每个 `items` 条目字段精确为 `id`、`result`、`observed`、`difference`，类型、非空值和枚举均须校验。
- PASS 必须满足 `phase` 为 `acceptance`、`acceptanceResult` 为 `accepted`、逐条结果非空且全部 PASS、`issues` 与 `uncovered` 为空、报告路径精确匹配且指定报告结论为 accepted。
- FAIL 必须满足 `acceptanceResult` 为 `rejected`，且非空问题、未覆盖项或失败条目至少存在一项。
- 解析、字段、语义、报告读取或一致性失败均显示具体原因，不把需求置为 accepted；无论 JSON 是否有效，主 agent 均不得转录、覆盖或回滚验收者已写入的指定报告。
- 直接 JSON 结果不写入需求目录；`acceptance-reviewer` 仅允许写入调用方指定的验收报告，不写其他文件。

## 3. 涉及文件

- 修改 `/Users/bb/Projects/pi-spec/skills/spec-flow/SKILL.md`：以直接 Agent 调用、主 agent 整体 JSON 解析及报告一致性校验替换 acceptance workflow。
- 修改 `/Users/bb/Projects/pi-spec/agents/acceptance-reviewer.md`：改为写完指定报告后以完整最终回复返回唯一严格 JSON，并移除 StructuredOutput/workflow 前提。
- 新建 `/Users/bb/Projects/pi-spec/tests/acceptance-direct-json.test.ts`：验证直接验收门禁、严格对象语义、报告一致性和唯一写入边界。

## 4. 函数清单

### `/Users/bb/Projects/pi-spec/tests/acceptance-direct-json.test.ts`

- `describe 黑盒验收直接 JSON 门禁`：从公开 skill 与 agent 契约验证直接调用、报告核对和失败关闭行为。
- `test 合法 PASS 匹配指定报告`：验证完整逐条 PASS 对象与 accepted 报告一致时才接受需求。
- `test 非严格或不一致结果保留报告`：验证非法回复、路径差异或 rejected 报告阻断 accepted 且不恢复旧报告。

## 5. 协作关系

- `spec-flow` 主 agent 将验收文件路径、唯一报告路径和启动方式交给 Agent 工具直接调用的 `acceptance-reviewer`。
- `acceptance-reviewer` 逐条验收并先写指定报告，再返回唯一 JSON 对象；主 agent 读取该指定报告并核对路径、结论和对象语义。
- 主 agent 只读取报告用于门禁，不成为报告的第二写入者；测试只读取公开契约，不执行真实验收环境。

## 6. 验证方式

- 测试入口：`bun test tests/acceptance-direct-json.test.ts`。
- 测试输入：需求生命周期 skill 和 `acceptance-reviewer` 对外契约文本。
- 预期结果：契约要求直接 Agent 调用、唯一严格 JSON、精确顶层及逐条字段、PASS/FAIL 组合、指定报告一致性和验收者唯一写入；不存在该验收的 SubagentWorkflow 启动路径。
- 错误场景：回复带说明文字、为空或数组、字段增缺、语义矛盾、报告路径不同、报告不可读或结论 rejected 时，测试确认需求不进入 accepted，显示具体差异并保留验收者写入的报告。
