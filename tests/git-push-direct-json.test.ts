import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GIT_PUSH_SKILL_PATH = join(PACKAGE_ROOT, "skills", "git-push", "SKILL.md");
const PRE_REVIEWER_PATH = join(PACKAGE_ROOT, "agents", "pre-reviewer.md");

const REQUIRED_FIELDS = [
  "phase",
  "verdict",
  "summary",
  "issues",
  "evidence",
  "reviewedHead",
  "contentFingerprint",
  "blockingFindings",
];
const REQUIRED_FINDING_FIELDS = ["severity", "location", "problem"];

async function readPreReviewContracts(): Promise<{ skill: string; reviewer: string }> {
  const [skill, reviewer] = await Promise.all([
    Bun.file(GIT_PUSH_SKILL_PATH).text(),
    Bun.file(PRE_REVIEWER_PATH).text(),
  ]);
  return { skill, reviewer };
}

describe("提交前直接 JSON 门禁", () => {
  test("直接调用 pre-reviewer，且只有绑定调用方快照的合法 PASS 可以放行", async () => {
    const { skill, reviewer } = await readPreReviewContracts();

    expect(
      skill,
      "the main agent must directly invoke pre-reviewer after recording the review snapshots",
    ).toMatch(/(?:主\s*agent|调用方)[\s\S]{0,320}(?:直接调用|直接使用)[\s\S]{0,180}(?:Agent|agent)[\s\S]{0,220}pre-reviewer/i);
    expect(skill, "pre-review must not start a SubagentWorkflow").not.toMatch(/SubagentWorkflow/);
    expect(
      reviewer,
      "the reviewer final response must be the sole strict JSON object rather than StructuredOutput",
    ).toMatch(/(?:完整)?最终回复[\s\S]{0,100}(?:仅|只|唯一)[\s\S]{0,100}(?:严格\s*)?JSON(?:\s*对象)?/);
    expect(reviewer, "pre-reviewer must not require a StructuredOutput or workflow caller").not.toMatch(/StructuredOutput|SubagentWorkflow/i);

    for (const field of REQUIRED_FIELDS) {
      expect(reviewer, `the strict top-level result must declare ${field}`).toContain(`\`${field}\``);
    }
    expect(reviewer, "top-level result fields must be an exact closed set").toMatch(/顶层字段[\s\S]{0,180}(?:精确|不得添加|约定外字段)/);
    for (const field of REQUIRED_FINDING_FIELDS) {
      expect(reviewer, `each blocking finding must declare ${field}`).toContain(`\`${field}\``);
    }
    expect(reviewer, "blocking findings must be a closed object with the permitted severities").toMatch(
      /blockingFindings[\s\S]{0,260}(?:只能|精确)[\s\S]{0,220}severity[\s\S]{0,160}location[\s\S]{0,160}problem[\s\S]{0,220}(?:Blocker|Important)/,
    );
    expect(reviewer, "all decision and finding text values must be non-empty").toMatch(
      /summary[\s\S]{0,120}evidence[\s\S]{0,180}(?:快照字段|reviewedHead)[\s\S]{0,240}(?:不得为空|非空)/,
    );
    expect(
      reviewer,
      "a PASS must have empty issues and blocking findings and exactly echo both caller snapshots",
    ).toMatch(/PASS[\s\S]{0,480}issues[^。\n]*(?:为空|空)[\s\S]{0,260}blockingFindings[^。\n]*(?:为空|空)[\s\S]{0,520}(?:REVIEW_HEAD|reviewedHead)[\s\S]{0,280}(?:REVIEW_FINGERPRINT|contentFingerprint)/);
    expect(
      skill,
      "the caller must independently recompute the snapshots after a valid PASS before any remote write",
    ).toMatch(/(?:PASS|通过)[\s\S]{0,420}(?:重新计算|复核)[\s\S]{0,300}(?:REVIEW_HEAD|HEAD)[\s\S]{0,360}(?:REVIEW_FINGERPRINT|指纹)/);
  });

  test("非严格、矛盾或不匹配的直接回复失败关闭并保留本地提交", async () => {
    const { skill, reviewer } = await readPreReviewContracts();
    const contract = `${skill}\n${reviewer}`;

    expect(
      skill,
      "the complete final reply must be parsed as a whole exactly once, with no text extraction or natural-language inference",
    ).toMatch(/(?:完整最终回复|审查回复)[\s\S]{0,280}(?:整体|完整)[\s\S]{0,180}(?:一次|仅一次)[\s\S]{0,160}JSON[\s\S]{0,100}解析/);
    for (const [name, condition] of [
      ["text before or after the JSON", /(?:前后文字|说明文字)/i],
      ["a fenced reply", /(?:围栏|fence)/i],
      ["an empty reply", /(?:空值|空结果|null)/i],
      ["an array reply", /数组/],
      ["an unparseable reply", /(?:无法解析|解析失败)/],
      ["a missing field", /(?:缺少|缺失).*字段/],
      ["an extra field", /(?:额外字段|约定外字段)/],
      ["contradictory fields", /矛盾/],
      ["a mismatched snapshot", /(?:快照不匹配|快照.*不一致)/],
    ]) {
      expect(contract, `the strict gate must reject ${name}`).toMatch(condition);
    }
    expect(
      skill,
      "each rejected result must expose a concrete parse or validation reason",
    ).toMatch(/(?:解析失败|校验失败|具体原因|reason)/);
    expect(
      skill,
      "every invalid direct result must stop push and PR/MR creation while preserving the local commit",
    ).toMatch(/(?:Schema 缺失|null|非法|矛盾|不一致|明确 FAIL)[\s\S]{0,240}(?:保留本地 commit|本地提交保持不变)[\s\S]{0,240}(?:停止|不得)[\s\S]{0,240}(?:push|PR\/MR)/i);
  });
});
