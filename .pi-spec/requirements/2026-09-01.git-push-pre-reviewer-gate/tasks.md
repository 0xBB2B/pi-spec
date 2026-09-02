---
name: git-push-pre-reviewer-gate
---

### T-1 绑定已审提交并建立远端来源门禁
- depends_on: []
- files: [/Users/bb/.pi/agent/skills/git-push/__tests__/pre-reviewer-gate.test.ts, /Users/bb/.pi/agent/skills/git-push/SKILL.md]
- refs: [R-1, R-2, R-3, R-4, R-5, R-6, R-7, AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7]
- parallel: false
- verify: bun test /Users/bb/.pi/agent/skills/git-push/__tests__/pre-reviewer-gate.test.ts
- status: done
- step: review
- agent: git-push-gate-final-review
- commit:
- note: review-engineer GO；formal verify 11 pass / 0 fail / 146 assertions；/Users/bb/.pi 非 Git 仓库，无法创建任务 commit。 AC-6/AC-7 原始 Red、最终 Green、隔离 refspec 实测与完整 diff 已保存到 .pi-spec/.cache/review，等待 review-engineer。 Green 自检发现 gh/glab source branch 仍是独立占位符；补 R-7 Red，要求创建命令复用已校验 BRANCH。
