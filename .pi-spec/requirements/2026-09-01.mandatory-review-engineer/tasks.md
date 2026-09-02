---
name: mandatory-review-engineer
---

### T-1 统一只读审查工程师角色
- depends_on: []
- files: [/Users/bb/.pi/agent/agents/__tests__/review-engineer-role.test.ts, /Users/bb/.pi/agent/agents/review-engineer.md, /Users/bb/.pi/agent/agents/requirements-reviewer.md]
- refs: [R-4, AC-4]
- parallel: true
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/agents/__tests__/review-engineer-role.test.ts
- status: done
- step: review
- agent: wf_3d9a591e4cc2
- commit:
- note: 结构化 workflow 返回 Green baseline / no-change Impl / Review 三阶段有效 PASS，最终验证 12 pass / 0 fail；当前目录不是 Git 仓库，无法创建任务提交。

### T-2 建立全局 TDD 三阶段门禁与补审流程
- depends_on: []
- files: [/Users/bb/.pi/agent/AGENTS.md, /Users/bb/.pi/agent/skills/spec-flow/__tests__/mandatory-review-gate.test.ts, /Users/bb/.pi/agent/skills/spec-flow/SKILL.md, /Users/bb/.pi/agent/skills/spec-docs/SKILL.md]
- refs: [R-1, R-2, R-3, R-5, AC-1, AC-2, AC-3, AC-5]
- parallel: true
- verify: bun test /Users/bb/.pi/agent/skills/spec-flow/__tests__/mandatory-review-gate.test.ts
- status: done
- step: review
- agent: review-exception-review
- commit:
- note: review-engineer 返回首行 `## 结论 GO`，最终验证 6 pass / 0 fail；当前目录不是 Git 仓库，无法创建任务提交。

### T-3 支持 Green baseline 与结构化 TDD 门禁
- depends_on: [T-2]
- files: [/Users/bb/.pi/agent/AGENTS.md, /Users/bb/.pi/agent/agents/__tests__/review-engineer-role.test.ts, /Users/bb/.pi/agent/agents/impl-engineer.md, /Users/bb/.pi/agent/agents/review-engineer.md, /Users/bb/.pi/agent/agents/test-engineer.md, /Users/bb/.pi/agent/skills/spec-docs/SKILL.md, /Users/bb/.pi/agent/skills/spec-flow/__tests__/mandatory-review-gate.test.ts, /Users/bb/.pi/agent/skills/spec-flow/SKILL.md]
- refs: [R-1, R-2, R-3, R-6, R-7, R-8, AC-1, AC-2, AC-3, AC-6, AC-7, AC-9]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-flow/__tests__/mandatory-review-gate.test.ts /Users/bb/.pi/agent/agents/__tests__/review-engineer-role.test.ts
- status: done
- step: review
- agent: wf_424eb7c8da54
- commit:
- note: 结构化 workflow 返回 Test/Impl/Review 三阶段有效 PASS，最终验证 25 pass / 0 fail；当前目录不是 Git 仓库，无法创建任务提交。

### T-4 结构化黑盒验收门禁
- depends_on: [T-1, T-3]
- files: [/Users/bb/.pi/agent/agents/acceptance-reviewer.md, /Users/bb/.pi/agent/skills/spec-flow/__tests__/acceptance-structured-gate.test.ts, /Users/bb/.pi/agent/skills/spec-flow/SKILL.md]
- refs: [R-7, R-8, AC-8, AC-9]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-flow/__tests__/acceptance-structured-gate.test.ts
- status: done
- step: review
- agent: wf_a12f50929cdb
- commit:
- note: 结构化 workflow 返回 Test/Impl/Review 三阶段有效 PASS，最终验证 5 pass / 0 fail；当前目录不是 Git 仓库，无法创建任务提交。

### T-5 结构化提交前审查门禁
- depends_on: [T-1, T-3]
- files: [/Users/bb/.pi/.pi-spec/requirements/2026-09-01.mandatory-review-engineer/design.md, /Users/bb/.pi/agent/agents/pre-reviewer.md, /Users/bb/.pi/agent/skills/git-push/__tests__/pre-reviewer-gate.test.ts, /Users/bb/.pi/agent/skills/git-push/SKILL.md]
- refs: [R-7, R-8, AC-8, AC-9]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/git-push/__tests__/pre-reviewer-gate.test.ts
- status: done
- step: review
- agent: wf_74434bcbb9e4
- commit:
- note: 结构化 workflow 返回 Test/Impl/Review 三阶段有效 PASS，最终验证 13 pass / 0 fail；当前目录不是 Git 仓库，无法创建任务提交。

### T-6 建立 canonical v1 决策 writer 与六文件需求契约
- depends_on: [T-5]
- files: [/Users/bb/.pi/agent/skills/spec-docs/__tests__/decision-ledger.test.ts, /Users/bb/.pi/agent/skills/spec-docs/requirements.template.md, /Users/bb/.pi/agent/skills/spec-docs/scripts/decision-ledger.ts, /Users/bb/.pi/agent/skills/spec-docs/scripts/lint.sh, /Users/bb/.pi/agent/skills/spec-docs/SKILL.md]
- refs: [R-17, R-18, R-19, R-20, R-24, AC-19, AC-20, AC-21, AC-22, AC-26, AC-27]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-docs/__tests__/decision-ledger.test.ts && bash /Users/bb/.pi/agent/skills/spec-docs/scripts/lint.sh /Users/bb/.pi/.pi-spec/requirements/2026-09-01.mandatory-review-engineer/requirements.md && bun /Users/bb/.pi/agent/skills/spec-docs/scripts/decision-ledger.ts validate --requirement-dir /Users/bb/.pi/.pi-spec/requirements/2026-09-01.mandatory-review-engineer
- status: done
- step: review
- agent: wf_52faf7ba29f1
- commit:
- note: 第 1 轮自动修复收窄错误 refs 后 Review 返回结构化 PASS/GO；正式验证 10 pass / 0 fail、lint PASS、真实需求 canonical validate PASS；当前目录不是 Git 仓库，无法创建任务提交。

### T-7 实现纯 TypeScript/Node decision-gate、receipt 与有界 permit
- depends_on: [T-6]
- files: [/Users/bb/.pi/agent/extensions/__tests__/decision-gate.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/index.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-17, R-18, R-20, R-21, R-22, R-23, R-25, AC-18, AC-19, AC-22, AC-23, AC-24, AC-25, AC-26, AC-28]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/decision-gate.test.ts
- status: failed
- step: review
- agent: wf_1af5ddccb506
- commit:
- note: 纯 Node 自动返修 3 轮后最终 NO-GO：public permit Schema 的外层 additionalProperties:false 使合法输入不可用；仍有隐藏 attach 形状与 receipt line/hash/recordedAt 校验缺口；真实当前 verify 经 decision_bash 的证据不足；pending journal schema 与 design 漂移。已按 AI-031 回滚自动发现目录中的 T-7 extension/test 与全部 T-7 快照，停止 T-8～T-11 和验收。

### T-12 建立 tasks problem 格式与结构 lint
- depends_on: [T-6]
- problem: P-1
- files: [/Users/bb/.pi/agent/skills/spec-docs/SKILL.md, /Users/bb/.pi/agent/skills/spec-docs/__tests__/task-atomicity-lint.test.ts, /Users/bb/.pi/agent/skills/spec-docs/scripts/tasks-lint.ts]
- refs: [R-26, R-27, AC-29, AC-30]
- parallel: true
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-docs/__tests__/task-atomicity-lint.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-13 收紧 planner 独立问题拆分规则
- depends_on: [T-12]
- problem: P-2
- files: [/Users/bb/.pi/agent/agents/__tests__/planner-atomicity.test.ts, /Users/bb/.pi/agent/agents/planner.md]
- refs: [R-26, AC-29]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/agents/__tests__/planner-atomicity.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-14 阻断非原子 planner 产物
- depends_on: [T-13]
- problem: P-3
- files: [/Users/bb/.pi/agent/skills/spec-flow/SKILL.md, /Users/bb/.pi/agent/skills/spec-flow/__tests__/planning-atomicity-gate.test.ts]
- refs: [R-26, R-27, AC-29, AC-30]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-flow/__tests__/planning-atomicity-gate.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-15 分流 Review 发现的独立问题
- depends_on: [T-14]
- problem: P-4
- files: [/Users/bb/.pi/agent/skills/spec-flow/SKILL.md, /Users/bb/.pi/agent/skills/spec-flow/__tests__/review-issue-routing.test.ts]
- refs: [R-28, AC-31]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-flow/__tests__/review-issue-routing.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-16 区分历史失败与当前执行问题集
- depends_on: [T-15]
- problem: P-5
- files: [/Users/bb/.pi/agent/skills/spec-flow/SKILL.md, /Users/bb/.pi/agent/skills/spec-flow/__tests__/incremental-history-boundary.test.ts]
- refs: [R-27, AC-30]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-flow/__tests__/incremental-history-boundary.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-17 注册 closed decision_record 公共工具
- depends_on: [T-6]
- problem: P-6
- files: [/Users/bb/.pi/agent/extensions/__tests__/decision-record-schema.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/index.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-17, R-18, AC-18, AC-19, AC-26]
- parallel: true
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/decision-record-schema.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-18 绑定 receipt 到真实 canonical 台账行
- depends_on: [T-17]
- problem: P-7
- files: [/Users/bb/.pi/agent/extensions/__tests__/receipt-binding.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-18, AC-19]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/receipt-binding.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-19 建立 closed decision_permit 公共 Schema
- depends_on: [T-18]
- problem: P-8
- files: [/Users/bb/.pi/agent/extensions/__tests__/permit-schema.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/index.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-21, R-22, AC-23, AC-24]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/permit-schema.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-20 持久化并消费有界 permit
- depends_on: [T-19]
- problem: P-9
- files: [/Users/bb/.pi/agent/extensions/__tests__/permit-state.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-21, R-22, AC-23, AC-24]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/permit-state.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-21 阻断 raw unknown 与伪造 provenance 工具
- depends_on: [T-20]
- problem: P-10
- files: [/Users/bb/.pi/agent/extensions/__tests__/hook-provenance.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/index.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-18, R-22, R-23, AC-19, AC-24, AC-25]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/hook-provenance.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-22 裁决 guarded edit 与 write 范围
- depends_on: [T-21]
- problem: P-11
- files: [/Users/bb/.pi/agent/extensions/__tests__/guarded-mutation.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-21, R-22, R-23, AC-23, AC-24, AC-25]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/guarded-mutation.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-23 实现纯 Node 原子文件替换
- depends_on: [T-22]
- problem: P-12
- files: [/Users/bb/.pi/agent/extensions/__tests__/atomic-write.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-22, AC-24]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/atomic-write.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-24 编译 exact tasks.verify 执行计划
- depends_on: [T-23]
- problem: P-13
- files: [/Users/bb/.pi/agent/extensions/__tests__/verify-compiler.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-21, R-22, AC-23, AC-24]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/verify-compiler.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-25 通过真实 pi.exec 执行 compiled verify
- depends_on: [T-24]
- problem: P-14
- files: [/Users/bb/.pi/agent/extensions/__tests__/verify-exec.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-18, R-22, R-25, AC-19, AC-24, AC-28]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/verify-exec.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-26 预检 Agent launcher capability envelope
- depends_on: [T-25]
- problem: P-15
- files: [/Users/bb/.pi/agent/extensions/__tests__/agent-launch-preflight.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/index.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-21, R-22, R-23, AC-23, AC-24, AC-25]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/agent-launch-preflight.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-27 从 Agent tool_result 完成身份 finalization
- depends_on: [T-26]
- problem: P-16
- files: [/Users/bb/.pi/agent/extensions/__tests__/agent-launch-result.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/index.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-18, R-21, R-22, AC-19, AC-23, AC-24]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/agent-launch-result.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-28 绑定 Agent child exact session attach
- depends_on: [T-27]
- problem: P-17
- files: [/Users/bb/.pi/agent/extensions/__tests__/agent-child-attach.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-21, R-22, R-23, AC-23, AC-24, AC-25]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/agent-child-attach.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-29 注入 SubagentWorkflow launcher envelope
- depends_on: [T-28]
- problem: P-18
- files: [/Users/bb/.pi/agent/extensions/__tests__/workflow-launch-envelope.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/index.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-21, R-22, AC-23, AC-24]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/workflow-launch-envelope.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-30 从 Workflow tool_result 绑定真实 run id
- depends_on: [T-29]
- problem: P-19
- files: [/Users/bb/.pi/agent/extensions/__tests__/workflow-launch-result.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/index.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-18, R-21, R-22, AC-19, AC-23, AC-24]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/workflow-launch-result.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-31 建立 Node-only gate readiness
- depends_on: [T-30]
- problem: P-20
- files: [/Users/bb/.pi/agent/extensions/__tests__/readiness.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/index.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts]
- refs: [R-18, R-22, R-25, AC-19, AC-24, AC-28]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/readiness.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-32 验证 Pi package 安装与资源发现
- depends_on: [T-31]
- problem: P-21
- files: [/Users/bb/.pi/agent/extensions/__tests__/package-install.test.ts, /Users/bb/.pi/agent/package.json]
- refs: [R-25, AC-28]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/package-install.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-33 限定 planner gate 写权限
- depends_on: [T-13, T-32]
- problem: P-22
- files: [/Users/bb/.pi/agent/agents/__tests__/planner-gate-role.test.ts, /Users/bb/.pi/agent/agents/planner.md]
- refs: [R-22, R-26, AC-24, AC-29]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/agents/__tests__/planner-gate-role.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-34 限定 test-engineer gate 写权限
- depends_on: [T-32]
- problem: P-23
- files: [/Users/bb/.pi/agent/agents/__tests__/test-gate-role.test.ts, /Users/bb/.pi/agent/agents/test-engineer.md]
- refs: [R-22, R-23, AC-25]
- parallel: true
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/agents/__tests__/test-gate-role.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-35 限定 impl-engineer gate 写权限
- depends_on: [T-32]
- problem: P-24
- files: [/Users/bb/.pi/agent/agents/__tests__/impl-gate-role.test.ts, /Users/bb/.pi/agent/agents/impl-engineer.md]
- refs: [R-22, R-23, AC-25]
- parallel: true
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/agents/__tests__/impl-gate-role.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-36 强制 review-engineer gate 只读权限
- depends_on: [T-32]
- problem: P-25
- files: [/Users/bb/.pi/agent/agents/__tests__/review-engineer-role.test.ts, /Users/bb/.pi/agent/agents/__tests__/review-gate-role.test.ts, /Users/bb/.pi/agent/agents/review-engineer.md]
- refs: [R-4, R-23, AC-4, AC-25]
- parallel: true
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/agents/__tests__/review-gate-role.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-37 限定 acceptance-reviewer gate 权限
- depends_on: [T-32]
- problem: P-26
- files: [/Users/bb/.pi/agent/agents/__tests__/acceptance-gate-role.test.ts, /Users/bb/.pi/agent/agents/acceptance-reviewer.md]
- refs: [R-22, R-23, AC-24, AC-25]
- parallel: true
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/agents/__tests__/acceptance-gate-role.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-38 强制 pre-reviewer gate 只读权限
- depends_on: [T-32]
- problem: P-27
- files: [/Users/bb/.pi/agent/agents/__tests__/pre-review-gate-role.test.ts, /Users/bb/.pi/agent/agents/pre-reviewer.md]
- refs: [R-22, R-23, AC-24, AC-25]
- parallel: true
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/agents/__tests__/pre-review-gate-role.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-39 接通单 task 串行结构化 TDD 门禁
- depends_on: [T-16, T-33, T-34, T-35, T-36]
- problem: P-28
- files: [/Users/bb/.pi/agent/AGENTS.md, /Users/bb/.pi/agent/skills/spec-flow/SKILL.md, /Users/bb/.pi/agent/skills/spec-flow/__tests__/mandatory-review-gate.test.ts, /Users/bb/.pi/agent/skills/spec-flow/__tests__/tdd-serial-gate.test.ts]
- refs: [R-1, R-2, R-3, R-6, R-7, R-8, AC-1, AC-2, AC-3, AC-6, AC-7, AC-9]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-flow/__tests__/tdd-serial-gate.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-40 展示 task 标题与独立三阶段 workflow
- depends_on: [T-39]
- problem: P-29
- files: [/Users/bb/.pi/agent/skills/spec-flow/SKILL.md, /Users/bb/.pi/agent/skills/spec-flow/__tests__/workflow-presentation.test.ts]
- refs: [R-9, R-10, AC-10, AC-11, AC-12]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-flow/__tests__/workflow-presentation.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-41 恢复 TDD 快照与缺失 Review 门禁
- depends_on: [T-40]
- problem: P-30
- files: [/Users/bb/.pi/agent/skills/spec-flow/SKILL.md, /Users/bb/.pi/agent/skills/spec-flow/__tests__/tdd-resume-snapshot.test.ts]
- refs: [R-5, R-8, AC-5, AC-9]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-flow/__tests__/tdd-resume-snapshot.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-42 传播 TDD workflow child permit
- depends_on: [T-41]
- problem: P-31
- files: [/Users/bb/.pi/agent/AGENTS.md, /Users/bb/.pi/agent/skills/spec-flow/SKILL.md, /Users/bb/.pi/agent/skills/spec-flow/__tests__/workflow-permit-integration.test.ts]
- refs: [R-21, R-22, R-23, AC-23, AC-24, AC-25]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-flow/__tests__/workflow-permit-integration.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-43 直接校验 acceptance-reviewer 严格 JSON
- depends_on: [T-37, T-42]
- problem: P-32
- files: [/Users/bb/.pi/agent/agents/acceptance-reviewer.md, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts, /Users/bb/.pi/agent/skills/spec-flow/SKILL.md, /Users/bb/.pi/agent/skills/spec-flow/__tests__/acceptance-direct-json.test.ts, /Users/bb/.pi/agent/skills/spec-flow/__tests__/acceptance-structured-gate.test.ts]
- refs: [R-8, R-12, AC-8, AC-9]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-flow/__tests__/acceptance-direct-json.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-44 限定 acceptance.md 报告写许可
- depends_on: [T-43]
- problem: P-33
- files: [/Users/bb/.pi/agent/agents/acceptance-reviewer.md, /Users/bb/.pi/agent/extensions/__tests__/acceptance-report-permit.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts, /Users/bb/.pi/agent/skills/spec-flow/SKILL.md]
- refs: [R-21, R-22, R-23, AC-23, AC-24, AC-25]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/acceptance-report-permit.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-45 限定 acceptance 黑盒命令许可
- depends_on: [T-44]
- problem: P-34
- files: [/Users/bb/.pi/agent/agents/acceptance-reviewer.md, /Users/bb/.pi/agent/extensions/__tests__/acceptance-command-permit.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts, /Users/bb/.pi/agent/skills/spec-flow/SKILL.md]
- refs: [R-12, R-22, R-23, AC-8, AC-15, AC-24, AC-25]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/acceptance-command-permit.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-46 直接校验 pre-reviewer 严格 JSON
- depends_on: [T-38, T-43]
- problem: P-35
- files: [/Users/bb/.pi/agent/agents/pre-reviewer.md, /Users/bb/.pi/agent/skills/git-push/SKILL.md, /Users/bb/.pi/agent/skills/git-push/__tests__/pre-review-direct-json.test.ts, /Users/bb/.pi/agent/skills/git-push/__tests__/pre-reviewer-gate.test.ts]
- refs: [R-8, R-11, AC-8, AC-9]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/git-push/__tests__/pre-review-direct-json.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-47 绑定 pre-review 到需求与不可变快照
- depends_on: [T-46]
- problem: P-36
- files: [/Users/bb/.pi/agent/skills/git-push/SKILL.md, /Users/bb/.pi/agent/skills/git-push/__tests__/pre-review-binding.test.ts, /Users/bb/.pi/agent/skills/git-push/__tests__/pre-reviewer-gate.test.ts]
- refs: [R-11, R-17, R-18, R-20, AC-14, AC-18, AC-19, AC-22]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/git-push/__tests__/pre-review-binding.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-48 限定已审远端写命令许可
- depends_on: [T-45, T-47]
- problem: P-37
- files: [/Users/bb/.pi/agent/extensions/__tests__/remote-command-permit.test.ts, /Users/bb/.pi/agent/extensions/decision-gate/policy.ts, /Users/bb/.pi/agent/skills/git-push/SKILL.md, /Users/bb/.pi/agent/skills/git-push/__tests__/pre-reviewer-gate.test.ts]
- refs: [R-11, R-18, R-20, R-21, R-22, R-23, AC-14, AC-19, AC-22, AC-23, AC-24, AC-25]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/extensions/__tests__/remote-command-permit.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-49 统一三类 Review 归因与返修路由
- depends_on: [T-15, T-45, T-48]
- problem: P-38
- files: [/Users/bb/.pi/agent/AGENTS.md, /Users/bb/.pi/agent/skills/git-push/SKILL.md, /Users/bb/.pi/agent/skills/spec-flow/SKILL.md, /Users/bb/.pi/agent/skills/spec-flow/__tests__/mandatory-review-gate.test.ts, /Users/bb/.pi/agent/skills/spec-flow/__tests__/reviewer-repair-routing.test.ts]
- refs: [R-3, R-13, R-14, R-16, R-17, R-18, R-28, AC-3, AC-13, AC-14, AC-15, AC-16, AC-18, AC-19, AC-26, AC-31]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-flow/__tests__/reviewer-repair-routing.test.ts
- status: todo
- step:
- agent:
- commit:
- note:

### T-50 限制 Review 自动返修为三轮
- depends_on: [T-49]
- problem: P-39
- files: [/Users/bb/.pi/agent/AGENTS.md, /Users/bb/.pi/agent/skills/git-push/SKILL.md, /Users/bb/.pi/agent/skills/spec-flow/SKILL.md, /Users/bb/.pi/agent/skills/spec-flow/__tests__/mandatory-review-gate.test.ts, /Users/bb/.pi/agent/skills/spec-flow/__tests__/reviewer-repair-limit.test.ts]
- refs: [R-15, AC-17]
- parallel: false
- verify: PI_CODING_AGENT_DIR=/Users/bb/.pi/agent bun test /Users/bb/.pi/agent/skills/spec-flow/__tests__/reviewer-repair-limit.test.ts
- status: todo
- step:
- agent:
- commit:
- note:
