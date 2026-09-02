import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rm, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

type Actor = "ai" | "user";
type DecisionId = `AI-${number}` | `USER-${number}`;
type Effect =
  | "behavior"
  | "scope"
  | "authorization"
  | "architecture"
  | "risk"
  | "recovery"
  | "flow-branch";

export type DecisionInput = {
  requirementDir: string;
  actor: Actor;
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

export type DecisionReceipt = {
  schema: "decision-receipt/v1";
  receiptId: string;
  decisionId: DecisionId;
  actor: Actor;
  requirementDir: string;
  ledgerPath: string;
  lineNumber: number;
  decisionHash: string;
  recordedAt: string;
};

type DecisionRecord = Record<string, unknown> & {
  id: DecisionId;
  actor: Actor;
  recordedAt: string;
  requirement: string;
};

type PackagePaths = {
  requirementDir: string;
  slug: string;
  requirements: string;
  tasksDir: string;
  acceptance: string;
  ai: string;
  user: string;
  freeze: string;
};

type LedgerSnapshot = {
  path: string;
  actor: Actor;
  text: string;
  bytes: Buffer;
  records: DecisionRecord[];
};

type RequirementStatus = "draft" | "confirmed" | "planned" | "executing" | "accepting" | "accepted" | "rejected";

const EFFECTS = new Set<Effect>([
  "behavior",
  "scope",
  "authorization",
  "architecture",
  "risk",
  "recovery",
  "flow-branch",
]);
const AI_KEYS = [
  "id",
  "recordedAt",
  "actor",
  "source",
  "requirement",
  "scope",
  "trigger",
  "decision",
  "basis",
  "alternatives",
  "action",
  "supersedes",
];
const USER_KEYS = [
  "id",
  "recordedAt",
  "actor",
  "source",
  "requirement",
  "trigger",
  "decision",
  "alternatives",
  "impact",
  "supersedes",
];
const AI_INPUT_KEYS = [
  "requirementDir",
  "actor",
  "source",
  "scope",
  "trigger",
  "decision",
  "basis",
  "alternatives",
  "action",
  "supersedes",
  "materiality",
];
const USER_INPUT_KEYS = [
  "requirementDir",
  "actor",
  "source",
  "trigger",
  "decision",
  "alternatives",
  "impact",
  "supersedes",
  "materiality",
];
const DELIVERY_FILES = ["requirements.md", "acceptance.md"] as const;
const TASKS_DIR = "tasks";
const LOCK_TIMEOUT_MS = 10_000;
const LOCK_RETRY_MS = 5;

export class DecisionLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionLedgerError";
  }
}

function fail(message: string): never {
  throw new DecisionLedgerError(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertObject(value: unknown, context: string): asserts value is Record<string, unknown> {
  if (!isObject(value)) fail(`${context} must be a JSON object`);
}

function sameKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function assertExactKeys(value: Record<string, unknown>, expected: string[], context: string): void {
  if (!sameKeys(value, expected)) {
    fail(`${context} has a non-canonical field set`);
  }
}

function assertNonEmptyString(value: unknown, context: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") fail(`${context} must be a non-empty string`);
}

function assertUniqueStrings(value: unknown, context: string, minimum: number): asserts value is string[] {
  if (!Array.isArray(value) || value.length < minimum || !value.every((item) => typeof item === "string" && item.trim() !== "")) {
    fail(`${context} must contain at least ${minimum} non-empty strings`);
  }
  if (new Set(value).size !== value.length) fail(`${context} must not contain duplicate values`);
}

function assertDate(value: unknown, context: string): asserts value is string {
  assertNonEmptyString(value, context);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/.exec(value);
  const milliseconds = Date.parse(value);
  if (!match || !Number.isFinite(milliseconds)) fail(`${context} must be a valid UTC RFC3339 timestamp`);
  const date = new Date(milliseconds);
  const components = match.slice(1, 7).map(Number);
  if (
    date.getUTCFullYear() !== components[0] ||
    date.getUTCMonth() + 1 !== components[1] ||
    date.getUTCDate() !== components[2] ||
    date.getUTCHours() !== components[3] ||
    date.getUTCMinutes() !== components[4] ||
    date.getUTCSeconds() !== components[5]
  ) {
    fail(`${context} must be a valid UTC RFC3339 timestamp`);
  }
}

function decisionIdParts(value: unknown, context: string): { actor: Actor; number: number } {
  if (typeof value !== "string") fail(`${context} must be an AI-n or USER-n id`);
  const match = /^(AI|USER)-(\d+)$/.exec(value);
  if (!match) fail(`${context} must be an AI-n or USER-n id`);
  const numeric = Number(match[2]);
  if (!Number.isSafeInteger(numeric)) fail(`${context} has an unsafe numeric suffix`);
  return { actor: match[1] === "AI" ? "ai" : "user", number: numeric };
}

function assertDecisionId(value: unknown, context: string): asserts value is DecisionId {
  decisionIdParts(value, context);
}

function assertIdSequence(records: DecisionRecord[], actor: Actor, context: string): void {
  let previous = -1;
  for (const record of records) {
    const parts = decisionIdParts(record.id, `${context} id`);
    if (parts.actor !== actor || parts.number <= previous) {
      fail(`${context} ids must be strictly increasing for ${actor}`);
    }
    previous = parts.number;
  }
}

function assertRecord(record: unknown, actor: Actor, slug: string, context: string): asserts record is DecisionRecord {
  assertObject(record, context);
  const recordKeys = (actor === "ai" ? AI_KEYS : USER_KEYS).filter((key) => key !== "supersedes");
  if (Object.prototype.hasOwnProperty.call(record, "supersedes")) recordKeys.push("supersedes");
  assertExactKeys(record, recordKeys, context);
  const idParts = decisionIdParts(record.id, `${context}.id`);
  if (idParts.actor !== actor) fail(`${context}.id has the wrong actor prefix`);
  assertDate(record.recordedAt, `${context}.recordedAt`);
  if (record.actor !== actor) fail(`${context}.actor must be ${actor}`);
  assertNonEmptyString(record.source, `${context}.source`);
  if (record.requirement !== slug) fail(`${context}.requirement must equal the package slug`);
  assertNonEmptyString(record.trigger, `${context}.trigger`);
  assertNonEmptyString(record.decision, `${context}.decision`);
  assertUniqueStrings(record.alternatives, `${context}.alternatives`, actor === "ai" ? 1 : 0);

  if (actor === "ai") {
    assertNonEmptyString(record.scope, `${context}.scope`);
    assertUniqueStrings(record.basis, `${context}.basis`, 1);
    assertNonEmptyString(record.action, `${context}.action`);
  } else {
    assertNonEmptyString(record.impact, `${context}.impact`);
  }

  if ("supersedes" in record) {
    assertUniqueStrings(record.supersedes, `${context}.supersedes`, 0);
    for (const target of record.supersedes) assertDecisionId(target, `${context}.supersedes entry`);
  }
}

function validateGraph(ai: DecisionRecord[], user: DecisionRecord[], context: string): Map<string, DecisionRecord> {
  assertIdSequence(ai, "ai", `${context} AI ledger`);
  assertIdSequence(user, "user", `${context} user ledger`);
  const records = new Map<string, DecisionRecord>();
  for (const record of [...ai, ...user]) {
    if (records.has(record.id)) fail(`${context} contains a duplicate decision id`);
    records.set(record.id, record);
  }

  const edges = new Map<string, string[]>();
  for (const record of records.values()) {
    const references = (record.supersedes as DecisionId[] | undefined) ?? [];
    for (const target of references) {
      if (!records.has(target)) fail(`${context} supersedes references a missing earlier decision`);
      const targetParts = decisionIdParts(target, "supersedes target");
      const sourceParts = decisionIdParts(record.id, "decision id");
      if (targetParts.actor === sourceParts.actor && targetParts.number >= sourceParts.number) {
        fail(`${context} supersedes may only point to an earlier decision`);
      }
    }
    edges.set(record.id, references);
  }

  const colors = new Map<string, 0 | 1 | 2>();
  const visit = (id: string): void => {
    const color = colors.get(id) ?? 0;
    if (color === 1) fail(`${context} supersedes graph contains a cycle`);
    if (color === 2) return;
    colors.set(id, 1);
    for (const target of edges.get(id) ?? []) visit(target);
    colors.set(id, 2);
  };
  for (const id of records.keys()) visit(id);
  return records;
}

function packageSlug(requirementDir: string): string {
  const name = basename(requirementDir);
  const match = /^\d{4}-\d{2}-\d{2}\.([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(name);
  if (!match) fail("requirement directory must be named YYYY-MM-DD.<slug>");
  return match[1];
}

async function assertDirectory(path: string): Promise<void> {
  if (!path || !path.startsWith("/")) fail("requirementDir must be an absolute path");
  try {
    if (!(await stat(path)).isDirectory()) fail("requirementDir must be a directory");
  } catch {
    fail("requirementDir must be an existing directory");
  }
}

function pathsFor(requirementDir: string): PackagePaths {
  const absolute = resolve(requirementDir);
  const slug = packageSlug(absolute);
  return {
    requirementDir: absolute,
    slug,
    requirements: join(absolute, "requirements.md"),
    tasksDir: join(absolute, TASKS_DIR),
    acceptance: join(absolute, "acceptance.md"),
    ai: join(absolute, "ai-decisions.jsonl"),
    user: join(absolute, "user-decisions.jsonl"),
    freeze: join(absolute, ".accepted-freeze.json"),
  };
}

async function assertRegularFile(path: string, context: string): Promise<void> {
  try {
    if (!(await stat(path)).isFile()) fail(`${context} must be a regular file`);
  } catch {
    fail(`${context} is missing`);
  }
}

async function packageStatus(paths: PackagePaths): Promise<RequirementStatus> {
  await assertRegularFile(paths.requirements, "requirements.md");
  const text = await readFile(paths.requirements, "utf8");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!match) fail("requirements.md must have a frontmatter block");
  const statuses = match[1].split("\n").filter((line) => /^status:\s*/.test(line));
  if (statuses.length !== 1) fail("requirements.md must declare exactly one status");
  const status = statuses[0].replace(/^status:\s*/, "").trim() as RequirementStatus;
  if (!["draft", "confirmed", "planned", "executing", "accepting", "accepted", "rejected"].includes(status)) {
    fail("requirements.md has an invalid status");
  }
  return status;
}

async function assertDeliveryPackage(paths: PackagePaths): Promise<void> {
  for (const name of DELIVERY_FILES) await assertRegularFile(join(paths.requirementDir, name), name);
  try {
    if (!(await stat(paths.tasksDir)).isDirectory()) fail(`${TASKS_DIR} must be a directory`);
  } catch (error) {
    if (error instanceof DecisionLedgerError) throw error;
    fail(`${TASKS_DIR} directory is missing`);
  }
}

async function listDeliveryFiles(paths: PackagePaths): Promise<string[]> {
  const files: string[] = [...DELIVERY_FILES];
  const walk = async (dir: string, prefix: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) await walk(join(dir, entry.name), relative);
      else if (entry.isFile()) files.push(relative);
      else fail(`${relative} must be a regular file or directory`);
    }
  };
  await walk(paths.tasksDir, TASKS_DIR);
  return files.sort();
}

function parseLedgerText(bytes: Buffer, path: string, actor: Actor, slug: string): LedgerSnapshot {
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) fail(`${path} is not valid UTF-8`);
  if (text === "") return { path, actor, text, bytes, records: [] };
  if (!text.endsWith("\n") || text.includes("\r")) fail(`${path} must be JSONL with LF line endings`);
  const body = text.slice(0, -1);
  const lines = body.split("\n");
  if (lines.some((line) => line.length === 0)) fail(`${path} must not contain blank JSONL lines`);
  const records: DecisionRecord[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    let value: unknown;
    try {
      value = JSON.parse(lines[index]);
    } catch {
      fail(`${path}:${index + 1} is not valid JSON`);
    }
    assertRecord(value, actor, slug, `${path}:${index + 1}`);
    if (JSON.stringify(value) !== lines[index]) fail(`${path}:${index + 1} is not canonical JSON`);
    records.push(value);
  }
  return { path, actor, text, bytes, records };
}

async function readLedger(path: string, actor: Actor, slug: string): Promise<LedgerSnapshot> {
  await assertRegularFile(path, path);
  return parseLedgerText(await readFile(path), path, actor, slug);
}

async function readLedgers(paths: PackagePaths): Promise<{ ai: LedgerSnapshot; user: LedgerSnapshot; records: Map<string, DecisionRecord> }> {
  const [ai, user] = await Promise.all([
    readLedger(paths.ai, "ai", paths.slug),
    readLedger(paths.user, "user", paths.slug),
  ]);
  const records = validateGraph(ai.records, user.records, paths.requirementDir);
  return { ai, user, records };
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function assertAcceptedFreeze(paths: PackagePaths): Promise<void> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(paths.freeze, "utf8"));
  } catch {
    fail("accepted package freeze manifest is missing or invalid");
  }
  assertObject(value, "accepted freeze manifest");
  assertExactKeys(value, ["schema", "requirementDir", "files", "capturedAt"], "accepted freeze manifest");
  if (value.schema !== "accepted-freeze/v1" || value.requirementDir !== paths.requirementDir) {
    fail("accepted freeze manifest does not match this package");
  }
  assertDate(value.capturedAt, "accepted freeze capturedAt");
  assertObject(value.files, "accepted freeze files");
  const deliveryFiles = await listDeliveryFiles(paths);
  assertExactKeys(value.files, deliveryFiles, "accepted freeze files");
  for (const name of deliveryFiles) {
    if (typeof value.files[name] !== "string" || !/^[0-9a-f]{64}$/.test(value.files[name] as string)) {
      fail(`accepted freeze hash for ${name} is invalid`);
    }
    const bytes = await readFile(join(paths.requirementDir, name));
    if (sha256(bytes) !== value.files[name]) fail(`accepted delivery ${name} has changed`);
  }
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function withRequirementLock<T>(requirementDir: string, operation: () => Promise<T>): Promise<T> {
  const lock = join(requirementDir, ".decision-ledger.lock");
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let acquired = false;
  while (!acquired) {
    try {
      await mkdir(lock);
      acquired = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" || Date.now() >= deadline) {
        fail("could not acquire the requirement ledger lock");
      }
      await sleep(LOCK_RETRY_MS);
    }
  }
  try {
    return await operation();
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}

function validateMateriality(value: unknown): asserts value is DecisionInput["materiality"] {
  assertObject(value, "materiality");
  assertExactKeys(value, ["alternativesExist", "notUniquelyDetermined", "effects"], "materiality");
  if (value.alternativesExist !== true || value.notUniquelyDetermined !== true) {
    fail("materiality must establish alternatives and non-unique determination");
  }
  assertUniqueStrings(value.effects, "materiality.effects", 1);
  if (!(value.effects as string[]).every((effect) => EFFECTS.has(effect as Effect))) {
    fail("materiality.effects contains an unsupported effect");
  }
}

function validateDecisionInput(input: unknown, paths: PackagePaths): asserts input is DecisionInput {
  assertObject(input, "decision input");
  const actor = input.actor;
  if (actor !== "ai" && actor !== "user") fail("decision input actor must be ai or user");
  const inputKeys = Object.keys(input);
  const allowedKeys = (actor === "ai" ? AI_INPUT_KEYS : USER_INPUT_KEYS).filter(
    (key) => key !== "supersedes",
  );
  if (inputKeys.includes("supersedes")) allowedKeys.push("supersedes");
  assertExactKeys(input, allowedKeys, "decision input");
  if (input.requirementDir !== paths.requirementDir) fail("decision input requirementDir must identify this package");
  assertNonEmptyString(input.source, "decision input.source");
  assertNonEmptyString(input.trigger, "decision input.trigger");
  assertNonEmptyString(input.decision, "decision input.decision");
  validateMateriality(input.materiality);
  assertUniqueStrings(input.alternatives, "decision input.alternatives", actor === "ai" ? 1 : 0);

  if (actor === "ai") {
    assertNonEmptyString(input.scope, "decision input.scope");
    assertUniqueStrings(input.basis, "decision input.basis", 1);
    assertNonEmptyString(input.action, "decision input.action");
  } else {
    assertNonEmptyString(input.impact, "decision input.impact");
  }
  if ("supersedes" in input) {
    assertUniqueStrings(input.supersedes, "decision input.supersedes", 0);
    for (const target of input.supersedes) assertDecisionId(target, "decision input.supersedes entry");
  }
}

function nextId(records: DecisionRecord[], actor: Actor): DecisionId {
  let maximum = 0;
  for (const record of records) {
    const parts = decisionIdParts(record.id, "existing decision id");
    if (parts.actor === actor) maximum = Math.max(maximum, parts.number);
  }
  const suffix = String(maximum + 1).padStart(3, "0");
  return `${actor === "ai" ? "AI" : "USER"}-${suffix}` as DecisionId;
}

function buildRecord(input: DecisionInput, paths: PackagePaths, id: DecisionId, recordedAt: string): DecisionRecord {
  const record: Record<string, unknown> = {
    id,
    recordedAt,
    actor: input.actor,
    source: input.source,
    requirement: paths.slug,
    trigger: input.trigger,
    decision: input.decision,
  };
  if (input.actor === "ai") {
    record.scope = input.scope;
    record.basis = input.basis;
    record.alternatives = input.alternatives;
    record.action = input.action;
  } else {
    record.alternatives = input.alternatives;
    record.impact = input.impact;
  }
  if (input.supersedes !== undefined) record.supersedes = input.supersedes;
  return record as DecisionRecord;
}

async function appendLine(path: string, line: string): Promise<void> {
  const handle = await open(path, "a");
  try {
    const result = await handle.write(line, undefined, "utf8");
    if (result.bytesWritten !== Buffer.byteLength(line, "utf8")) fail("ledger append was incomplete");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function appendDecision(input: DecisionInput): Promise<DecisionReceipt> {
  if (!isObject(input) || typeof input.requirementDir !== "string") fail("decision input must include an absolute requirementDir");
  await assertDirectory(input.requirementDir);
  const paths = pathsFor(input.requirementDir);
  return withRequirementLock(paths.requirementDir, async () => {
    await assertDeliveryPackage(paths);
    const status = await packageStatus(paths);
    const before = await readLedgers(paths);
    if (status === "accepted") await assertAcceptedFreeze(paths);
    validateDecisionInput(input, paths);

    const id = nextId(input.actor === "ai" ? before.ai.records : before.user.records, input.actor);
    const recordedAt = new Date().toISOString();
    const record = buildRecord(input, paths, id, recordedAt);
    assertRecord(record, input.actor, paths.slug, "new decision");
    const references = (record.supersedes as DecisionId[] | undefined) ?? [];
    for (const target of references) {
      if (!before.records.has(target)) fail("supersedes may only point to an already existing decision");
    }
    const combinedAi = input.actor === "ai" ? [...before.ai.records, record] : before.ai.records;
    const combinedUser = input.actor === "user" ? [...before.user.records, record] : before.user.records;
    validateGraph(combinedAi, combinedUser, "candidate package");

    const line = `${JSON.stringify(record)}\n`;
    const targetPath = input.actor === "ai" ? paths.ai : paths.user;
    await appendLine(targetPath, line);

    const after = await readLedgers(paths);
    const targetBefore = input.actor === "ai" ? before.ai : before.user;
    const targetAfter = input.actor === "ai" ? after.ai : after.user;
    const expectedAfter = Buffer.concat([targetBefore.bytes, Buffer.from(line)]);
    if (!targetAfter.bytes.equals(expectedAfter)) fail("ledger append changed bytes outside the new line");
    if (!after.records.has(id)) fail("written decision could not be re-read");
    if (status === "accepted") await assertAcceptedFreeze(paths);

    return {
      schema: "decision-receipt/v1",
      receiptId: randomUUID(),
      decisionId: id,
      actor: input.actor,
      requirementDir: paths.requirementDir,
      ledgerPath: targetPath,
      lineNumber: targetAfter.records.length,
      decisionHash: sha256(Buffer.from(line)),
      recordedAt,
    };
  });
}

export async function validateRequirement(requirementDir: string): Promise<void> {
  await assertDirectory(requirementDir);
  const paths = pathsFor(requirementDir);
  await withRequirementLock(paths.requirementDir, async () => {
    await assertDeliveryPackage(paths);
    const status = await packageStatus(paths);
    await readLedgers(paths);
    if (status === "accepted") await assertAcceptedFreeze(paths);
  });
}

export async function initRequirementPackage(requirementDir: string): Promise<void> {
  await assertDirectory(requirementDir);
  const paths = pathsFor(requirementDir);
  await withRequirementLock(paths.requirementDir, async () => {
    await assertDeliveryPackage(paths);
    const status = await packageStatus(paths);
    if (status !== "draft") fail("init only accepts a draft requirement package");
    for (const path of [paths.ai, paths.user]) {
      try {
        await stat(path);
        fail("init never overwrites a pre-existing ledger");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") fail("could not inspect the decision ledger");
      }
    }

    const created: string[] = [];
    try {
      for (const path of [paths.ai, paths.user]) {
        const handle = await open(path, "wx");
        await handle.close();
        created.push(path);
      }
    } catch (error) {
      for (const path of created) await rm(path, { force: true });
      if ((error as NodeJS.ErrnoException).code === "EEXIST") fail("init never overwrites a pre-existing ledger");
      throw error;
    }
  });
}

export async function captureAcceptedFreeze(input: { requirementDir: string }): Promise<void> {
  if (!isObject(input) || typeof input.requirementDir !== "string") fail("freeze input must include requirementDir");
  await assertDirectory(input.requirementDir);
  const paths = pathsFor(input.requirementDir);
  await withRequirementLock(paths.requirementDir, async () => {
    await assertDeliveryPackage(paths);
    const status = await packageStatus(paths);
    if (status !== "accepted") fail("accepted freeze can only be captured for an accepted package");
    const hashes: Record<string, string> = {};
    for (const name of await listDeliveryFiles(paths)) hashes[name] = sha256(await readFile(join(paths.requirementDir, name)));
    const manifest = {
      schema: "accepted-freeze/v1",
      requirementDir: paths.requirementDir,
      files: hashes,
      capturedAt: new Date().toISOString(),
    };
    try {
      await readFile(paths.freeze, "utf8");
      await assertAcceptedFreeze(paths);
      return;
    } catch (error) {
      if (error instanceof DecisionLedgerError) throw error;
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") fail("accepted freeze manifest is unreadable");
    }
    const handle = await open(paths.freeze, "wx");
    try {
      const text = `${JSON.stringify(manifest)}\n`;
      await handle.write(text, undefined, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await assertAcceptedFreeze(paths);
  });
}

export async function inspectDecision(requirementDir: string, id: string): Promise<DecisionRecord> {
  await assertDirectory(requirementDir);
  const paths = pathsFor(requirementDir);
  assertDecisionId(id, "inspect id");
  return withRequirementLock(paths.requirementDir, async () => {
    await assertDeliveryPackage(paths);
    const status = await packageStatus(paths);
    const ledgers = await readLedgers(paths);
    if (status === "accepted") await assertAcceptedFreeze(paths);
    const record = ledgers.records.get(id);
    if (!record) fail("decision id was not found");
    return record;
  });
}

function usage(): never {
  fail("usage: decision-ledger.ts init|validate --requirement-dir <absolute-dir> [--id <AI-n|USER-n>]");
}

function option(args: string[], name: string): string {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith("--")) usage();
  return args[index + 1];
}

async function cli(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args.shift();
  if (!command || !["init", "validate", "inspect"].includes(command)) usage();
  const requirementDir = option(args, "--requirement-dir");
  if (command === "init") {
    await initRequirementPackage(requirementDir);
    console.log("PASS");
    return;
  }
  if (command === "validate") {
    await validateRequirement(requirementDir);
    console.log("PASS");
    return;
  }
  const id = option(args, "--id");
  const record = await inspectDecision(requirementDir, id);
  console.log(JSON.stringify(record));
}

if (import.meta.main) {
  cli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  });
}
