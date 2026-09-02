---
name: spec-flow
description: 需求全生命周期流程——澄清需求 → 黑盒需求文档经用户确认 → planner 产出一任务一文件的任务集 → 按依赖并发派工 test-engineer/impl-engineer/review-engineer → acceptance-reviewer 黑盒验收；status、结构化 TDD 门禁与安全续接规则。用户提出全新功能或需求（无对应需求文档）时加载；/spec-new 与 /spec-resume 为强制入口；只由主 agent 加载。
---

# spec-flow：需求生命周期

文件格式一律遵循 spec-docs skill，本 skill 只定流程。所有确认动作使用 `ask_user_question` 工具。

检索规则：系统现行行为一律以 `.pi-spec/spec/` 为准；`.pi-spec/requirements/` 下只读当前进行中的那个目录，其余目录禁止读取。

## 角色

| 角色 | 产出 | 派工方式 |
|---|---|---|
| 主 agent（你） | requirements.md、任务文件的运行字段、commit | — |
| planner | tasks/INDEX.md 与 tasks/NN-<name>.md | 直接 Agent 工具；planner 是 StructuredOutput 门禁的例外 |
| test-engineer | 结构化 Test 证据 | 每任务一个 SubagentWorkflow 的 `agent(..., { agentType, schema })` |
| impl-engineer | 结构化 Impl 证据 | 同一 SubagentWorkflow 串行调用 |
| review-engineer | 结构化 Review 证据 | 同一 SubagentWorkflow 串行调用 |
| acceptance-reviewer | acceptance.md 与结构化验收结果 | 专用验收流程 |
| pre-reviewer | 结构化提交前审查结果 | 专用提交前审查流程 |

test-engineer、impl-engineer、review-engineer 仅三个 TDD 角色使用带 Schema 的 `SubagentWorkflow` 结构化对象作为门禁；planner 继续直接 Agent 调用，是不纳入 StructuredOutput 门禁的规划例外。StructuredOutput 的 verdict 只能是 PASS 或 FAIL。TDD 门禁不得以直接 Agent、文本 JSON、Markdown、首行或正则解析放行。

## 状态机

```
draft ─用户确认需求─▶ confirmed ─planner 完成─▶ planned ─并行组计算完成─▶ executing ─全部 done─▶ accepting ─▶ accepted | rejected
```

`status` 只存在 requirements.md frontmatter 一处，只由主 agent 在门禁处推进。

## 阶段一：draft

1. 新需求：读取 `.pi-spec/spec/` 中相关功能域文件作为现状（不存在即现状为空）；按 `<YYYY-MM-DD>.<slug>` 建目录，复制模板落盘，`status: draft`，建立 `tasks/INDEX.md` 与 `acceptance.md` 占位后运行 spec-docs 的 `init`；确保 `.pi-spec/.cache/.gitignore` 存在。
2. 按递进式澄清逐维度提问。用户在给出的具体选项中作出选择时，先调用 `decision_record`（actor user，impact 写该选择对需求的约束）再写盘；AI 按项目惯例自行决定内部取向时调用 `decision_record`（actor ai）。未回答、忽略或取消的问题不记录。**每收口一个维度立即写盘**：更新对应章节。
3. 没有未收口的维度、每条 R 有 AC 覆盖、lint PASS 后，请求用户确认：只给出文件路径和本轮变更摘要（改动了哪些章节、R、AC 各一句话），不在对话中回显文档正文，用户自行打开文件核对。
4. 用户确认 → 调用 `decision_record`（actor user，source `spec-flow/draft-confirm`，impact 为需求进入 confirmed 并允许规划）；记录成功后 `status: confirmed`，建分支（分支名 = slug，按项目 git 惯例），commit。记录失败则停止，状态保持 draft。

## 阶段二：confirmed → planned

派 planner，任务提示只含：requirements.md 路径、仓库根路径。planner 报告需求超限并给出拆分建议时，不进入 planned：把需求退回 `draft`，按拆分建议与用户确认后拆成多个需求目录，各自重新确认。planner 返回后核对 `tasks/` 满足 spec-docs 约束（每任务生产文件 ≤ 2 且 AC ≤ 3、正文 ≤ 200 行且业务规则与验证方式非空、无两个任务共享生产文件、files 不相交才 parallel、AC 全覆盖、depends_on 只向前、INDEX.md 列全），不满足则带具体违规项重派。通过 → `status: planned`，commit。

## 阶段三：planned → executing

按下面的调度规则算出全部并行组，向用户汇报“组 → 任务 → 触碰文件”后不等待回复，直接 `status: executing` 并开始派工；进入执行是固定状态转换，不记录决定。只有下列情况停下用 `ask_user_question` 请用户裁决：planner 报告新增第三方依赖（用户同意后以 `decision_record` 记为用户决定再进入执行）、planner 报告歧义与阻塞、或带违规项重派两次后 `tasks/` 仍不满足 spec-docs 约束。

## 阶段四：executing

### 调度

- 就绪任务 = `status: todo` 且 `depends_on` 全为 `done`。
- 并行组 = 就绪任务中 `parallel: true` 且 `files` 两两不相交的子集，一次并发派出；其余串行。
- 任一任务 `failed` → 停止派新任务，向用户报告原因并等待裁决；不自动重试。
- 任何 TDD 任务必须使用一个独立的 SubagentWorkflow，严格串行 `test-engineer → impl-engineer → review-engineer`；后一阶段不得在前一阶段可信完成前启动，三个阶段不得重叠或跳过。
- 并行 T-n 任务必须分别、各自独立创建一个 SubagentWorkflow，形成多个同级 workflow；每个 workflow 的标题由任务的 `meta.name` 提供，各自产生 workflow run id，并分别记录在对应任务文件 frontmatter 的 `agent`；不得把多个任务合并或包裹到同一个 SubagentWorkflow。

### 单任务状态与写盘顺序

写盘顺序是续接正确性的前提，不得调换：每任务固定执行 `test → impl → review → 结构化 PASS → verify → commit/done`。每次阶段切换先写入新的 `step`、清空 `agent`，再启动 workflow 对应阶段；任务文件的 `agent` 记录 workflow run id，而不是报告对象。workflow 精确阶段由 progress/journal 表示。

1. 写 `status: doing`、`step: test`，清空 `agent`，再启动 TDD SubagentWorkflow。只有结构化 Test PASS 才能进入 impl。
2. 可信 Red 或可信 Green baseline PASS 后写 `step: impl`，清空 `agent`，在同一 workflow 中调用 impl-engineer。baseline 必须走 `no-change-review`，不得跳过 test、impl、review；测试全绿不得自动或直接视为可信 Green baseline。
3. 结构化 Impl PASS 后写 `step: review`，清空 `agent`，在同一 workflow 中调用 review-engineer。只有结构化 Review `verdict: PASS`、`verifyReady: true`、路径一致且 traceability/evidence 非空，才是明确 PASS。
4. review-engineer 只有返回结构化明确 PASS，才运行 `verify`；verify 退出码非 0、代理失败或证据不足 → `status: failed`、`step: review`、`note: <简短原因>`。
5. 只有 verify 退出码为 0 后才按 git-commit skill 提交，message 含 `T-n`；有提交时写 `commit`，再写 `status: done`，并将 `step` 保持为 `review`。

派工提示只需给出任务文件路径，不再摘录拼贴：test-engineer 读该文件的业务规则与验证方式块，并额外收到“只改测试”；impl-engineer 读涉及文件、成品定义、新增第三方依赖、函数清单、协作关系块，并额外收到 Test 结构化证据与失败测试；review-engineer 读整份任务文件，并额外收到实际 diff、Test/Impl 结构化证据和 verify 命令及证据。

所有 Schema 缺失、workflow 返回 null/空结果、非法输出或校验失败、phase/专用字段矛盾或不一致均记录为 FAIL。上述 FAIL、没有明确 PASS、代理失败、证据不足等非 PASS 结果均写为 `status: failed` 与 `note: <简短原因>`，停止派发新任务和 acceptance；不自动重试或返修。Review 失败后不得派发后续阶段，停止派发并阻断 accepting/黑盒验收。不得使用 JSON.parse、正则、首行、文本 JSON、Markdown 或 summary/evidence 中的 PASS/PASS 子串推断裁决。

### TDD 内联 Schema 与语义谓词

每个 TDD 任务使用一个 SubagentWorkflow，内联下面三个严格 Schema；Schema 是普通 JavaScript 对象，不写成仓库中的 schema 文件。所有 schema 均 `additionalProperties: false`，统一 `phase`、`verdict`、`summary`、`issues`、`evidence`，并用 `oneOf` 表达 PASS/FAIL 语义。

```javascript
const text = { type: "string", minLength: 1 }
const strings = { type: "array", items: text }
const evidence = { type: "array", minItems: 1, items: text }
const commandItems = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["command", "status", "details"],
    properties: { command: text, status: { enum: ["PASS", "FAIL"] }, details: text },
  },
}
const coverageItems = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["ref", "test"],
    properties: { ref: text, test: text },
  },
}
const common = {
  verdict: { enum: ["PASS", "FAIL"] },
  summary: text,
  issues: strings,
  evidence,
}

const TEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["phase", "verdict", "summary", "issues", "evidence", "changeKind", "testState", "coverage", "commands", "productionPath", "preexistingEvidence", "fakeRed"],
  properties: {
    ...common,
    verdict: { enum: ["PASS", "FAIL"] },
    phase: { const: "test" },
    changeKind: { enum: ["behavior-change", "refactor", "unclear"] },
    testState: { enum: ["red", "green-baseline", "blocked"] },
    coverage: coverageItems,
    commands: commandItems,
    productionPath: strings,
    preexistingEvidence: strings,
    fakeRed: { const: false },
  },
  oneOf: [
    { properties: { verdict: { const: "PASS" }, issues: { type: "array", maxItems: 0, items: text }, testState: { const: "red" }, coverage: { ...coverageItems, minItems: 1 }, commands: { ...commandItems, minItems: 1 } } },
    { properties: { verdict: { const: "PASS" }, issues: { type: "array", maxItems: 0, items: text }, testState: { const: "green-baseline" }, coverage: { ...coverageItems, minItems: 1 }, commands: { ...commandItems, minItems: 1 }, productionPath: { type: "array", minItems: 1, items: text }, preexistingEvidence: { type: "array", minItems: 1, items: text } } },
    { properties: { verdict: { const: "FAIL" }, issues: { type: "array", minItems: 1, items: text }, testState: { const: "blocked" } } },
  ],
}

const IMPL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["phase", "verdict", "summary", "issues", "evidence", "implementationStatus", "coverage", "commands", "changedFiles"],
  properties: {
    ...common,
    verdict: { enum: ["PASS", "FAIL"] },
    phase: { const: "impl" },
    implementationStatus: { enum: ["green", "no-change-review", "blocked"] },
    coverage: coverageItems,
    commands: commandItems,
    changedFiles: strings,
  },
  oneOf: [
    { properties: { verdict: { const: "PASS" }, issues: { type: "array", maxItems: 0, items: text }, implementationStatus: { const: "green" }, coverage: { ...coverageItems, minItems: 1 }, commands: { ...commandItems, minItems: 1 } } },
    { properties: { verdict: { const: "PASS" }, issues: { type: "array", maxItems: 0, items: text }, implementationStatus: { const: "no-change-review" }, coverage: { ...coverageItems, minItems: 1 }, commands: { ...commandItems, minItems: 1 }, changedFiles: { type: "array", maxItems: 0, items: text } } },
    { properties: { verdict: { const: "FAIL" }, issues: { type: "array", minItems: 1, items: text }, implementationStatus: { const: "blocked" } } },
  ],
}

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["phase", "verdict", "summary", "issues", "evidence", "tddPath", "traceability", "verifyReady"],
  properties: {
    ...common,
    verdict: { enum: ["PASS", "FAIL"] },
    phase: { const: "review" },
    tddPath: { enum: ["red-green", "green-baseline-no-change"] },
    traceability: coverageItems,
    verifyReady: { type: "boolean" },
  },
  oneOf: [
    { properties: { verdict: { const: "PASS" }, issues: { type: "array", maxItems: 0, items: text }, traceability: { ...coverageItems, minItems: 1 }, verifyReady: { const: true } } },
    { properties: { verdict: { const: "FAIL" }, issues: { type: "array", minItems: 1, items: text }, verifyReady: { const: false } } },
  ],
}
```

Schema 通过只是必要条件，工作流还必须执行以下谓词；每个谓词先拒绝 null，不能先读取结果字段。Review path red-green 必须通过 `tddPath` 与 green-baseline-no-change 的 Test/Impl 路径一致性校验：


```javascript
function isTestPass(result) {
  if (!result) return false
  return result.verdict === "PASS"
    && (result.testState === "red" || result.testState === "green-baseline")
    && result.coverage.length > 0 && result.commands.length > 0 && result.evidence.length > 0
    && result.fakeRed === false
    && (result.testState !== "green-baseline" || (result.productionPath.length > 0 && result.preexistingEvidence.length > 0))
}
function isImplPass(testResult, result) {
  if (!result) return false
  const pathMatches = testResult.testState === "red"
    ? result.implementationStatus === "green"
    : testResult.testState === "green-baseline"
      && result.implementationStatus === "no-change-review"
  return result.verdict === "PASS" && pathMatches
    && result.coverage.length > 0 && result.commands.length > 0 && result.evidence.length > 0
    && (result.implementationStatus !== "no-change-review"
      || (result.changedFiles.length === 0 && result.commands.length > 0 && result.evidence.length > 0))
}
function isReviewPass(testResult, implResult, result) {
  if (!result) return false
  const expectedPath = testResult.testState === "red"
    ? "red-green"
    : testResult.testState === "green-baseline"
      ? "green-baseline-no-change"
      : "invalid"
  return result.verdict === "PASS"
    && result.verifyReady === true
    && result.tddPath === expectedPath
    && result.traceability.length > 0 && result.evidence.length > 0
    && ((testResult.testState === "red" && implResult.implementationStatus === "green")
      || (testResult.testState === "green-baseline" && implResult.implementationStatus === "no-change-review"))
}
```

### 单 workflow 串行调用

每个 T-n 任务均生成一个独立的内联 SubagentWorkflow。主 agent 根据任务文件的编号、标题、目标与验证方式，生成任务专用的 workflow 元数据与节点文案；不得用 `parallel()` 包装三个阶段，只有前一语义 PASS 才调用下一次 `agent`。以下是 T-1 的完整成品示例：

```javascript
export const meta = {
  name: "T-1 统一只读审查工程师角色",
  description: "完成 T-1 的严格串行 TDD 门禁",
  phases: [
    { title: "测试", detail: "验证审查角色名称与只读边界" },
    { title: "实现", detail: "统一审查角色名称并落实只读职责" },
    { title: "审查", detail: "核对角色统一与回归证据" },
  ],
}

phase("测试")
const testResult = await agent(args.testPrompt, {
  label: "验证审查角色名称与只读边界",
  agentType: "test-engineer",
  schema: TEST_SCHEMA,
})
if (!isTestPass(testResult)) {
  return { verdict: "FAIL", failedPhase: "test", reason: gateReason(testResult) }
}

phase("实现")
const implResult = await agent(
  `${args.implPrompt}\n结构化 Test 证据：${JSON.stringify(testResult)}`,
  {
    label: "统一审查角色名称并落实只读职责",
    agentType: "impl-engineer",
    schema: IMPL_SCHEMA,
  },
)
if (!isImplPass(testResult, implResult)) {
  return { verdict: "FAIL", failedPhase: "impl", reason: gateReason(implResult) }
}

phase("审查")
const reviewResult = await agent(
  `${args.reviewPrompt}\n结构化 Test 证据：${JSON.stringify(testResult)}\n结构化 Impl 证据：${JSON.stringify(implResult)}`,
  {
    label: "核对角色统一与回归证据",
    agentType: "review-engineer",
    schema: REVIEW_SCHEMA,
  },
)
if (!isReviewPass(testResult, implResult, reviewResult)) {
  return { verdict: "FAIL", failedPhase: "review", reason: gateReason(reviewResult) }
}
return { verdict: "PASS", testResult, implResult, reviewResult }
```

脚本生成时，`meta` 必须是纯字面量；标题、description、phase detail 和 label 先完成 JSON 字符串转义，再写入对应任务的内联脚本。`meta.name` 是唯一 workflow 总标题事实源，`meta.phases[].title` 与 `phase()` 参数逐字一致；`agentType` 只负责角色路由，label 只负责节点可见标题。不同并行任务分别生成并调用各自的脚本，不得在一个脚本中遍历多个 T-n。

结构化对象 `testResult`、`implResult`、`reviewResult` 仅作为 workflow 局部变量与返回值传递，不得写入 reports、报告文件或 requirements。任务文件的 `agent` 可记录 workflow run id（`wf_...`），不记录 Agent 报告对象。

## 阶段五：accepting

进入 `accepting` 前置扫描必须识别尚未 `accepted` 需求中 `status: done` 且 `step != review` 的旧任务。若扫描发现旧任务，先将需求从 `accepting` 退回 `executing`，把任务迁移为 `status: doing`、`step: review`，清空 `agent`，保留 `commit`，然后通过带 Schema 的 acceptance/review workflow 补派 review-engineer；非 PASS 不进入 acceptance。

只有所有任务均为 `status: done` 且 `step: review` 才允许 `status: accepting`。acceptance workflow 是一个单 Agent `SubagentWorkflow`，只调用一次 `acceptance-reviewer`，并显式传入内联的 `ACCEPTANCE_SCHEMA`；不给 acceptance-reviewer 源码路径。acceptance-reviewer 继续写入调用方已有的 `acceptance.md`，结构化对象仅在该 workflow 的局部变量和内存中传递，不能写入报告或需求文件。

### Acceptance Schema 与业务谓词

下面的 Schema 是 workflow 内联的普通 JavaScript 对象，不写入仓库。StructuredOutput 运行时负责校验严格对象；Schema 合法仍须通过 `isAcceptancePass`，不得以报告正文替代对象裁决。

```javascript
const acceptanceItem = {
  type: "object",
  additionalProperties: false,
  required: ["id", "result", "observed", "difference"],
  properties: {
    id: text,
    result: { enum: ["PASS", "FAIL"] },
    observed: text,
    difference: text,
  },
}
const ACCEPTANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "phase", "verdict", "summary", "issues", "evidence",
    "acceptanceResult", "reportPath", "items", "uncovered",
  ],
  properties: {
    ...common,
    verdict: { enum: ["PASS", "FAIL"] },
    phase: { const: "acceptance" },
    acceptanceResult: { enum: ["accepted", "rejected"] },
    reportPath: text,
    items: { type: "array", items: acceptanceItem },
    uncovered: strings,
  },
  oneOf: [
    {
      properties: {
        verdict: { const: "PASS" },
        issues: { type: "array", maxItems: 0, items: text },
        acceptanceResult: { const: "accepted" },
        items: {
          type: "array",
          minItems: 1,
          items: {
            ...acceptanceItem,
            properties: {
              ...acceptanceItem.properties,
              result: { const: "PASS" },
            },
          },
        },
        uncovered: { type: "array", maxItems: 0, items: text },
      },
    },
    {
      properties: {
        verdict: { const: "FAIL" },
        acceptanceResult: { const: "rejected" },
      },
      anyOf: [
        { properties: { issues: { type: "array", minItems: 1, items: text } } },
        { properties: { uncovered: { type: "array", minItems: 1, items: text } } },
        {
          properties: {
            items: {
              type: "array",
              contains: {
                type: "object",
                required: ["result"],
                properties: { result: { const: "FAIL" } },
              },
            },
          },
        },
      ],
    },
  ],
}
```

验收 PASS 的唯一业务谓词为：

```javascript
function isAcceptancePass(args, result, report) {
  if (!result) return false
  if (!report) return false
  return result.verdict === "PASS"
    && result.acceptanceResult === "accepted"
    && result.items.length > 0
    && result.items.every((item) => item.result === "PASS")
    && result.issues.length === 0
    && result.uncovered.length === 0
    && result.reportPath === args.acceptancePath
    && report.path === args.acceptancePath
    && report.frontmatter.result === "accepted"
}
```

调用方必须从 `args.acceptancePath` 读取已经写出的 `acceptance.md` 的 frontmatter，并把读取结果传给该谓词；报告不可读、路径不一致、frontmatter 不是 `accepted` 或对象字段与报告结论不一致均拒绝。Schema 缺失 → `FAIL`；`null` 或空结果 → `FAIL`；非法对象或校验失败 → `FAIL`；语义矛盾或对象与 `acceptance.md` 不一致 → `FAIL`。Markdown、文本 JSON、自然语言结果不得参与门禁；`JSON.parse` 或正则提取均禁止，任一此类输出均按 `FAIL` 处理。

该 acceptance workflow 的调用顺序如下；结构化结果 `acceptanceResult` 只保留在当前 workflow 内存中：

```javascript
export const meta = {
  name: "acceptance-structured-gate",
  description: "Run the single acceptance reviewer gate",
  phases: [{ title: "Acceptance", detail: "acceptance-reviewer structured gate" }],
}

phase("Acceptance")
if (!ACCEPTANCE_SCHEMA) {
  return { verdict: "FAIL", failedPhase: "acceptance", reason: "StructuredOutput Schema 缺失" }
}
const acceptanceResult = await agent(args.acceptancePrompt, {
  label: "acceptance-reviewer",
  agentType: "acceptance-reviewer",
  schema: ACCEPTANCE_SCHEMA,
})
const acceptanceReport = await readAcceptanceReport(args.acceptancePath)
if (!isAcceptancePass(args, acceptanceResult, acceptanceReport)) {
  return { verdict: "FAIL", failedPhase: "acceptance", reason: "StructuredOutput acceptance gate failed" }
}
return { verdict: "PASS", acceptanceResult }
```

只有对象同时满足 `verdict: PASS`、`acceptanceResult: accepted`、`items` 非空且全部为 `PASS`、`issues` 与 `uncovered` 为空、`reportPath` 精确等于调用方路径，并且 `acceptance.md` frontmatter 为 `result: accepted` 时，才可将需求置为 `accepted`。任何失败关闭结果统一写为 `status: failed` 与 `note: <原因>`，停止新任务派发和 accepting，不自动重试或返修；失败对象不得持久化，非 PASS 不进入 acceptance。

- `accepted` → 先合入现行规范：把本次每条 R 改写进 `.pi-spec/spec/<域>.md`（新增或替换），删除因此失效的规则，用本次 AC 替换过时例子，对该文件跑 lint；然后 `status: accepted`，规范与代码一起 commit，向用户汇报并交由用户决定是否推送。未合入规范不得置 `accepted`。
- `rejected` → `status: rejected`，加载 spec-revise skill，对每个 FAIL 的 AC 归因并原地回退。

## 断点续接（/spec-resume）

1. 定位现场：扫描 `.pi-spec/requirements/*/requirements.md`，取 `status` 不为 `accepted` 的目录。恰一个直接续；多个用 `ask_user_question` 让用户选；零个报告“没有未完成的需求”并停止。
2. 按 `status` 进入对应阶段：
   - `draft`：依据当前文档内容重新识别缺失信息，从第一个缺失维度继续澄清；已写入的内容不重问。
   - `confirmed`：重派 planner（幂等覆盖）。
   - `planned`：重新计算并行组并汇报，直接进入 executing。
   - `accepting`：先执行旧任务扫描；若存在 `status: done` 且 `step != review`，退回 `executing` 并补审，不直接重跑验收；否则整体重跑验收。
   - `rejected`：加载 spec-revise skill 归因并原地回退。
   - `executing`：先扫描旧任务，再对每个任务按下表处理，然后回到调度。

旧任务扫描识别未 accepted 需求中 `status: done` 且 `step != review` 的任务，迁移为 `status: doing`、`step: review`，清空 `agent` 并保留 `commit`；补审必须通过带 Schema 的 workflow，取得结构化 PASS 后重新运行 verify，已有 commit 不创建空提交，verify 成功才恢复 done。补审未取得 PASS、返回 FAIL、代理失败或证据不足时写 `status: failed` 与 `note: <原因>`，不进入 acceptance。

| 任务状态 | 处理 |
|---|---|
| `done` 且 `step: review` | 跳过 |
| `done` 且 `step != review` | 迁移为 `doing/review`，保留 commit，补派 review-engineer |
| `todo` | 进入调度 |
| `failed` | 报告用户，等待裁决；停止新派工和验收，不自动重试或返修 |
| `doing` 且 `step: review` | agent 指向仍运行的 workflow 时等待通知；可用相同 run id 以 `resumeFromRunId` 恢复；无法恢复则重派只读审查，不重跑已可证明的 Red/Green |
| `doing` | 已有 workflow run id 且可恢复则继续；run id、结果或结构化对象无法恢复，或无法证明前序 PASS，则从第一个无法恢复的门禁阶段重新执行，必要时重跑完整三阶段；不得从历史自然语言报告推断 PASS |

同一并行组内多个 `doing` 按上表各自处理后仍可并发续跑，但每个任务内部 `test → impl → review` 严格串行。用户在 `/spec-resume` 后附 `--verify` 时，仅对已取得结构化 review PASS 的 `done` 任务重跑 `verify`，失败的改为 `failed`。
