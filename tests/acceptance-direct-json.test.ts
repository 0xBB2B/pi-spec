import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FLOW_PATH = join(PACKAGE_ROOT, "skills", "spec-flow", "SKILL.md");
const REVIEWER_PATH = join(PACKAGE_ROOT, "agents", "acceptance-reviewer.md");

const ACCEPTANCE_FIELDS = [
  "phase",
  "verdict",
  "summary",
  "issues",
  "evidence",
  "acceptanceResult",
  "reportPath",
  "items",
  "uncovered",
];
const ACCEPTANCE_ITEM_FIELDS = ["id", "result", "observed", "difference"];
const WORKFLOW_PREREQUISITES = [
  { name: "要求", pattern: /(?:要求|依赖|前提)/u },
  { name: "启动", pattern: /(?:启动|创建|运行)/u },
  { name: "承载", pattern: /(?:承载|承接|容纳)/u },
  { name: "传递", pattern: /(?:传递|传输|交付)/u },
] as const;

function acceptanceStage(flow: string): string {
  const start = flow.indexOf("## 阶段五：accepting");
  const end = flow.indexOf("## 断点续接", start);

  expect(start, "spec-flow must document its accepting stage").toBeGreaterThanOrEqual(0);
  expect(end, "the accepting stage must end before the resume instructions").toBeGreaterThan(start);
  return flow.slice(start, end);
}

function expectFieldsInOrder(contract: string, fields: string[], label: string): void {
  let position = -1;
  for (const field of fields) {
    const next = contract.indexOf(`"${field}"`, position + 1);
    expect(next, `${label} must declare ${field} in its closed JSON shape`).toBeGreaterThan(position);
    position = next;
  }
}

function markdownStatements(contract: string): string[] {
  return contract
    .split(/\n\s*\n/u)
    .flatMap((paragraph) => paragraph.split(/(?<=[。！？])\s*/u))
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function isExplicitUniversalWorkflowProhibition(statement: string): boolean {
  return (
    /(?:不得|禁止|不能|不可|不应)/u.test(statement) &&
    /(?:(?:任何|任一|所有)[^。！？\n]{0,40}workflow|workflow[^。！？\n]{0,40}(?:任何|任一|所有))/iu.test(statement)
  );
}

function acceptanceWorkflowPrerequisiteViolations(contract: string, label: string): string[] {
  const workflowStatements = markdownStatements(contract).filter((statement) => /workflow/iu.test(statement));
  const violations: string[] = [];

  if (workflowStatements.length === 0) {
    violations.push(`${label} must state its universal workflow prohibition`);
  }
  if (workflowStatements.some((statement) => !isExplicitUniversalWorkflowProhibition(statement))) {
    violations.push(`${label} must make every workflow-related acceptance statement an explicit universal prohibition`);
  }

  const missingProhibitions = WORKFLOW_PREREQUISITES.filter(
    ({ pattern }) =>
      !workflowStatements.some(
        (statement) => pattern.test(statement) && isExplicitUniversalWorkflowProhibition(statement),
      ),
  ).map(({ name }) => name);
  if (missingProhibitions.length > 0) {
    violations.push(
      `${label} must prohibit ${missingProhibitions.join("、")} of acceptance invocation or result by any workflow`,
    );
  }

  return violations;
}

async function contracts(): Promise<{ acceptance: string; reviewer: string }> {
  const [flow, reviewer] = await Promise.all([readFile(FLOW_PATH, "utf8"), readFile(REVIEWER_PATH, "utf8")]);
  return { acceptance: acceptanceStage(flow), reviewer };
}

describe("黑盒验收直接 JSON 门禁", () => {
  test("R-2、AC-1：由主 agent 直接调用验收者，且不存在验收 workflow 启动路径", async () => {
    const { acceptance, reviewer } = await contracts();

    expect(acceptance, "acceptance must call the reviewer directly through Agent").toMatch(
      /(?:主 agent|调用方)[\s\S]{0,100}直接[\s\S]{0,100}Agent[\s\S]{0,180}acceptance-reviewer/,
    );
    expect(acceptance, "the direct reply must not rely on a StructuredOutput runtime schema").not.toMatch(
      /StructuredOutput|ACCEPTANCE_SCHEMA/,
    );
    expect(reviewer, "the reviewer must return one strict JSON final reply for the direct caller").toMatch(
      /(?:完整最终回复|最终回复)[\s\S]{0,160}(?:唯一|严格)[\s\S]{0,160}JSON(?: 对象)?/,
    );
    expect(reviewer, "the reviewer cannot require StructuredOutput when called directly").not.toMatch(
      /StructuredOutput/,
    );
    expect(
      [
        ...acceptanceWorkflowPrerequisiteViolations(acceptance, "spec-flow 的 accepting 阶段"),
        ...acceptanceWorkflowPrerequisiteViolations(reviewer, "acceptance-reviewer 契约"),
      ],
      "both acceptance contracts must universally prohibit every workflow prerequisite",
    ).toEqual([]);
  });

  test("R-3、AC-3：仅接受精确且语义一致的完整 JSON 与指定报告", async () => {
    const { acceptance, reviewer } = await contracts();

    for (const [label, contract] of [
      ["主 agent 验收门禁", acceptance],
      ["acceptance-reviewer 最终回复", reviewer],
    ] as const) {
      expectFieldsInOrder(contract, ACCEPTANCE_FIELDS, label);
      expectFieldsInOrder(contract, ACCEPTANCE_ITEM_FIELDS, `${label} 的 items 条目`);
      expect(contract, `${label} must reject added or missing JSON fields`).toMatch(
        /(?:约定外|未声明|额外)[\s\S]{0,160}(?:字段|属性)[\s\S]{0,160}(?:拒绝|FAIL|失败)/,
      );
    }

    expect(acceptance, "the caller parses the complete reply once instead of extracting JSON from prose").toMatch(
      /(?:完整|整个)[\s\S]{0,80}(?:最终回复|回复)[\s\S]{0,160}JSON\.parse/,
    );
    expect(acceptance, "text before or after JSON, empty values, arrays, and fences fail closed").toMatch(
      /(?:前后文字|围栏|空值|数组)[\s\S]{0,220}(?:FAIL|失败关闭|拒绝)/,
    );
    expect(acceptance, "only the complete PASS combination can accept a requirement").toMatch(
      /verdict\s*===?\s*["']PASS["'][\s\S]{0,240}acceptanceResult\s*===?\s*["']accepted["'][\s\S]{0,360}reportPath\s*===?\s*args\.acceptancePath/,
    );
    expect(acceptance, "a FAIL must contain a concrete diagnosis rather than infer success from prose").toMatch(
      /(?:FAIL|rejected)[\s\S]{0,260}(?:issues|uncovered|result[\s\S]{0,80}FAIL)[\s\S]{0,260}(?:具体原因|具体差异|reason)/,
    );
    expect(acceptance, "a different path, unreadable report, or rejected report cannot accept the requirement").toMatch(
      /(?:路径不一致|报告不可读|frontmatter[\s\S]{0,80}rejected|result[\s\S]{0,80}rejected)[\s\S]{0,260}(?:不得[\s\S]{0,80}accepted|不[\s\S]{0,80}置为[\s\S]{0,80}accepted|FAIL|失败)/,
    );
  });

  test("R-4、R-5、AC-4：验收者是指定报告的唯一写入者，门禁失败仍保留其报告", async () => {
    const { acceptance, reviewer } = await contracts();

    expect(reviewer, "the reviewer writes the caller-specified report before its final JSON reply").toMatch(
      /(?:先|之后)[\s\S]{0,120}(?:写入|写到)[\s\S]{0,160}(?:指定|给定)[\s\S]{0,120}报告[\s\S]{0,240}(?:最终回复|JSON)/,
    );
    expect(reviewer, "the reviewer may write only the specified acceptance report").toMatch(
      /(?:只允许|仅允许|只能)[\s\S]{0,160}(?:写入|写)[\s\S]{0,160}(?:指定|给定)[\s\S]{0,120}报告/,
    );
    expect(acceptance, "the main agent only reads the specified report and never becomes a second writer").toMatch(
      /(?:主 agent|调用方)[\s\S]{0,200}(?:只读取|仅读取)[\s\S]{0,160}报告[\s\S]{0,260}(?:不得|不能)[\s\S]{0,160}(?:转录|覆盖|回滚)/,
    );
    expect(acceptance, "invalid direct JSON preserves the reviewer's report and blocks accepted status").toMatch(
      /(?:JSON[\s\S]{0,100}(?:无效|失败)|门禁失败)[\s\S]{0,260}(?:保留|不得[\s\S]{0,80}(?:转录|覆盖|回滚))[\s\S]{0,260}(?:不得[\s\S]{0,80}accepted|不[\s\S]{0,80}置为[\s\S]{0,80}accepted|status[\s\S]{0,80}failed)/,
    );
  });
});
