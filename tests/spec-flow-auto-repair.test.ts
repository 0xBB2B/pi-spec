import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FLOW_PATH = join(PACKAGE_ROOT, "skills", "spec-flow", "SKILL.md");

async function readSpecFlow(): Promise<string> {
  return readFile(FLOW_PATH, "utf8");
}

function executingContract(flow: string): string {
  const start = flow.indexOf("## 阶段四：executing");
  const end = flow.indexOf("## 阶段五：accepting", start);

  expect(start, "spec-flow must document its executing stage").toBeGreaterThanOrEqual(0);
  expect(end, "the executing stage must end before accepting").toBeGreaterThan(start);
  return flow.slice(start, end);
}

function acceptingContract(flow: string): string {
  const start = flow.indexOf("## 阶段五：accepting");
  const end = flow.indexOf("## 断点续接", start);

  expect(start, "spec-flow must document its accepting stage").toBeGreaterThanOrEqual(0);
  expect(end, "the accepting stage must end before the resume instructions").toBeGreaterThan(start);
  return flow.slice(start, end);
}

describe("审查与验收自动返修", () => {
  test("AC-1、AC-4：review-engineer 的技术问题记账后自动返修，超出授权才询问用户", async () => {
    const executing = executingContract(await readSpecFlow());

    expect(executing).toContain(
      "review-engineer 返回 FAIL 后，主 agent 逐条归因；可自动解决的问题在 AI 决策台账记录成功后，自动派发同一任务所需的测试或实现修复，再由 review-engineer 重审，期间不询问用户。",
    );
    expect(executing).toContain(
      "review-engineer 的修复不得跳过 test-engineer、impl-engineer 与 review-engineer 的结构化 TDD 门禁。",
    );
    expect(executing).toContain(
      "修复需要扩大已授权目标、任务 files 或验收标准时，必须作为产品决策询问用户，不得自动返修。",
    );
  });

  test("AC-3：acceptance-reviewer 的实现偏差记账、TDD 审查并由验收者重审", async () => {
    const accepting = acceptingContract(await readSpecFlow());

    expect(accepting).toContain(
      "acceptance-reviewer 返回 FAIL 后，主 agent 核对严格 JSON 与指定报告并逐条归因；实现偏差可自动解决时，先记录 AI 决定，再派发修复并完成结构化 TDD 审查，最后直接调用 acceptance-reviewer 重审。",
    );
    expect(accepting).toContain(
      "acceptance-reviewer 返修期间仍由验收者独占写入指定报告，主 agent 只读取报告。",
    );
  });

  test("错误路径：两个门禁各自限三轮，且移除失败即停止与角色可写入的冲突契约", async () => {
    const flow = await readSpecFlow();

    expect(flow).toContain(
      "review-engineer 与 acceptance-reviewer 分别独立计数，每个门禁最多三轮返修；修复派发失败、非法重审结果或证据不足计入一轮，第三轮仍未通过时记录技术阻塞并停止。",
    );
    for (const obsoleteContract of [
      "任一任务 failed → 停止派新任务，向用户报告原因并等待裁决；不自动重试。",
      "不自动重试或返修。",
      "rejected → status: rejected，加载 spec-revise skill，对每个 FAIL 的验收项归因并原地回退。",
      "review-engineer 可以修改文件。",
      "acceptance-reviewer 可以修改代码。",
    ]) {
      expect(flow).not.toContain(obsoleteContract);
    }
  });
});
