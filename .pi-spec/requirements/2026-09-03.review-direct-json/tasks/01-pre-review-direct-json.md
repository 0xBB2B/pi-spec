---
id: T-1
title: 提交前审查直接 JSON 门禁
depends_on: []
files: [/Users/bb/Projects/pi-spec/skills/git-push/SKILL.md, /Users/bb/Projects/pi-spec/agents/pre-reviewer.md, /Users/bb/Projects/pi-spec/tests/git-push-direct-json.test.ts]
refs: [R-1, R-3, AC-1, AC-2]
parallel: true
verify: bun test tests/git-push-direct-json.test.ts
status: todo
step: test
agent: ""
commit: ""
note: ""
---

## 1. 目标

提交前审查由主 agent 直接调用 `pre-reviewer`，只有完整回复通过严格 JSON、裁决语义和快照一致性校验后才允许远端写入。

## 2. 业务规则

### R-1 提交前审查直接返回 JSON

当系统执行提交前审查时，系统应由主 agent 直接调用 `pre-reviewer`，不得为该审查启动 workflow，并应仅依据严格 JSON 中的完整裁决字段、PASS/FAIL 语义和审查快照一致性决定是否允许远端写入。

### R-3 非严格 JSON 结果失败关闭

如果直接审查角色的完整最终回复不是唯一、非空且非数组的 JSON 对象，含有约定外字段、缺少必需字段、字段语义矛盾，或与外部证据不一致，系统应把该门禁视为 FAIL，停止后续动作并显示具体原因，不得从自然语言中推断通过。

### AC-1 验收与提交前审查直接 JSON 裁决

- 触发: 操作 执行需求黑盒验收或提交前只读审查
- Given: `acceptance-reviewer` 或 `pre-reviewer` 作为流程门禁被主 agent 直接调用
- When: 对应 Agent 完成审查并返回字段集合与 PASS/FAIL 语义均符合约定的严格 JSON
- Then: 界面没有为该审查显示 workflow，系统仅依据有效 `verdict`、完整裁决字段及外部证据一致性决定接受、远端写入或阻断

### AC-2 提交前审查非法结果失败关闭

- 触发: 操作 让 `pre-reviewer` 返回前后带说明文字、围栏、额外字段、字段缺失、字段矛盾、数组或无法解析的结果
- Given: 本地提交已完成，远端尚未写入
- When: Agent 调用结束
- Then: 系统把门禁视为 FAIL，显示解析失败或校验失败的具体原因，没有执行任何远端写入，本地提交保持不变

### 裁决约束

- 完整最终回复只整体执行一次 JSON 解析；拒绝空值、数组、前后文字、围栏和无法解析的内容，不做截取或自然语言推断。
- 顶层字段必须精确为 `phase`、`verdict`、`summary`、`issues`、`evidence`、`reviewedHead`、`contentFingerprint`、`blockingFindings`；阻塞发现字段也必须精确，类型、非空值和枚举均须校验。
- PASS 必须满足 `phase` 为 `pre-review`、`issues` 与 `blockingFindings` 为空、`evidence` 非空，且两个快照字段与调用方记录完全一致；FAIL 必须同时有非空 `issues` 与 `blockingFindings`。
- 解析、字段、语义、快照或调用失败均显示具体原因，保留本地提交，不 push、不创建 PR/MR；有效 PASS 后仍执行既有的放行前快照复核。
- 直接 JSON 结果不写入仓库文件；`pre-reviewer` 保持只读。

## 3. 涉及文件

- 修改 `/Users/bb/Projects/pi-spec/skills/git-push/SKILL.md`：以直接 Agent 调用和主 agent 严格 JSON 校验替换单 Agent workflow 门禁。
- 修改 `/Users/bb/Projects/pi-spec/agents/pre-reviewer.md`：改为完整最终回复仅含严格 JSON，并移除 StructuredOutput/workflow 前提。
- 新建 `/Users/bb/Projects/pi-spec/tests/git-push-direct-json.test.ts`：验证提交前直接调用、严格对象契约、失败关闭和快照绑定规则。

## 4. 函数清单

### `/Users/bb/Projects/pi-spec/tests/git-push-direct-json.test.ts`

- `describe 提交前直接 JSON 门禁`：从公开 skill 与 agent 契约验证直接调用和失败关闭行为。
- `test 合法 PASS 绑定快照`：验证唯一放行条件包含完整字段、语义和调用方快照一致性。
- `test 非严格回复阻断远端写入`：验证附加文本、非法形状及矛盾字段均保留本地提交并停止。

## 5. 协作关系

- `git-push` 主 agent 先采集 `REVIEW_HEAD` 与 `REVIEW_FINGERPRINT`，再通过 Agent 工具直接调用 `pre-reviewer`。
- `pre-reviewer` 将两个调用方快照原样写入唯一 JSON 对象；主 agent 整体解析并校验后，继续使用现有快照复核流程决定是否远端写入。
- 测试只读取公开的 skill 与 agent 契约，不调用远端服务、不执行 git 写操作。

## 6. 验证方式

- 测试入口：`bun test tests/git-push-direct-json.test.ts`。
- 测试输入：提交前审查 skill 和 `pre-reviewer` 对外契约文本。
- 预期结果：契约要求直接 Agent 调用、唯一严格 JSON、精确字段、PASS/FAIL 组合、快照一致性、具体失败原因及零远端写入；不存在该审查的 SubagentWorkflow 启动路径。
- 错误场景：回复带说明文字或围栏、为空或数组、缺少或增加字段、PASS 含问题、FAIL 缺少阻塞项、快照不一致或解析失败时，测试确认门禁必须 FAIL 且本地提交不变。
