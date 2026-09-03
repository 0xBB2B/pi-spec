---
name: spec-docs
description: .pi-spec 需求包的格式权威源——requirements.md（当前黑盒契约）、tasks/（一任务一文件的自包含任务，含索引）、acceptance.md（验收报告）以及独立的 ai-decisions.jsonl 和 user-decisions.jsonl 决策事实源。
---

# spec-docs：需求包格式

## 目录与事实源

每个需求目录是一个自包含的需求包：

```
<repo>/.pi-spec/
├── .cache/                              临时证据（不提交）
├── spec/<域>.md                         系统当前有效规范
└── requirements/<YYYY-MM-DD>.<slug>/
    ├── requirements.md                  当前有效黑盒契约
    ├── tasks/
    │   ├── INDEX.md                     阶段分组、依赖、被否定的备选方案
    │   └── NN-<name>.md                 一任务一文件，自包含
    ├── acceptance.md                    黑盒验收报告
    ├── ai-decisions.jsonl               本需求唯一的 AI 决策事实源
    └── user-decisions.jsonl             本需求唯一的用户决策事实源
```

`requirements.md` 只保存当前有效的黑盒契约，不保存决策历史。`ai-decisions.jsonl` 与 `user-decisions.jsonl` 分开保存本需求已形成的材料性决定；一项决定恰好占一行，两个台账不得与其他需求混写。决策台账是追加式事实源，既有行不得改写、删除或重新编号。

新需求先复制 `requirements.template.md`，建立 `tasks/INDEX.md` 与 `acceptance.md` 占位，再以 `init --requirement-dir <需求目录>` 创建两个空台账，形成需求包。`init` 只接受目录名为 `<YYYY-MM-DD>.<slug>`、frontmatter 状态为 `draft` 且两个台账均不存在的需求目录；任何已存在的台账都不覆盖。迁移 mapping 只属于一次性迁移证据，正式 writer 不读取 mapping，也不解析旧记录形状。

`<slug>` 与现行规范域均为小写英文短横线连接；`<slug>` 同时是分支名。现行规范位于 `spec/<域>.md`，只描述系统此刻的对外行为，不写日期、变更来源或历史对照。

## spec/<域>.md

现行规范每个功能域一份，章节固定：

1. 行为规则：EARS 句式，一条一行，按触发条件分组
2. 对外接口：命令行、HTTP 或界面元素的输入输出契约
3. 验收例子：与 AC 同格式（触发 / Given / When / Then），每条规则至少一个例子

禁写清单与 `requirements.md` 相同。超过 100 行时按子域拆成多个文件。

## requirements.md

模板固定为且只能为第 1～7 节，不得增删章节：

1. 背景
2. 目标与非目标
3. 术语
4. 需求
5. 行为方案
6. 边界与已知坑
7. 验收标准

frontmatter 的 `status` 取值为：`draft`（澄清中）、`confirmed`（用户已确认需求）、`planned`（任务文件已产出）、`executing`（执行中）、`accepting`（验收中）、`accepted` 或 `rejected`。需求文档只表达当前契约；draft 中断恢复时必须依据当前内容重新识别缺失信息并重新澄清，不从未回答、忽略或取消的问题恢复请求记录。

### 需求条目 R-n（第 4 节）

每条 R 是一个可观察行为，按 EARS 五种句式之一用中文书写：

| 句式 | 模板 |
|---|---|
| 恒定 | 系统应 <行为> |
| 事件驱动 | 当 <事件> 时，系统应 <行为> |
| 状态驱动 | 在 <状态> 期间，系统应 <行为> |
| 异常行为 | 如果 <非期望条件>，系统应 <行为> |
| 可选特性 | 若启用 <特性>，系统应 <行为> |

每个功能点至少有一条异常行为需求覆盖失败路径。单个需求最多 12 条有效 R；超出时拆成多个需求目录，各自独立走完流程。一经确认，R-n 永不复用与重排；作废条目保留编号并把标题改为 `[作废] <原标题>`。

### 验收条目 AC-n（第 7 节）

每条 AC 固定为：

```
### AC-n <标题>  ← R-m
- 触发: 命令 <命令行> | 请求 <方法 路径 + 载荷> | 操作 <界面步骤>
- Given: <前置状态，含数据准备>
- When: <外部输入，与触发一致>
- Then: <可观察输出：返回值 / 响应 / 界面 / 副作用>
```

每条 AC 至少回指一个已声明的 R，每条 R 至少被一条 AC 覆盖。单个需求最多 20 条 AC。Then 必须是黑盒可观察结果，不写代码、内部过程或实现细节；数值指标写具体数字和单位。

需求文档禁写源码文件路径、目录名、模块名、函数名、类名、变量名、第三方库名、技术栈名、数据库表名和代码块。对外接口的命令行、HTTP 路径和界面元素属于黑盒契约，允许写。

## tasks/

任务目录由 planner 产出，一任务一文件，每个文件自包含：仅凭该文件与仓库现有代码即可完成测试、实现与审查，不写“见 requirements”式引用。

`tasks/INDEX.md` 不超过 30 行：按阶段分组列出任务，每行 `- [T-n <标题>](NN-<name>.md) — <一句话>`，依赖标 `[依赖: T-m]`；末尾列出被否定的备选方案及理由。

`tasks/NN-<name>.md`（`NN` 为两位执行序号，`<name>` 为 kebab-case），不含成品代码块不超过 200 行。frontmatter 字段顺序固定：

```
---
id: T-n
title: <标题>
depends_on: [T-a, T-b]
files: [<完整路径>, ...]
refs: [R-x, AC-y, ...]
parallel: true | false
verify: <一条命令，退出码 0 即通过>
status: todo | doing | done | failed
step: test | impl | review
agent: <当前或最近一次派工的 workflow run id>
commit: <完成时的 commit hash>
note: <失败原因或续接备注>
---
```

正文章节固定：

1. 目标：一句话，完成后系统具备什么能力
2. 业务规则：内联复述本任务 refs 的 R/AC 原文
3. 涉及文件：每行标新建或修改
4. 成品定义（仅声明式产物时存在）：DDL、API 契约、配置的完整成品，exec 原样落盘不得改写
5. 新增第三方依赖（仅本任务引入新库时存在）：库名、用途、版本策略
6. 函数清单：按文件列函数名与职责一句话，不写参数、返回值与实现
7. 协作关系：函数调用关系与外部依赖
8. 验证方式：测试入口、测试输入、预期结果、错误场景，只写公开入口不写内部实现路径；必须逐条覆盖目标与涉及文件所隐含的每个可观察变化。交付物是提示词或规范文本时，写成“必须出现的句子”与“必须不再出现的句子”两张清单，测试逐条断言，不做通用语义检测

三个角色各读其块：test-engineer 读业务规则与验证方式；impl-engineer 读涉及文件、成品定义、新增第三方依赖、函数清单、协作关系；review-engineer 读整份。

一个任务是一个竖切片：`files` 中生产文件不超过 2 个，`refs` 中 AC 不超过 3 条，预估改动不超过 200 行；触碰同一生产文件的行为合并进同一个任务，不得拆成 `depends_on` 链。`files` 两两不相交的任务才可并行；`depends_on` 只能引用编号更小的任务；每个 AC-n 至少被一个任务 refs 覆盖。`status`、`step`、`agent`、`commit`、`note` 五个运行字段只由主 agent 写；结构化门禁对象只在 workflow 内存中传递，不写入任务文件。

## acceptance.md

验收报告 frontmatter 为 `result: accepted | rejected` 与 `date: <YYYY-MM-DD>`，正文固定为结果表、未覆盖和结论。任一条目 FAIL 或未覆盖即 rejected。

## canonical v1 决策台账

两个 ledger 都是 LF 结尾的追加式 JSONL。文件为空，或每行一个紧凑 JSON 对象并以单个 `\n` 结尾；空行、尾部缺换行、未知字段、legacy `event` / `status` / `pending` / `resolved` / `resolves` 形状和反向 `supersededBy` 均拒绝。每个需求只允许自己的两个台账，`requirement` 必须精确等于目录 slug。

AI 行的完整字段为：

```typescript
type AiDecisionV1 = {
  id: `AI-${number}`
  recordedAt: string
  actor: "ai"
  source: string
  requirement: string
  scope: string
  trigger: string
  decision: string
  basis: string[]
  alternatives: string[]
  action: string
  supersedes?: DecisionId[]
}
```

用户行的完整字段为：

```typescript
type UserDecisionV1 = {
  id: `USER-${number}`
  recordedAt: string
  actor: "user"
  source: string
  requirement: string
  trigger: string
  decision: string
  alternatives: string[]
  impact: string
  supersedes?: DecisionId[]
}
```

未知字段拒绝；字符串必须非空；数组不得含重复值；AI 的 basis 与 alternatives 至少一项，用户 alternatives 可为空；recordedAt 必须是 UTC RFC3339；各自 ledger 的 ID 数字后缀严格递增但允许一次性迁移形成的编号空洞。`supersedes` 只能由新追加的行指向两个 ledger 中已经存在的更早决定，目标行不增加反向字段；不得前向引用、重复引用或形成环。替换或纠错只追加新决定。

材料性判定同时要求：存在合理替代方案；已选方案并非现行规则或已批准计划唯一确定；并且会改变行为、范围、授权、架构、风险、恢复路径或流程分支。观察、测试结果、命令输出、Reviewer verdict、机械执行、工具调用、固定状态转换、临时想法以及未回答、忽略或取消的问题不记录。决定必须在关联动作之前成功写入，记录失败则关联动作失败关闭。

### writer API 与命令

唯一 writer 提供以下 API：

```typescript
type DecisionRecordInput = {
  requirementDir: string
  actor: "ai" | "user"
  source: string
  scope?: string
  trigger: string
  decision: string
  basis?: string[]
  alternatives: string[]
  action?: string
  impact?: string
  supersedes?: DecisionId[]
  materiality: {
    alternativesExist: true
    notUniquelyDetermined: true
    effects: Array<"behavior" | "scope" | "authorization" | "architecture" | "risk" | "recovery" | "flow-branch">
  }
}

type DecisionReceiptV1 = {
  schema: "decision-receipt/v1"
  receiptId: string
  decisionId: DecisionId
  actor: "ai" | "user"
  requirementDir: string
  ledgerPath: string
  lineNumber: number
  decisionHash: string
  recordedAt: string
}
```

AI 输入必须有 scope、basis、action 且不得有 impact；user 输入必须有 impact 且不得有 scope、basis、action。writer 生成 id、actor、recordedAt 和 ledger 路由。成功只表示一行已 fsync 且双 ledger 写后重读校验；receipt 的 decisionHash 是最终单行 canonical JSON 加换行的 SHA-256。writer 不读取迁移 mapping。

正式命令为：

```
bun decision-ledger.ts init --requirement-dir <absolute-dir>
bun decision-ledger.ts validate --requirement-dir <absolute-dir>
bun decision-ledger.ts inspect --requirement-dir <absolute-dir> --id <AI-n|USER-n>
```

append 只能由受材料性检查保护的 `decision_record` 调用，不能通过通用 append CLI 绕过检查。追加在需求级原子锁中完成，单次 O_APPEND 写入后 fsync、写后重读并精确核对旧字节前缀；任何失败不返回 receipt，不截断、重写或删除既有行。ID 分配使用该 ledger 已有最大数字后缀加一。

## accepted 边界

accepted 后 requirements 契约、tasks/ 下全部任务文件和 acceptance 验收交付物冻结，只允许向已有的两个 ledger 台账追加与该需求相关的新决定。追加不得改写目标 ledger 的旧字节前缀，不得改变另一 ledger 或其他交付物；缺少或不匹配冻结快照时失败关闭，不能从可疑当前内容自动重建。任何新决定都仍须经过完整 canonical v1 校验、需求隔离、ID 与 supersedes 约束。

## 自检与 lint

确认前逐条检查 R 是否必要、无歧义、单一且可验证，AC 是否能由第三方仅凭文档执行，然后运行：

```
bash <本 skill 所在目录>/scripts/lint.sh <requirements.md 路径>
```

lint 必须确认 requirements 恰好为第 1～7 节、R/AC 互相完整覆盖、有效 R 不超过 12 条且 AC 不超过 20 条、AC 具有固定四行结构，并验证同目录两个 canonical v1 ledger。输出 FAIL 时不得进入 `confirmed`。
