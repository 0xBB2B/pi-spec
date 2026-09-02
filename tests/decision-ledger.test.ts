import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createFixture as createSharedFixture, REQUIREMENT_SLUG, removeFixtures, requirementDocument, type Fixture } from "./helpers/requirement-fixture.ts";

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SPEC_DOCS_DIR = join(PACKAGE_ROOT, "skills", "spec-docs");
const WRITER_PATH = join(SPEC_DOCS_DIR, "scripts", "decision-ledger.ts");
const LINT_PATH = join(SPEC_DOCS_DIR, "scripts", "lint.sh");
const TEMPLATE_PATH = join(SPEC_DOCS_DIR, "requirements.template.md");
const SKILL_PATH = join(SPEC_DOCS_DIR, "SKILL.md");
const tempRoots: string[] = [];

afterEach(() => removeFixtures(tempRoots));

type DecisionId = `AI-${number}` | `USER-${number}`;
type Effect =
  | "behavior"
  | "scope"
  | "authorization"
  | "architecture"
  | "risk"
  | "recovery"
  | "flow-branch";

type DecisionInput = {
  requirementDir: string;
  actor: "ai" | "user";
  source: string;
  scope?: string;
  trigger: string;
  decision: string;
  basis?: string[];
  alternatives: string[];
  action?: string;
  impact?: string;
  supersedes?: DecisionId[];
  materiality: {
    alternativesExist: true;
    notUniquelyDetermined: true;
    effects: Effect[];
  };
};

type Receipt = {
  schema: "decision-receipt/v1";
  receiptId: string;
  decisionId: DecisionId;
  actor: "ai" | "user";
  requirementDir: string;
  ledgerPath: string;
  lineNumber: number;
  decisionHash: string;
  recordedAt: string;
};

type WriterApi = {
  appendDecision(input: DecisionInput): Promise<Receipt>;
  captureAcceptedFreeze(input: { requirementDir: string }): Promise<void>;
};

type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function jsonLine(value: object): string {
  return `${JSON.stringify(value)}\n`;
}

async function run(command: string[], cwd = PACKAGE_ROOT): Promise<CommandResult> {
  const child = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

function writerCli(...args: string[]): Promise<CommandResult> {
  return run(["bun", WRITER_PATH, ...args]);
}

function lint(requirements: string): Promise<CommandResult> {
  return run(["bash", LINT_PATH, requirements]);
}

async function initialize(fixture: Fixture): Promise<void> {
  const result = await writerCli("init", "--requirement-dir", fixture.requirementDir);
  expect(
    { exitCode: result.exitCode, stderr: result.stderr },
    "init must create both empty ledgers only for a new draft requirement package",
  ).toMatchObject({ exitCode: 0 });
}

async function writerApi(): Promise<WriterApi> {
  const candidate = (await import(WRITER_PATH)) as Partial<WriterApi>;
  expect(candidate.appendDecision, "writer must expose its direct append API for guarded decision_record").toBeTypeOf(
    "function",
  );
  expect(candidate.captureAcceptedFreeze, "writer must expose freeze capture for the accepted state transition").toBeTypeOf(
    "function",
  );
  return candidate as WriterApi;
}

function aiInput(fixture: Fixture, overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    requirementDir: fixture.requirementDir,
    actor: "ai",
    source: "decision-ledger-test",
    scope: "T-6",
    trigger: "存在两个可行修复路径",
    decision: "选择有界的规范化路径",
    basis: ["需求要求动作前形成单行决定"],
    alternatives: ["选择另一条修复路径"],
    action: "执行已选修复路径",
    materiality: {
      alternativesExist: true,
      notUniquelyDetermined: true,
      effects: ["architecture"],
    },
    ...overrides,
  } as DecisionInput;
}

function userInput(fixture: Fixture, overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    requirementDir: fixture.requirementDir,
    actor: "user",
    source: "decision-ledger-test",
    trigger: "用户主动给出范围取舍",
    decision: "仅授权当前任务范围",
    alternatives: [],
    impact: "后续动作仅可修改当前任务文件。",
    materiality: {
      alternativesExist: true,
      notUniquelyDetermined: true,
      effects: ["scope", "authorization"],
    },
    ...overrides,
  } as DecisionInput;
}

function canonicalAi(id: `AI-${number}`): Record<string, unknown> {
  return {
    id,
    recordedAt: "2026-09-01T00:00:00Z",
    actor: "ai",
    source: "fixture",
    requirement: REQUIREMENT_SLUG,
    scope: "T-6",
    trigger: "fixture trigger",
    decision: "fixture decision",
    basis: ["fixture basis"],
    alternatives: ["fixture alternative"],
    action: "fixture action",
  };
}

function canonicalUser(id: `USER-${number}`): Record<string, unknown> {
  return {
    id,
    recordedAt: "2026-09-01T00:00:00Z",
    actor: "user",
    source: "fixture",
    requirement: REQUIREMENT_SLUG,
    trigger: "fixture trigger",
    decision: "fixture decision",
    alternatives: [],
    impact: "fixture impact",
  };
}

async function lines(path: string): Promise<Record<string, unknown>[]> {
  const text = await readFile(path, "utf8");
  expect(text === "" || text.endsWith("\n"), `${path} must have a final newline when non-empty`).toBe(true);
  return text === "" ? [] : text.trimEnd().split("\n").map((line) => JSON.parse(line));
}

function numericId(id: unknown): number {
  const match = typeof id === "string" ? /^(?:AI|USER)-(\d+)$/.exec(id) : null;
  expect(id, "decision ids must use their actor prefix and a numeric suffix").toMatch(/^(?:AI|USER)-\d+$/);
  return Number(match?.[1]);
}

function expectStrictlyIncreasingIds(records: Record<string, unknown>[]): void {
  const ids = records.map((record) => numericId(record.id));
  for (let index = 1; index < ids.length; index += 1) {
    expect(ids[index]).toBeGreaterThan(ids[index - 1]);
  }
}

describe("canonical v1 decision ledger", () => {
  test("creates the requirement package only for a fresh draft and never overwrites a pre-existing ledger", async () => {
    const draft = await createSharedFixture(tempRoots, "draft");
    await initialize(draft);

    expect(await readFile(draft.ai, "utf8")).toBe("");
    expect(await readFile(draft.user, "utf8")).toBe("");
    expect((await readdir(draft.requirementDir)).sort()).toEqual([
      "acceptance.md",
      "ai-decisions.jsonl",
      "requirements.md",
      "tasks",
      "user-decisions.jsonl",
    ]);

    const confirmed = await createSharedFixture(tempRoots, "confirmed");
    const confirmedResult = await writerCli("init", "--requirement-dir", confirmed.requirementDir);
    expect(confirmedResult.exitCode, "init must reject a non-draft requirement").not.toBe(0);

    await writeFile(draft.ai, jsonLine(canonicalAi("AI-001")));
    const existingResult = await writerCli("init", "--requirement-dir", draft.requirementDir);
    expect(existingResult.exitCode, "init must never replace an existing ledger").not.toBe(0);
    expect(await readFile(draft.ai, "utf8")).toBe(jsonLine(canonicalAi("AI-001")));
  });

  test("accepts only complete material canonical decisions and appends exactly one closed-schema line", async () => {
    const fixture = await createSharedFixture(tempRoots);
    await initialize(fixture);
    const api = await writerApi();

    const aiReceipt = await api.appendDecision(aiInput(fixture));
    const userReceipt = await api.appendDecision(userInput(fixture));
    const [ai] = await lines(fixture.ai);
    const [user] = await lines(fixture.user);
    const aiText = await readFile(fixture.ai, "utf8");

    expect(Object.keys(ai).sort()).toEqual([
      "action",
      "actor",
      "alternatives",
      "basis",
      "decision",
      "id",
      "recordedAt",
      "requirement",
      "scope",
      "source",
      "trigger",
    ]);
    expect(Object.keys(user).sort()).toEqual([
      "actor",
      "alternatives",
      "decision",
      "id",
      "impact",
      "recordedAt",
      "requirement",
      "source",
      "trigger",
    ]);
    expect(ai).toMatchObject({ actor: "ai", requirement: REQUIREMENT_SLUG });
    expect(user).toMatchObject({ actor: "user", requirement: REQUIREMENT_SLUG });
    expect(ai.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
    expect(aiReceipt).toMatchObject({
      schema: "decision-receipt/v1",
      decisionId: ai.id,
      actor: "ai",
      requirementDir: fixture.requirementDir,
      ledgerPath: fixture.ai,
      lineNumber: 1,
      decisionHash: sha256(aiText),
      recordedAt: ai.recordedAt,
    });
    expect(userReceipt).toMatchObject({
      schema: "decision-receipt/v1",
      decisionId: user.id,
      actor: "user",
      requirementDir: fixture.requirementDir,
      ledgerPath: fixture.user,
      lineNumber: 1,
    });

    const originalAi = await readFile(fixture.ai, "utf8");
    for (const invalid of [
      aiInput(fixture, {
        materiality: {
          alternativesExist: false,
          notUniquelyDetermined: true,
          effects: ["architecture"],
        } as DecisionInput["materiality"],
      }),
      aiInput(fixture, {
        materiality: {
          alternativesExist: true,
          notUniquelyDetermined: false,
          effects: ["architecture"],
        } as DecisionInput["materiality"],
      }),
      aiInput(fixture, {
        materiality: {
          alternativesExist: true,
          notUniquelyDetermined: true,
          effects: [],
        },
      }),
      aiInput(fixture, { alternatives: ["重复", "重复"] }),
      {
        ...aiInput(fixture),
        unrecognized: "closed input schemas reject undeclared fields",
      } as unknown as DecisionInput,
    ]) {
      await expect(api.appendDecision(invalid)).rejects.toThrow();
      expect(await readFile(fixture.ai, "utf8")).toBe(originalAi);
    }
  });

  test("allocates monotonic ids across holes and permits only a new-to-earlier acyclic supersedes reference", async () => {
    const fixture = await createSharedFixture(tempRoots);
    await initialize(fixture);
    await writeFile(fixture.ai, `${jsonLine(canonicalAi("AI-001"))}${jsonLine(canonicalAi("AI-003"))}`);
    const api = await writerApi();

    const nextAi = await api.appendDecision(aiInput(fixture, { supersedes: ["AI-003"] }));
    expect(numericId(nextAi.decisionId), "new ids use the largest existing numeric suffix plus one").toBe(4);

    const nextUser = await api.appendDecision(
      userInput(fixture, { supersedes: [nextAi.decisionId] }),
    );
    const [,, appendedAi] = await lines(fixture.ai);
    expect(appendedAi.supersedes).toEqual(["AI-003"]);
    expect(appendedAi).not.toHaveProperty("supersededBy");
    expect((await lines(fixture.user))[0].supersedes).toEqual([nextAi.decisionId]);

    const before = `${await readFile(fixture.ai, "utf8")}\0${await readFile(fixture.user, "utf8")}`;
    await expect(
      api.appendDecision(userInput(fixture, { supersedes: [`USER-${numericId(nextUser.decisionId) + 1}`] })),
    ).rejects.toThrow();
    expect(`${await readFile(fixture.ai, "utf8")}\0${await readFile(fixture.user, "utf8")}`).toBe(before);
  });

  test("serializes concurrent appenders and validates both ledgers before a receipt is returned", async () => {
    const fixture = await createSharedFixture(tempRoots);
    await initialize(fixture);
    const api = await writerApi();

    const receipts = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        api.appendDecision(
          aiInput(fixture, {
            trigger: `并发决定 ${index}`,
            decision: `选择并发路径 ${index}`,
          }),
        ),
      ),
    );
    const records = await lines(fixture.ai);
    const validation = await writerCli("validate", "--requirement-dir", fixture.requirementDir);

    expect(receipts).toHaveLength(12);
    expect(new Set(receipts.map((receipt) => receipt.decisionId)).size).toBe(12);
    expect(records).toHaveLength(12);
    expectStrictlyIncreasingIds(records);
    expect(validation, "each successful append must leave both ledgers fully readable and canonical").toMatchObject({
      exitCode: 0,
    });
  });

  test("rejects malformed peer state before append, leaves no receipt for an associated action, and never repairs it by rewrite", async () => {
    const fixture = await createSharedFixture(tempRoots);
    await initialize(fixture);
    await writeFile(fixture.user, '{"id":"USER-001"\n');
    const api = await writerApi();
    const beforeAi = await readFile(fixture.ai, "utf8");
    let associatedActionCount = 0;

    try {
      const receipt = await api.appendDecision(aiInput(fixture));
      associatedActionCount += receipt.schema === "decision-receipt/v1" ? 1 : 0;
    } catch {
      // A failed record intentionally yields no receipt from which an action can proceed.
    }

    expect(associatedActionCount, "a record or JSONL validation failure must stop the associated action").toBe(0);
    expect(await readFile(fixture.ai, "utf8")).toBe(beforeAi);
    expect(await readFile(fixture.user, "utf8")).toBe('{"id":"USER-001"\n');
    const validation = await writerCli("validate", "--requirement-dir", fixture.requirementDir);
    expect(validation.exitCode, "validation must fail instead of normalizing a malformed existing ledger").not.toBe(0);
  });

  test("accepted requirements freeze contract, task files and acceptance while exactly one target-ledger line may append", async () => {
    const fixture = await createSharedFixture(tempRoots);
    await initialize(fixture);
    await writeFile(fixture.requirements, requirementDocument("accepted"));
    const api = await writerApi();
    await api.captureAcceptedFreeze({ requirementDir: fixture.requirementDir });

    const deliveryBefore = await Promise.all(
      [fixture.requirements, fixture.tasksIndex, fixture.acceptance].map((path) => readFile(path, "utf8")),
    );
    const userBefore = await readFile(fixture.user, "utf8");
    const aiBefore = await readFile(fixture.ai, "utf8");
    await api.appendDecision(aiInput(fixture));
    const aiAfter = await readFile(fixture.ai, "utf8");

    expect(aiAfter.startsWith(aiBefore), "the target ledger's old byte prefix must remain untouched").toBe(true);
    expect((await lines(fixture.ai)).length - (aiBefore === "" ? 0 : aiBefore.trimEnd().split("\n").length)).toBe(1);
    expect(await readFile(fixture.user, "utf8")).toBe(userBefore);
    expect(
      await Promise.all(
        [fixture.requirements, fixture.tasksIndex, fixture.acceptance].map((path) => readFile(path, "utf8")),
      ),
    ).toEqual(deliveryBefore);

    const failedPrefix = await readFile(fixture.ai, "utf8");
    await writeFile(join(fixture.tasksDir, "01-extra.md"), "# accepted 后新增的任务文件\n");
    await expect(api.appendDecision(aiInput(fixture, { decision: "新增任务文件不应绕过冻结" }))).rejects.toThrow();
    expect(await readFile(fixture.ai, "utf8")).toBe(failedPrefix);
    await writeFile(fixture.tasksIndex, "# 被篡改的 accepted 任务索引\n");
    await expect(api.appendDecision(aiInput(fixture, { decision: "不应绕过冻结" }))).rejects.toThrow();
    expect(await readFile(fixture.ai, "utf8")).toBe(failedPrefix);
  });

  test("requirements template, lint, and skill define only the seven-section current contract and the draft package", async () => {
    const [template, skill] = await Promise.all([Bun.file(TEMPLATE_PATH).text(), Bun.file(SKILL_PATH).text()]);
    const sections = [...template.matchAll(/^## (\d+)\./gm)].map(([, section]) => section);

    expect(sections).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(template).not.toMatch(/^## 8\./m);
    expect(template).not.toContain("决策记录");
    expect(skill, "the documented requirement package must include separate AI and user ledgers").toMatch(
      /ai-decisions\.jsonl[\s\S]{0,180}user-decisions\.jsonl/,
    );
    expect(skill, "requirements must remain only the current black-box contract").toMatch(
      /requirements\.md[\s\S]{0,220}(?:当前|有效)[\s\S]{0,180}黑盒契约/,
    );
    expect(skill, "draft resume must rediscover missing information from its current contents").toMatch(
      /draft[\s\S]{0,220}(?:当前内容|当前 draft)[\s\S]{0,220}(?:重新识别|重新澄清)[\s\S]{0,160}(?:缺失信息|缺失)/,
    );
    expect(skill, "accepted packages freeze deliveries and only permit ledger append").toMatch(
      /accepted[\s\S]{0,280}(?:requirements|契约)[\s\S]{0,280}(?:tasks|任务)[\s\S]{0,280}(?:acceptance|验收)[\s\S]{0,280}(?:仅|只)[\s\S]{0,180}(?:台账|ledger)[\s\S]{0,160}(?:追加|append)/,
    );
  });

  test("lint rejects an eighth decision section and incomplete R/AC coverage", async () => {
    const fixture = await createSharedFixture(tempRoots);
    await writeFile(fixture.ai, jsonLine(canonicalAi("AI-001")));
    await writeFile(fixture.user, jsonLine(canonicalUser("USER-001")));

    expect(await lint(fixture.requirements), "a complete seven-section canonical package must lint").toMatchObject({
      exitCode: 0,
    });
    await writeFile(fixture.requirements, `${requirementDocument()}\n## 8. 决策记录\n\n不应在需求中保存历史。\n`);
    expect(await lint(fixture.requirements), "lint must reject a decision-history section").not.toMatchObject({
      exitCode: 0,
    });

    await writeFile(fixture.requirements, requirementDocument().replace("← R-1", "← R-99"));
    expect(await lint(fixture.requirements), "lint must reject acceptance entries that do not cover a declared requirement").not.toMatchObject({
      exitCode: 0,
    });
  });

  test("lint and the writer reject legacy event/status records rather than parsing or rewriting them", async () => {
    const fixture = await createSharedFixture(tempRoots);
    await writeFile(
      fixture.ai,
      jsonLine({
        id: "AI-001",
        event: "decision-requested",
        status: "pending",
        requirement: REQUIREMENT_SLUG,
      }),
    );
    await writeFile(fixture.user, "");
    const legacyBytes = await readFile(fixture.ai, "utf8");

    expect(await lint(fixture.requirements), "lint must reject a legacy ledger in the requirement package").not.toMatchObject({
      exitCode: 0,
    });
    expect(
      await writerCli("validate", "--requirement-dir", fixture.requirementDir),
      "the canonical writer must reject legacy JSONL instead of accepting an old parser shape",
    ).not.toMatchObject({ exitCode: 0 });

    const api = await writerApi();
    await expect(api.appendDecision(aiInput(fixture))).rejects.toThrow();
    expect(await readFile(fixture.ai, "utf8")).toBe(legacyBytes);
  });
});
