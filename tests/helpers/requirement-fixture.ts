import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const REQUIREMENT_SLUG = "fixture-decision";
export const SPEC_PATH = "fixture/record-decision";

export type Fixture = {
  root: string;
  specDir: string;
  specIndex: string;
  specFile: string;
  requirementDir: string;
  requirements: string;
  tasksDir: string;
  tasksIndex: string;
  acceptance: string;
  ai: string;
  user: string;
};

export function requirementDocument(status: "draft" | "confirmed" | "accepted" = "draft"): string {
  return `---
name: ${REQUIREMENT_SLUG}
title: 台账 fixture
status: ${status}
created: 2026-09-01
---

# 台账 fixture

## 1. 背景

用户需要可审计的已形成决定。

## 2. 目标与非目标

### 非目标

- 不记录未形成选择的问题。

### 目标

- 每项材料性决定恰好一行。

## 3. 规范变更

| 规范 | 变更 | 说明 |
|---|---|---|
| ${SPEC_PATH} | 新增 | 记录已形成决定 |

## 4. 边界与已知坑

- 失败与重试：记录失败时不执行动作。
`;
}

export function specDocument(): string {
  return `---
name: record-decision
description: 材料性决定形成后先记录再执行
---
# 记录已形成决定

## 目的
让每项材料性决定在动作前留下可审计记录。

## 逻辑
用户或 AI 形成材料性决定后，系统先向对应台账追加一行，拿到回执再执行动作；记录失败则动作不执行。

## 约束
- C-1：当材料性决定形成时，系统应在动作前记录该决定。
- C-2：如果记录失败，系统应不执行关联动作并显示原因。

## 例子
用户确认一个方案，系统先在用户台账追加一行，随后才修改文件。

## 验收
### AC-1 记录已形成决定  ← C-1
- 触发: 操作 形成一个材料性决定
- Given: 对应需求台账可写
- When: 用户确认选择
- Then: 对应台账增加一行完整记录

### AC-2 记录失败阻断动作  ← C-2
- 触发: 操作 在台账不可写时形成一个材料性决定
- Given: 对应需求台账被写入非法内容
- When: 用户确认选择
- Then: 界面显示台账非法的原因，关联动作没有执行
`;
}

export async function createFixture(
  tempRoots: string[],
  status: "draft" | "confirmed" | "accepted" = "draft",
): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "decision-ledger-"));
  tempRoots.push(root);
  const specDir = join(root, ".pi-spec", "spec");
  const requirementDir = join(root, ".pi-spec", "requirements", `2026-09-01.${REQUIREMENT_SLUG}`);
  const fixture: Fixture = {
    root,
    specDir,
    specIndex: join(specDir, "INDEX.md"),
    specFile: join(specDir, `${SPEC_PATH}.md`),
    requirementDir,
    requirements: join(requirementDir, "requirements.md"),
    tasksDir: join(requirementDir, "tasks"),
    tasksIndex: join(requirementDir, "tasks", "INDEX.md"),
    acceptance: join(requirementDir, "acceptance.md"),
    ai: join(requirementDir, "ai-decisions.jsonl"),
    user: join(requirementDir, "user-decisions.jsonl"),
  };

  await mkdir(join(specDir, "fixture"), { recursive: true });
  await mkdir(fixture.tasksDir, { recursive: true });
  await Promise.all([
    writeFile(fixture.specIndex, `# 规范索引\n\n## fixture\n\n- [record-decision](${SPEC_PATH}.md) — 材料性决定形成后先记录再执行\n`),
    writeFile(fixture.specFile, specDocument()),
    writeFile(fixture.requirements, requirementDocument(status)),
    writeFile(fixture.tasksIndex, "# 任务索引\n"),
    writeFile(fixture.acceptance, "---\nresult: rejected\ndate: 2026-09-01\n---\n"),
  ]);
  return fixture;
}

export async function removeFixtures(tempRoots: string[]): Promise<void> {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
}
