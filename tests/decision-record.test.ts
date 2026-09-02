import { afterEach, describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import decisionRecordExtension from "../extensions/decision-record.ts";
import { initRequirementPackage } from "../skills/spec-docs/scripts/decision-ledger.ts";
import { createFixture, removeFixtures } from "./helpers/requirement-fixture.ts";

type Tool = {
  name: string;
  parameters: { required?: string[] };
  execute: (id: string, params: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[]; details: Record<string, unknown> }>;
};

const tempRoots: string[] = [];
afterEach(() => removeFixtures(tempRoots));

function loadTool(): Tool {
  const tools: Tool[] = [];
  const pi = { registerTool: (tool: Tool) => tools.push(tool), on: () => {} };
  decisionRecordExtension(pi as never);
  const tool = tools.find((candidate) => candidate.name === "decision_record");
  expect(tool, "extension must register decision_record").toBeDefined();
  return tool as Tool;
}

const aiParams = {
  actor: "ai",
  source: "spec-revise/attribution",
  scope: "R-1",
  trigger: "实际输出与规范例子不一致",
  decision: "归因为实现缺陷",
  basis: ["规范例子明确要求该输出"],
  alternatives: ["规范缺陷", "需求变更"],
  action: "把对应任务置回 todo 并进入执行",
  effects: ["flow-branch"],
};

const userParams = {
  actor: "user",
  source: "spec-flow/draft-confirm",
  trigger: "需求文档澄清完毕等待确认",
  decision: "确认需求进入规划",
  alternatives: [],
  impact: "需求进入 confirmed，允许 planner 产出设计与任务",
  effects: ["scope"],
};

describe("decision_record tool", () => {
  test("declares the closed parameter contract", () => {
    const tool = loadTool();
    expect(tool.parameters.required).toEqual(["requirementDir", "actor", "source", "trigger", "decision", "alternatives", "effects"]);
  });

  test("appends one AI line and returns a receipt matching the ledger", async () => {
    const fixture = await createFixture(tempRoots);
    await initRequirementPackage(fixture.requirementDir);
    const tool = loadTool();

    const result = await tool.execute("call-1", { ...aiParams, requirementDir: fixture.requirementDir });
    const aiText = await readFile(fixture.ai, "utf8");
    const [record] = aiText.trimEnd().split("\n").map((line) => JSON.parse(line));

    expect(result.details).toMatchObject({ schema: "decision-receipt/v1", decisionId: record.id, actor: "ai", ledgerPath: fixture.ai, lineNumber: 1 });
    expect(result.content[0].text).toContain(record.id);
    expect(record).toMatchObject({ actor: "ai", scope: "R-1", decision: "归因为实现缺陷" });
    expect(await readFile(fixture.user, "utf8")).toBe("");
  });

  test("appends a user line, treating null and empty optional fields as absent", async () => {
    const fixture = await createFixture(tempRoots);
    await initRequirementPackage(fixture.requirementDir);
    const tool = loadTool();

    await tool.execute("call-1", { ...userParams, requirementDir: fixture.requirementDir, scope: null, basis: null, action: null, supersedes: [] });
    const userLines = (await readFile(fixture.user, "utf8")).trimEnd().split("\n");
    expect(userLines).toHaveLength(1);
    expect(JSON.parse(userLines[0])).toMatchObject({ actor: "user", impact: userParams.impact });
    expect(await readFile(fixture.ai, "utf8")).toBe("");

    const before = await readFile(fixture.user, "utf8");
    await expect(
      tool.execute("call-2", { ...userParams, requirementDir: fixture.requirementDir, basis: ["用户不该带依据"] }),
    ).rejects.toThrow("用户决定不得携带 basis");
    await expect(
      tool.execute("call-3", { ...aiParams, requirementDir: fixture.requirementDir, impact: "AI 不该带影响" }),
    ).rejects.toThrow("AI 决定不得携带 impact");
    expect(await readFile(fixture.user, "utf8")).toBe(before);
    expect(await readFile(fixture.ai, "utf8")).toBe("");
  });

  test("fails without writing when a ledger is malformed", async () => {
    const fixture = await createFixture(tempRoots);
    await initRequirementPackage(fixture.requirementDir);
    await writeFile(fixture.user, '{"id":"USER-001"\n');
    const tool = loadTool();

    await expect(tool.execute("call-1", { ...aiParams, requirementDir: fixture.requirementDir })).rejects.toThrow();
    expect(await readFile(fixture.ai, "utf8")).toBe("");
    expect(await readFile(fixture.user, "utf8")).toBe('{"id":"USER-001"\n');
  });
});
