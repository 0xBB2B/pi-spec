import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SPEC_DOCS_PATH = join(PACKAGE_ROOT, "skills", "spec-docs", "SKILL.md");
const PLANNER_PATH = join(PACKAGE_ROOT, "agents", "planner.md");

const REQUIRED_STATEMENTS = [
  ["AC-1、AC-2、AC-3：限制对象", "每份任务文件扣除示例代码块与成品代码块后最多 200 行，不限制任务的代码改动量。"],
  ["AC-1：整份文件独立计数", "按整份文件统计物理行，计入 frontmatter 元数据及其分隔行、标题、正文和空行，每份文件独立计算。"],
  ["AC-2：两类代码块及围栏豁免", "示例代码块与成品代码块的全部内容及首尾围栏不计数，除此之外的内容均正常计数。"],
  ["AC-1：200/201 行边界", "计数恰为 200 行时满足行数要求，超过 200 行时报告任务文件超过 200 行。"],
  ["AC-1：新增元数据、标题、空行", "在 200 行需计数内容之外新增一行元数据、一个标题或一个空行，均变为 201 行并报告任务文件超限。"],
  ["AC-2：102 行代码块与块外说明", "在 200 行需计数内容之外，添加连同围栏共 102 行的示例代码块、成品代码块或同时添加两者，仍为 200 行；在代码块外再新增一行说明文字则为 201 行并报告任务文件超限。"],
  ["AC-3：不得因代码改动量拆分或拒绝", "不限制预估或实际代码改动量，不得仅因代码改动超过 200 行而要求拆分任务或拒绝任务。"],
  ["AC-3：预估 500 行、实际 600 行", "其余任务要求均满足且任务文件需计数内容为 200 行时，预估修改 500 行代码、实际修改 600 行代码，在规划和完成核对时均满足任务文件行数要求。"],
] as const;

const FORBIDDEN_STATEMENTS = [
  "不含成品代码块不超过 200 行",
  "预估改动不超过 200 行",
  "正文不超过 200 行",
  "正文 ≤ 200 行",
  "实际改动不超过 200 行",
  "代码改动量不超过 200 行",
] as const;

const COUNTING_REFERENCE = "任务文件行数按本文件上述完整计数口径核对";

// 验证公开指令文本，不模拟或自动执行任务文件行数统计。
describe("任务文件行数限制：任务格式说明与规划指令", () => {
  for (const [entry, path] of [
    ["spec-docs 任务格式说明", SPEC_DOCS_PATH],
    ["planner 规划指令", PLANNER_PATH],
  ] as const) {
    describe(entry, () => {
      for (const [label, statement] of REQUIRED_STATEMENTS) {
        test(`必需句 ${label}`, async () => {
          const instruction = await readFile(path, "utf8");
          expect(instruction, `${entry} 必须明确：${statement}`).toContain(statement);
        });
      }

      for (const statement of FORBIDDEN_STATEMENTS) {
        test(`禁止句：${statement}`, async () => {
          const instruction = await readFile(path, "utf8");
          expect(instruction, `${entry} 全文不得包含：${statement}`).not.toContain(statement);
        });
      }
    });
  }

  test("AC-1、AC-2、AC-3：spec-docs 竖切片约束引用完整计数口径", async () => {
    const instruction = await readFile(SPEC_DOCS_PATH, "utf8");
    const verticalSlice = instruction
      .split("\n\n")
      .find((paragraph) => paragraph.startsWith("一个任务是一个竖切片："));

    expect(verticalSlice ?? "", "竖切片约束段落不得遗漏完整口径引用").toContain(COUNTING_REFERENCE);
  });

  test("AC-1、AC-2、AC-3：planner 切片原则引用完整计数口径", async () => {
    const instruction = await readFile(PLANNER_PATH, "utf8");
    const slicingPrinciples = instruction.match(/切片原则：([\s\S]*?)(?=\n\d+\. |\n## |$)/u)?.[1];

    expect(slicingPrinciples ?? "", "切片原则局部不得遗漏完整口径引用").toContain(COUNTING_REFERENCE);
  });

  test("AC-1、AC-2、AC-3：planner 自检引用完整计数口径", async () => {
    const instruction = await readFile(PLANNER_PATH, "utf8");
    const selfCheck = instruction.match(/(?:^|\n)\d+\. 自检：[\s\S]*?(?=\n\n|\n\d+\. |$)/u)?.[0];

    expect(selfCheck ?? "", "自检段落不得遗漏完整口径引用").toContain(COUNTING_REFERENCE);
  });
});
