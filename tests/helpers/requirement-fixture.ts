import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const REQUIREMENT_SLUG = "fixture-decision";

export type Fixture = {
  root: string;
  requirementDir: string;
  requirements: string;
  design: string;
  tasks: string;
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

## 3. 术语

| 术语 | 定义 |
|---|---|
| 材料性决定 | 会影响后续动作的已形成选择。 |

## 4. 需求

### R-1 记录已形成决定

当材料性决定形成时，系统应在动作前记录该决定。

## 5. 行为方案

用户形成选择后获得可观察的记录结果。

## 6. 边界与已知坑

- 失败与重试：记录失败时不执行动作。

## 7. 验收标准

### AC-1 记录已形成决定  ← R-1
- 触发: 操作 形成一个材料性决定
- Given: 对应需求台账可写
- When: 用户确认选择
- Then: 对应台账增加一行完整记录
`;
}

export async function createFixture(
  tempRoots: string[],
  status: "draft" | "confirmed" | "accepted" = "draft",
): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "decision-ledger-"));
  tempRoots.push(root);
  const requirementDir = join(root, `2026-09-01.${REQUIREMENT_SLUG}`);
  await mkdir(requirementDir);
  const fixture: Fixture = {
    root,
    requirementDir,
    requirements: join(requirementDir, "requirements.md"),
    design: join(requirementDir, "design.md"),
    tasks: join(requirementDir, "tasks.md"),
    acceptance: join(requirementDir, "acceptance.md"),
    ai: join(requirementDir, "ai-decisions.jsonl"),
    user: join(requirementDir, "user-decisions.jsonl"),
  };

  await writeFile(fixture.requirements, requirementDocument(status));
  await Promise.all([
    writeFile(fixture.design, "# 设计\n"),
    writeFile(fixture.tasks, "---\nname: fixture-decision\n---\n"),
    writeFile(fixture.acceptance, "---\nresult: rejected\ndate: 2026-09-01\n---\n"),
  ]);
  return fixture;
}

export async function removeFixtures(tempRoots: string[]): Promise<void> {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
}
