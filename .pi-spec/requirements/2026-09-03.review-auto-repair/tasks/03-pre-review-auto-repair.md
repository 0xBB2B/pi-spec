---
id: T-3
title: 自动返修提交前审查
depends_on: []
files: [/Users/bb/Projects/pi-spec/skills/git-push/SKILL.md, /Users/bb/Projects/pi-spec/tests/git-push-auto-repair.test.ts]
refs: [review-gates/auto-repair/AC-2, review-gates/product-decision-escalation/AC-1, review-gates/repair-round-limit/AC-1]
parallel: true
verify: bun test tests/git-push-auto-repair.test.ts
status: done
step: review
agent: wf_bb1fb47b789d
commit: ff967e9
note:
---

## 目标
让 git-push 在远端写入保持为零时自动修复 pre-reviewer 的非产品阻塞项、更新本地提交并重审，产品取舍才询问用户且单门禁最多三轮。

## 业务规则

### review-gates/auto-repair/AC-2
约束 C-1：当审查问题不需要产品决策且修复不超出用户已授权的目标、文件范围和验收标准时，系统应自动派发所需的测试与实现修复，并再次调用原审查角色。

验收：
- 触发: 操作 让 `pre-reviewer` 报告一个不涉及产品决策的阻塞问题
- Given: 问题可在已批准范围内通过测试或实现改动解决
- When: 主 agent 校验审查结果并完成归因
- Then: AI 决策台账先记录决定，系统自动完成修复与必要验证，再调用 `pre-reviewer` 重审，未执行任何未经审查的远端写入

### review-gates/product-decision-escalation/AC-1
约束 C-1：当审查问题会改变外部可观察行为、数据、安全、权限或验收标准，或无法从已确认规范与项目惯例唯一推导时，系统应询问用户；只有用户形成选择后，系统才应在修改前记录该决定。

约束 C-2：如果用户忽略、取消或未回答问题，系统应不写入任何决策台账行，也不修改相关行为。

验收：
- 触发: 操作 让任一审查角色报告一个存在两种不同外部行为取舍的问题
- Given: 已确认规范与项目惯例无法唯一决定采用哪种行为
- When: 主 agent 向用户展示具体选项，但用户忽略或取消问题
- Then: 用户决策台账没有新增记录，相关行为没有修改；当用户随后形成明确选择时，系统在执行前只追加一行完整用户决定

### review-gates/repair-round-limit/AC-1
约束 C-1：在同一审查门禁的自动返修期间，系统应最多执行 3 轮修复与重审。

约束 C-2：如果同一审查门禁的第 3 轮返修后仍未通过，系统应记录技术阻塞并停止，不得继续返修，也不得把纯技术问题转为用户决策请求。

验收：
- 触发: 操作 让同一审查门禁的非产品问题连续三轮修复后仍未通过
- Given: 每轮修复都由已有授权或必要的材料性 AI 决定覆盖，并由原角色重审
- When: 第 3 轮审查再次返回未通过
- Then: 系统停止继续返修并报告技术阻塞，不向用户询问如何解决纯技术问题，决策台账不增加机械状态记录

## 涉及文件
- 修改 `/Users/bb/Projects/pi-spec/skills/git-push/SKILL.md`：将合法 pre-review FAIL 接入归因、自动修复、重新提交、快照重建、直接重审、产品升级和三轮停止路径。
- 新建 `/Users/bb/Projects/pi-spec/tests/git-push-auto-repair.test.ts`：验证提交前返修提示契约且所有远端写入仍受新 PASS 快照约束。

## 函数清单
- `/Users/bb/Projects/pi-spec/tests/git-push-auto-repair.test.ts`
  - `readGitPushSkill`：读取提交与推送提示契约。
  - `preReviewRepairContract`：提取 pre-reviewer 返修与放行段落。
  - `assertNoRemoteWriteBeforePass`：核对每轮返修后的远端写入门禁。

## 协作关系
git-push 复用统一失败归因规则和 `decision_record`；自动返修派给 test-engineer 或 impl-engineer，按 git-commit 约定形成新的本地提交后重算快照，并继续直接调用只读 pre-reviewer。

## 验证方式
公开入口：请求提交 PR/MR，并令 pre-reviewer 返回一个合法严格 JSON FAIL；分别覆盖可自动解决、需产品选择和连续三轮失败。

必须出现的句子：
- `pre-reviewer 返回合法 FAIL 后，主 agent 逐条归因；可自动解决的问题在 AI 决策台账记录成功后，自动派发所需的测试或实现修复并完成必要验证。`
- `返修改动必须按 git-commit 约定形成新的本地提交，重新采集 REVIEW_HEAD 与 REVIEW_FINGERPRINT，再直接调用 pre-reviewer；取得并复核绑定新快照的严格 JSON PASS 前，远端写入保持为 0。`
- `pre-reviewer 门禁独立计数，一次归因、修复派发并再次直接调用 pre-reviewer 计为一轮，最多三轮。`
- `修复派发失败、重审结果非法或证据不足均计入当前门禁的一轮并按未通过处理；第三轮仍未通过时报告技术阻塞并停止，不再返修，不询问用户如何解决纯技术问题，也不写机械状态决定。`
- `问题会改变外部可观察行为、数据、安全、权限或验收标准，修复超出已授权目标、文件范围或验收标准，或无法由已确认规范与项目惯例唯一推导时，必须向用户展示具体选项、适用场景、代价和推荐项。`
- `用户忽略、取消或未回答时，不新增任何决策台账行，也不修改相关行为；用户明确选择后，必须先通过 decision_record 追加一行完整用户决定，再执行修复。`

必须不再出现的句子：
- `审查明确 FAIL 后立即停止且不自动返修。`
- `第 7 节 pre-reviewer 审查未通过时一律停止。`
- `pre-reviewer 可以直接修改文件。`
- `第三轮失败后向用户询问如何修复纯技术问题。`
- `沿用返修前的 REVIEW_HEAD 或 REVIEW_FINGERPRINT 放行远端写入。`

预期结果：授权内修复无需用户介入，且每个新提交都只有在新快照获得严格 PASS 并复核一致后才可 push 或创建 PR/MR。

错误场景：用户不作产品选择时台账与行为均不变；台账追加失败时不派修；第三轮仍失败时保留本地提交并保持远端写入为零。
