import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FAILURE_HANDLING_RULE_PATH = join(PACKAGE_ROOT, "rules", "05-review-failure-handling.md");

async function readFailureHandlingRule(): Promise<string> {
  const rule = Bun.file(FAILURE_HANDLING_RULE_PATH);
  expect(await rule.exists(), "the failure-handling rule must be available for package rule injection").toBe(true);
  return rule.text();
}

function requiredStatements(): readonly string[] {
  return [
    "review-engineer、pre-reviewer 或 acceptance-reviewer 返回 FAIL 后，审查角色保持只读，由主 agent 逐条归因。",
    "当前改动直接造成且违反当前任务预期结果的问题属于当前任务；与当前任务根因和预期结果可独立验证的问题必须新增具有独立验证结论的后续任务，不得并入当前返修。",
    "主 agent 必须区分产品决策与可自动解决的问题，并在行动前通过 decision_record 记录归因与修复路径；记录失败时显示原因且不得派发修复。",
    "每个审查门禁独立计算自动返修轮次，一次归因、修复派发并再次调用原审查角色计为一轮，最多三轮。",
    "同一门禁第三轮重审仍未通过时，记录技术阻塞并停止，不再返修，不向用户询问纯技术问题，也不为该机械状态增加决策台账记录。",
    "修复派发失败、重审结果非法或证据不足均计入当前门禁的一轮并按未通过处理。",
  ];
}

function forbiddenStatements(): readonly string[] {
  return [
    "审查角色可以直接修改文件。",
    "审查失败后把所有发现并入当前任务。",
    "第三轮失败后继续自动返修。",
    "决策台账记录失败后仍可派发修复。",
  ];
}

describe("审查失败统一归因规则", () => {
  test("AC-1、AC-2：规定只读归因、可写入路径和有界返修", async () => {
    const rule = await readFailureHandlingRule();

    for (const statement of requiredStatements()) {
      expect(rule, `the injected rule must require: ${statement}`).toContain(statement);
    }
  });

  test("AC-1、AC-2：禁止绕过主 agent 归因、台账失败和返修上限", async () => {
    const rule = await readFailureHandlingRule();

    for (const statement of forbiddenStatements()) {
      expect(rule, `the injected rule must not allow: ${statement}`).not.toContain(statement);
    }
  });

  test("review-gates/independent-issue-task/AC-1：独立问题新增后续任务", async () => {
    const rule = await readFailureHandlingRule();

    expect(rule).toContain(
      "与当前任务根因和预期结果可独立验证的问题必须新增具有独立验证结论的后续任务，不得并入当前返修。",
    );
  });
});
