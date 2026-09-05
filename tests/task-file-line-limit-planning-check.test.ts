import { beforeAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FLOW_PATH = join(PACKAGE_ROOT, "skills", "spec-flow", "SKILL.md");

let flow: string;
let planning: string;

beforeAll(async () => {
  flow = await readFile(FLOW_PATH, "utf8");
  const start = flow.indexOf("## 阶段二：confirmed → planned");
  const end = flow.indexOf("## 阶段三：planned → executing", start);

  expect(start, "spec-flow must document its planning stage").toBeGreaterThanOrEqual(0);
  expect(end, "the planning stage must end before executing preparation").toBeGreaterThan(start);
  planning = flow.slice(start, end);
});

describe("规划核对：任务文件行数限制", () => {
  test.each([
    [
      "C-1、AC-1：限制对象是每份任务文件而非代码改动量",
      "每份任务文件扣除示例代码块与成品代码块后最多 200 行，不限制任务的代码改动量。",
    ],
    [
      "C-2、AC-1：整份文件独立统计，包含元数据、分隔行、标题、正文和空行",
      "按整份文件统计物理行，计入 frontmatter 元数据及其分隔行、标题、正文和空行，每份文件独立计算。",
    ],
    [
      "C-3、AC-2：两类代码块及首尾围栏均豁免，其余内容计数",
      "示例代码块与成品代码块的全部内容及首尾围栏不计数，除此之外的内容均正常计数。",
    ],
    [
      "C-4、AC-1：200 行满足要求，超过 200 行报告超限",
      "计数恰为 200 行时满足行数要求，超过 200 行时报告任务文件超过 200 行。",
    ],
    [
      "C-2、C-4、AC-1：新增元数据、标题或空行均使 200 行变为 201 行",
      "在 200 行需计数内容之外新增一行元数据、一个标题或一个空行，均变为 201 行并报告任务文件超限。",
    ],
    [
      "C-3、C-4、AC-2：102 行代码块单独及组合豁免，块外新增一行超限",
      "在 200 行需计数内容之外，添加连同围栏共 102 行的示例代码块、成品代码块或同时添加两者，仍为 200 行；在代码块外再新增一行说明文字则为 201 行并报告任务文件超限。",
    ],
    [
      "C-5、AC-3：不得因预估或实际代码改动量超过 200 行拆分或拒绝任务",
      "不限制预估或实际代码改动量，不得仅因代码改动超过 200 行而要求拆分任务或拒绝任务。",
    ],
    [
      "C-5、AC-3：200 行任务文件预估改动 500 行、实际改动 600 行均满足要求",
      "其余任务要求均满足且任务文件需计数内容为 200 行时，预估修改 500 行代码、实际修改 600 行代码，在规划和完成核对时均满足任务文件行数要求。",
    ],
  ])("阶段二必需句：%s", (_ref, sentence) => {
    expect(planning).toContain(sentence);
  });

  test.each([
    "每任务生产文件 ≤ 2 且 refs ≤ 3",
    "业务规则与验证方式非空",
    "无两个任务共享生产文件",
    "files 不相交才 parallel",
    "本次新增或修改规则文件的验收全覆盖",
    "depends_on 只向前",
    "INDEX.md 列全",
    "不满足则带具体违规项重派",
  ])("阶段二既定核对项或失败处理：%s", (sentence) => {
    expect(planning).toContain(sentence);
  });

  test.each([
    "正文 ≤ 200 行",
    "正文不超过 200 行",
    "不含成品代码块不超过 200 行",
    "预估改动不超过 200 行",
    "实际改动不超过 200 行",
    "代码改动量不超过 200 行",
  ])("全文禁止句（包括长句内残存）：%s", (sentence) => {
    expect(flow).not.toContain(sentence);
  });
});
