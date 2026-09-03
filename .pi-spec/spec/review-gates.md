# 审查门禁

## 1. 行为规则

### 直接审查

- BR-1：当系统执行提交前审查时，系统应由主 agent 直接调用 `pre-reviewer`，不得为该审查启动 workflow，并仅依据严格 JSON 的完整裁决字段、PASS/FAIL 语义与审查快照一致性决定是否允许远端写入。
- BR-2：当系统执行黑盒验收时，系统应由主 agent 直接调用 `acceptance-reviewer`，不得为该验收启动 workflow，并仅依据严格 JSON 的完整裁决字段、PASS/FAIL 语义、逐条验收结果与指定验收报告的一致性决定是否接受需求。
- BR-3：当系统执行黑盒验收时，系统应仅允许 `acceptance-reviewer` 写入调用方指定的验收报告，主 agent 不得转录、覆盖或回滚该报告。

### 失败关闭

- BR-4：如果直接审查角色的完整最终回复不是唯一、非空且非数组的 JSON 对象，含有约定外字段、缺少必需字段、字段语义矛盾或与外部证据不一致，系统应把门禁视为 FAIL，停止后续动作并显示具体原因，不得从自然语言中推断通过。
- BR-5：如果 `acceptance-reviewer` 已写入验收报告但直接 JSON 门禁失败，系统应保留本次报告作为诊断证据，并不得把需求置为 accepted。

## 2. 对外接口

### 提交前审查

- 输入：仓库位置、基线、需求与验收标准、审查重点、审查分支头和内容指纹。
- 调用：主 agent 通过 Agent 直接调用一次 `pre-reviewer`；审查调用及结果不得要求、启动、承载或传递于任何 workflow。
- 输出：完整最终回复仅含一个 JSON 对象，顶层字段精确为 `phase`、`verdict`、`summary`、`issues`、`evidence`、`reviewedHead`、`contentFingerprint`、`blockingFindings`。
- 放行：PASS 必须具有非空证据、空问题与空阻塞发现，并精确回指调用方快照；调用方在远端写入前重新采集的快照也必须一致。

### 黑盒验收

- 输入：验收文件路径、唯一验收报告路径和运行环境启动方式。
- 调用：主 agent 通过 Agent 直接调用一次 `acceptance-reviewer`；验收调用及结果不得要求、启动、承载或传递于任何 workflow。
- 输出：完整最终回复仅含一个 JSON 对象，顶层字段精确为 `phase`、`verdict`、`summary`、`issues`、`evidence`、`acceptanceResult`、`reportPath`、`items`、`uncovered`；每个逐条结果精确包含 `id`、`result`、`observed`、`difference`。
- 放行：PASS 必须具有非空且全部通过的逐条结果、空问题与空未覆盖项，报告路径精确匹配，且指定报告结论为 accepted。
- 写入：`acceptance-reviewer` 只能写入指定验收报告；主 agent 只读取该报告进行一致性核对。

### 严格 JSON

- 调用方对完整最终回复整体执行一次 JSON 解析；回复前后文字、围栏、空值、数组、解析失败、字段增缺、类型或枚举错误、PASS/FAIL 组合矛盾均失败关闭。
- 提交前审查失败时保留本地提交且不执行远端写入；黑盒验收失败时保留验收者写入的报告且不接受需求。

## 3. 验收例子

### AC-1 直接 JSON 裁决  ← BR-1, BR-2
- 触发: 操作 执行需求黑盒验收或提交前只读审查
- Given: `acceptance-reviewer` 或 `pre-reviewer` 作为门禁被主 agent 直接调用
- When: 对应 Agent 返回字段集合与 PASS/FAIL 语义均符合约定的严格 JSON
- Then: 界面没有为该审查显示 workflow，系统仅依据完整裁决字段及外部证据一致性决定接受、远端写入或阻断

### AC-2 提交前审查非法结果失败关闭  ← BR-4
- 触发: 操作 让 `pre-reviewer` 返回带说明文字、围栏、额外字段、字段缺失、字段矛盾、数组或无法解析的结果
- Given: 本地提交已完成，远端尚未写入
- When: Agent 调用结束
- Then: 系统把门禁视为 FAIL，显示解析或校验失败的具体原因，不执行远端写入，本地提交保持不变

### AC-3 验收结果与报告不一致时拒绝  ← BR-4, BR-5
- 触发: 操作 让 `acceptance-reviewer` 返回 PASS，但报告路径不同或报告结论为 rejected
- Given: 需求处于 accepting 状态，验收者已写入本次验收报告
- When: 主 agent 核对返回对象与指定验收报告
- Then: 本次报告保留，需求不被置为 accepted，界面显示对象与报告不一致的具体字段

### AC-4 验收报告由验收者唯一写入  ← BR-3, BR-5
- 触发: 操作 执行黑盒验收并让验收者写入指定报告后返回非严格 JSON
- Given: 调用方已指定唯一验收报告路径并保存其调用前内容
- When: `acceptance-reviewer` 写入本次报告后返回带说明文字的最终回复
- Then: 指定路径保留验收者写入的本次报告，主 agent 不转录、覆盖或恢复调用前内容，需求不被置为 accepted
