---
id: T-2
title: 自动返修 TDD 与黑盒验收
depends_on: []
files: [/Users/bb/Projects/pi-spec/skills/spec-flow/SKILL.md, /Users/bb/Projects/pi-spec/tests/spec-flow-auto-repair.test.ts]
refs: [review-gates/auto-repair/AC-1, review-gates/auto-repair/AC-3, review-gates/auto-repair/AC-4]
parallel: true
verify: bun test tests/spec-flow-auto-repair.test.ts
status: done
step: review
agent: wf_ab8f93235e7c
commit: e8ed2fb
note:
---

## 目标
让 spec-flow 在既有授权内自动修复 review-engineer 与 acceptance-reviewer 的非产品问题并重审，超出授权时停止自动返修并升级用户。

## 业务规则

### review-gates/auto-repair/AC-1
约束 C-1：当审查问题不需要产品决策且修复不超出用户已授权的目标、文件范围和验收标准时，系统应自动派发所需的测试与实现修复，并再次调用原审查角色。

验收：
- 触发: 操作 让 `review-engineer` 报告一个不涉及产品决策的实现或测试问题
- Given: 用户已批准的目标、文件范围和验收标准足以完成修复
- When: 主 agent 完成问题归因
- Then: AI 决策台账先出现归因与修复路径记录，随后系统自动派发修复并由 `review-engineer` 重审，期间没有询问用户

### review-gates/auto-repair/AC-3
约束 C-1：当审查问题不需要产品决策且修复不超出用户已授权的目标、文件范围和验收标准时，系统应自动派发所需的测试与实现修复，并再次调用原审查角色。

验收：
- 触发: 操作 让 `acceptance-reviewer` 报告一个由实现偏差造成的验收失败
- Given: 规范与验收明确且不需要用户选择
- When: 主 agent 核对验收结果和报告并完成归因
- Then: AI 决策台账先记录决定，系统自动派发修复、完成 TDD 审查并再次调用 `acceptance-reviewer`，期间没有询问用户

### review-gates/auto-repair/AC-4
约束 C-2：如果修复需要扩大目标、文件范围或验收标准，系统应把该问题视为产品决策，不得自动返修。

验收：
- 触发: 操作 让 `review-engineer` 报告一个必须修改任务文件范围之外文件才能解决的问题
- Given: 该文件不在任务声明的范围内
- When: 主 agent 完成问题归因
- Then: 系统没有派发修复，而是把该问题作为产品决策向用户提出

## 涉及文件
- 修改 `/Users/bb/Projects/pi-spec/skills/spec-flow/SKILL.md`：替换 review 与 acceptance 失败即停止的旧路径，声明归因、授权检查、返修、重审与三轮停止顺序。
- 新建 `/Users/bb/Projects/pi-spec/tests/spec-flow-auto-repair.test.ts`：验证两个门禁的提示契约及旧冲突路径已删除。

## 函数清单
- `/Users/bb/Projects/pi-spec/tests/spec-flow-auto-repair.test.ts`
  - `readSpecFlow`：读取需求生命周期提示契约。
  - `executingContract`：提取 TDD 执行与 review-engineer 返修段落。
  - `acceptingContract`：提取 acceptance-reviewer 验收与返修段落。

## 协作关系
spec-flow 复用统一失败归因规则与 `decision_record`；review-engineer 返修由同一任务的 test-engineer、impl-engineer、review-engineer 串行门禁完成，acceptance-reviewer 返修先完成 TDD 审查，再保持 Agent 直接调用与报告唯一写入者契约。

## 验证方式
公开入口：分别执行会令 review-engineer 返回结构化 FAIL、令 acceptance-reviewer 返回严格 JSON FAIL 的需求流程。

必须出现的句子：
- `review-engineer 返回 FAIL 后，主 agent 逐条归因；可自动解决的问题在 AI 决策台账记录成功后，自动派发同一任务所需的测试或实现修复，再由 review-engineer 重审，期间不询问用户。`
- `review-engineer 的修复不得跳过 test-engineer、impl-engineer 与 review-engineer 的结构化 TDD 门禁。`
- `修复需要扩大已授权目标、任务 files 或验收标准时，必须作为产品决策询问用户，不得自动返修。`
- `acceptance-reviewer 返回 FAIL 后，主 agent 核对严格 JSON 与指定报告并逐条归因；实现偏差可自动解决时，先记录 AI 决定，再派发修复并完成结构化 TDD 审查，最后直接调用 acceptance-reviewer 重审。`
- `acceptance-reviewer 返修期间仍由验收者独占写入指定报告，主 agent 只读取报告。`
- `review-engineer 与 acceptance-reviewer 分别独立计数，每个门禁最多三轮返修；修复派发失败、非法重审结果或证据不足计入一轮，第三轮仍未通过时记录技术阻塞并停止。`

必须不再出现的句子：
- `任一任务 failed → 停止派新任务，向用户报告原因并等待裁决；不自动重试。`
- `不自动重试或返修。`
- `rejected → status: rejected，加载 spec-revise skill，对每个 FAIL 的验收项归因并原地回退。`
- `review-engineer 可以修改文件。`
- `acceptance-reviewer 可以修改代码。`

预期结果：技术问题零用户询问，review 重审通过前任务不得 done，acceptance 重审通过前需求不得 accepted；超范围问题零修复派发。

错误场景：台账记录失败时显示原因且不派修；第 3 轮仍失败时停止新派工与验收，不把纯技术问题升级给用户。
