# 强制 TDD 审查工程师门禁设计

## 1. 现状

- 权威需求 `/Users/bb/.pi/.pi-spec/requirements/2026-09-01.mandatory-review-engineer/requirements.md` 当前为 `status: confirmed`，包含 R-1～R-28 与 AC-1～AC-31。USER-037 将 task 原子性定义为：一个根因、一个可独立触发和验证的结果、一个 verify、一个 GO/NO-GO；同一纵向行为的成功与失败路径可以属于同一 task。
- T-1～T-6 已完成，是不可改写的历史执行事实。T-6 在 `/Users/bb/.pi/agent/skills/spec-docs/scripts/decision-ledger.ts` 提供 canonical v1 writer、`appendDecision()`、receipt、需求级双台账校验与 accepted freeze，本设计只调用它，不修改它。
- T-7 是不可重开、不可复用的复合失败任务；其 extension、测试与快照已回滚，`/Users/bb/.pi/agent/extensions/decision-gate/` 和对应测试当前不存在。T-8～T-11 未执行，本次删除后由 T-12 起的新原子任务替换，编号不复用。
- 当前 `planner.md` 仍允许“一个任务 = 一组可独立测试的行为”；`spec-flow/SKILL.md` 在规划后只机械核对覆盖、依赖、并行关系，没有 problem id、专用 tasks lint 或语义原子性审查；其执行状态机还会被历史 T-7 `failed` 永久阻断。
- 当前 TDD 三角色通过 `SubagentWorkflow` 使用 StructuredOutput；`acceptance-reviewer` 与 `pre-reviewer` 仍被旧流程放入 workflow，和 R-11/R-12 要求的主 agent 直接调用严格 JSON 不一致。三个 reviewer 当前只靠角色工具列表保持只读，六个角色均 `extensions: false`，decision-gate hook 尚未安装。
- Pi 全局 extension 自动发现目录为 `/Users/bb/.pi/agent/extensions/`，目录式入口为 `extensions/<name>/index.ts`。Pi 已提供 `registerTool()`、可阻断和修改 input 的 `tool_call`、可修改最终结果的 `tool_result`、`getAllTools()`/`getActiveTools()`/`setActiveTools()`、`exec(executable,args,options)` 与 `withFileMutationQueue()`。
- 当前 `@tintinweb/pi-subagents@0.19.0` 的 Agent 成功后台结果通过 `details.agentId` 暴露 manager 身份；SubagentWorkflow 顶层成功结果通过精确 `{taskId}` 暴露 run id。身份不得从 content/prose 提取。model tool calls 可并发，preflight 顺序执行而 executor 和 `tool_result` 完成顺序可交错，因此 journal 必须以 `toolCallId` 关联。
- 现有测试框架为 Bun。新增测试按一个 problem 一个小测试文件组织；每条 tasks.verify 只运行该文件，不用一个巨型测试文件替代多个 task 的独立结论。
- 安全边界只覆盖 Pi 模型发起的 tool call、由其启动且加载 gate 的 child Agent/workflow child，以及这些 session 内的受保护动作；用户 `!`/`!!`、终端命令和 Pi 外部进程不在 syscall sandbox 保证内。
- 不新增第三方依赖，不新增 Python、native addon、外部 helper 或其他语言运行时；实现只使用 Pi/TypeBox 既有能力、Bun/Node 标准库与 T-6 writer。

## 2. 改动点

### 2.1 独立问题单元总表

以下 P-n 是本次增量规划的唯一白盒 problem register。每个 P-n 恰好映射一个新 T-n；历史 T-1～T-7 不迁移 problem 字段。

| Problem | Task | 独立问题 |
|---|---|---|
| P-1 | T-12 | tasks 原子问题标识、格式契约与结构 lint |
| P-2 | T-13 | planner prompt 的独立问题拆分规则 |
| P-3 | T-14 | spec-flow 对 planner 产物的原子性计划审查门禁 |
| P-4 | T-15 | Review 发现其他独立问题时新增 task，当前返修不扩张 |
| P-5 | T-16 | 增量规划中历史 done/failed 与当前可执行问题集的边界 |
| P-6 | T-17 | decision_record 公共 Schema 与真实 Pi 参数校验 |
| P-7 | T-18 | receipt 的 line/hash/time/ledger 重读绑定 |
| P-8 | T-19 | decision_permit 公共 closed Schema |
| P-9 | T-20 | permit 持久状态、消费、吊销与任务绑定 |
| P-10 | T-21 | tool_call 对 raw/unknown/provenance 的失败关闭 |
| P-11 | T-22 | guarded edit/write 的许可、输入与路径裁决 |
| P-12 | T-23 | 纯 Node 同目录原子写入 |
| P-13 | T-24 | exact tasks.verify 的封闭 compiler |
| P-14 | T-25 | compiled verify 通过真实 pi.exec 执行 |
| P-15 | T-26 | Agent launcher nonce/envelope/pending preflight |
| P-16 | T-27 | Agent tool_result 身份验证与 finalization |
| P-17 | T-28 | Agent child exact-session attach |
| P-18 | T-29 | SubagentWorkflow launcher envelope/pending |
| P-19 | T-30 | SubagentWorkflow tool_result/run-id finalization |
| P-20 | T-31 | gate readiness 失败关闭且无额外 runtime |
| P-21 | T-32 | Pi package 安装与资源发现 |
| P-22 | T-33 | planner 加载 gate 及限定写权限 |
| P-23 | T-34 | test-engineer 加载 gate 及测试限定写权限 |
| P-24 | T-35 | impl-engineer 加载 gate 及实现限定写权限 |
| P-25 | T-36 | review-engineer 加载 gate 且无写权限 |
| P-26 | T-37 | acceptance-reviewer 加载 gate 及报告限定权限 |
| P-27 | T-38 | pre-reviewer 加载 gate 且无写权限 |
| P-28 | T-39 | 每 task 严格串行的结构化 TDD/GO/verify 门禁 |
| P-29 | T-40 | task 标题、三阶段节点与并行独立 workflow 展示 |
| P-30 | T-41 | TDD 快照、补审与安全续接 |
| P-31 | T-42 | TDD workflow 的 permit/envelope/child 接入 |
| P-32 | T-43 | acceptance-reviewer 主 agent 直接严格 JSON 裁决 |
| P-33 | T-44 | acceptance.md 唯一报告写许可 |
| P-34 | T-45 | 黑盒启动与触发命令的验收执行许可 |
| P-35 | T-46 | pre-reviewer 主 agent 直接严格 JSON 裁决 |
| P-36 | T-47 | pre-review 需求关联与不可变审查快照 |
| P-37 | T-48 | 已审远端 push/PR/MR 命令许可 |
| P-38 | T-49 | 三类 Review 的归因、材料性决定与自动返修路由 |
| P-39 | T-50 | 单门禁最多三轮返修与停止 |

### 2.2 P-1～P-5：规划原子性与增量边界

#### P-1 / T-12 tasks 原子问题格式与结构 lint

- 落点/refs: 修改 `spec-docs/SKILL.md`，新增 `scripts/tasks-lint.ts` 和独立测试；覆盖 R-26、R-27、AC-29、AC-30。
- 新任务块增加单值 `problem: P-n`；design 第 2 节的 P-n register 是映射事实源。lint 校验字段顺序、单 problem id、P↔T 一一映射、非空单行 verify、refs 映射、编号、依赖、覆盖和 parallel 文件冲突。语义独立性明确不由正则声称完成。
- 历史无 `problem` 块仅在 `status: done | failed` 时允许；任何新 `todo | doing` 块缺 problem 都失败。T-1～T-7 无需迁移。
- 原子性证明: 根因=现有 tasks 格式没有机器可识别的问题身份；独立输入/结果=给定 design/tasks，结构 lint 单独返回 PASS 或指出 problem/字段/映射错误；独立 verify=只运行 `task-atomicity-lint.test.ts`；独立回滚边界=只回滚格式文档、lint 脚本与该测试。

#### P-2 / T-13 planner 独立问题拆分规则

- 落点/refs: 修改 `agents/planner.md`，删除“一组行为可合并”的有效规则，要求先列 P-n、再一对一建 T-n，并逐项写四维原子性证明；覆盖 R-26、AC-29。
- planner 自检必须逐 task 询问：是否存在可分别通过、失败、审查或回滚的部分；任一为是则继续拆分。共享文件、相邻模块、同一需求或共享验证环境都不是合并理由。
- 原子性证明: 根因=planner prompt 明示允许复合行为组；独立输入/结果=给 planner 一个多能力需求，产物规则要求每个 P 只生成一个 T；独立 verify=只运行 `planner-atomicity.test.ts`；独立回滚边界=只回滚 planner 角色说明与该测试。

#### P-3 / T-14 spec-flow 规划原子性门禁

- 落点/refs: 修改 `spec-flow/SKILL.md`，新增计划门禁测试；覆盖 R-26、R-27、AC-29、AC-30。
- `confirmed → planned` 固定先运行 tasks lint，再由主 agent依据 P 证明进行语义计划审查。发现任何可独立通过、失败、审查或回滚的复合项时，带具体子问题退回 planner；requirements 不得进入 `planned` 或 `executing`。正则只能校验结构，不能替代语义门禁。
- 原子性证明: 根因=生命周期没有 planner 产物的语义原子性放行条件；独立输入/结果=输入含复合 task 的 planner 产物，状态保持 confirmed 并返回拆分原因；独立 verify=只运行 `planning-atomicity-gate.test.ts`；独立回滚边界=只回滚规划门禁规则与该测试。

#### P-4 / T-15 Review 独立问题分流

- 落点/refs: 修改 `spec-flow/SKILL.md`，新增 Review 问题分流测试；覆盖 R-28、AC-31。
- Review issue 若是当前 task 改动直接造成且违反该 task 的单一预期结果，仍进入当前 task 返修；若根因或预期结果可独立验证，则追加新 P-n/T-n，编号接续最大编号，当前返修范围不扩张。新任务先经 P-1/P-3 门禁后才能调度。
- 原子性证明: 根因=当前 Review 返修没有区分原问题和新独立问题；独立输入/结果=输入当前问题与独立 launcher issue，系统只为后者新增后续 task；独立 verify=只运行 `review-issue-routing.test.ts`；独立回滚边界=只回滚问题分流规则与该测试。

#### P-5 / T-16 历史任务与当前执行集边界

- 落点/refs: 修改 `spec-flow/SKILL.md`，新增增量历史测试；覆盖 R-27、AC-30。
- 增量重规划后，有 `problem` 的新任务构成当前可执行集；无 problem 且 done/failed 的 T-1～T-7 只作为不可改写历史和覆盖证据。T-7 不重开、不计入当前就绪/完成阻断；当前 P 任务全部 done 后才可 accepting。无 problem 的 todo/doing 仍由 lint 拒绝，不能借历史例外绕过执行。
- 原子性证明: 根因=现有“任一 failed 即停止”无法区分保留历史失败和当前失败；独立输入/结果=给定 T-7 历史 failed 与新 problem tasks，调度只由当前问题集状态决定；独立 verify=只运行 `incremental-history-boundary.test.ts`；独立回滚边界=只回滚增量执行集规则与该测试。

### 2.3 P-6～P-21：decision-gate 强制层

所有 extension 单元使用共享 `/Users/bb/.pi/agent/extensions/decision-gate/index.ts` 与 `policy.ts`；共享文件不是合并理由，各 task 用 depends_on 串行并由独立小测试裁决。

#### P-6 / T-17 decision_record 公共 Schema

- 落点/refs: 新增 extension 入口、policy 与 `decision-record-schema.test.ts`；覆盖 R-17、R-18、AC-18、AC-19、AC-26。
- `decision_record` 使用 closed AI/user `oneOf`，递归 `additionalProperties:false`，真实 ExtensionRunner 在 execute 前做参数校验；execute 直接调用 T-6 `appendDecision()`，不复制 writer，不提供通用 append CLI。
- 原子性证明: 根因=canonical writer 没有可由 Pi 调用且先经真实 tool Schema 校验的公共入口；独立输入/结果=合法输入产生 writer receipt，未知/错 actor 字段在 writer 动作前被拒绝；独立 verify=只运行 `decision-record-schema.test.ts`；独立回滚边界=只删除初始 extension 入口、policy 与该测试。

#### P-7 / T-18 receipt 完整重读绑定

- 落点/refs: 修改 policy，新增 `receipt-binding.test.ts`；覆盖 R-18、AC-19。
- permit 前按 receipt 的 requirementDir、ledgerPath、lineNumber、decisionId、actor、decisionHash、recordedAt 重读 canonical 行；hash 包含该行 LF。任一字段、ledger peer、accepted freeze 或当前行内容漂移都拒绝。
- 原子性证明: 根因=T-7 诊断证明 receipt 未完整绑定真实台账行；独立输入/结果=篡改 line/hash/time 任一值时 permit 前失败且无状态副作用；独立 verify=只运行 `receipt-binding.test.ts`；独立回滚边界=只回滚 receipt validator 与该测试。

#### P-8 / T-19 permit 公共 closed Schema

- 落点/refs: 修改入口与 policy，新增 `permit-schema.test.ts`；覆盖 R-21、R-22、AC-23、AC-24。
- `decision_permit` 公开 Schema 仅有 issue/attach/inspect 三个 closed 分支，每个 discriminator 为 const，嵌套对象均 closed；不含 legacy alias、宽属性并集或 `prepareArguments` 兼容入口。
- 原子性证明: 根因=T-7 的 public permit Schema 外层封闭方式使合法输入不可用且隐藏旧形状；独立输入/结果=三个合法分支通过真实 Pi 校验，交叉字段和未知字段均在 execute 前拒绝；独立 verify=只运行 `permit-schema.test.ts`；独立回滚边界=只回滚 permit 注册/schema 与该测试。

#### P-9 / T-20 permit 持久状态与消费

- 落点/refs: 修改 policy，新增 `permit-state.test.ts`；覆盖 R-21、R-22、AC-23、AC-24。
- permit 绑定 requirement、task id/title/block hash、requirements hash、taskPaths、tools、input hash、audience、TTL、maxUses；token 仅明文返回，落盘只存 hash。reservation/revoke/commit 为 canonical LF JSONL，需求级锁下 durable reserve；reload 后以 reservation 计 spent，不重放 executor。
- 原子性证明: 根因=公开 permit 若无可重读的消费事实会并发超发或重载复用；独立输入/结果=同一 permit 的消费、超额、过期、吊销和 reload 各自得出唯一可重读状态；独立 verify=只运行 `permit-state.test.ts`；独立回滚边界=只回滚 permit store/journal 状态机与该测试。

#### P-10 / T-21 tool_call provenance 失败关闭

- 落点/refs: 修改入口与 policy，新增 `hook-provenance.test.ts`；覆盖 R-18、R-22、R-23、AC-19、AC-24、AC-25。
- hooks 在 policy 初始化前注册，初始 `ready:false`。只有 source/path 精确匹配的 built-in read/grep/find/ls 可免许可；raw edit/write/bash、同名伪造、缺失/冲突 provenance、sdk/未知 extension tool 全阻断。policy 或 journal 初始化失败继续关闭。
- 原子性证明: 根因=工具名本身不能证明工具来源或无副作用；独立输入/结果=raw/unknown/伪造 provenance tool_call 在 executor 前被阻断，精确可信只读调用放行；独立 verify=只运行 `hook-provenance.test.ts`；独立回滚边界=只回滚 hook 分类器与该测试。

#### P-11 / T-22 guarded edit/write 裁决

- 落点/refs: 修改 policy，新增 `guarded-mutation.test.ts`；覆盖 R-21、R-22、R-23、AC-23、AC-24、AC-25。
- `decision_edit`/`decision_write` 是 Pi 文件 mutation 唯一入口；重读 receipt/permit/task，校验 role、token、TTL/use、tool input hash、taskPaths、create/replace 操作和 lexical/canonical 路径。edit 的 oldText 必须在同一原始内容中各唯一且区间不重叠。
- 原子性证明: 根因=有 permit 不等于本次文件与 payload 在授权范围内；独立输入/结果=合法单文件 edit/write 得出成品，缺许可/越界/错 payload 在 reservation 前无副作用；独立 verify=只运行 `guarded-mutation.test.ts`；独立回滚边界=只回滚 guarded mutation preflight 与该测试。

#### P-12 / T-23 纯 Node 原子写

- 落点/refs: 修改 policy，新增 `atomic-write.test.ts`；覆盖 R-22、AC-24。
- 在 `withFileMutationQueue(realTarget)` 与 requirement lock 内执行：校验 parent/leaf 非 symlink、existing leaf `nlink===1`、durable reservation、同目录高熵 `wx` temp、完整写入与 fsync、identity 复核、单次 rename、parent fsync、最终 bytes/hash/nlink 核验、commit journal。失败只按精确 temp identity 清理。
- 原子性证明: 根因=授权正确仍可能因非原子落盘产生部分写或并发覆盖；独立输入/结果=注入 write/fsync/rename/identity 漂移时 target 保持旧成品或完整新成品而无部分内容；独立 verify=只运行 `atomic-write.test.ts`；独立回滚边界=只回滚原子文件 executor 与该测试。

#### P-13 / T-24 exact verify compiler

- 落点/refs: 修改 policy，新增 `verify-compiler.test.ts`；覆盖 R-21、R-22、AC-23、AC-24。
- 编译完整 `tasks.verify` UTF-8 bytes 为 env/executable/argv/cwd，采用第 4.5 节封闭 grammar 并要求 canonical round trip 逐字节相同；quotes、escape、shell 运算符、重定向、pipe、substitution、变量、glob、控制字符、多空格/tab 非 canonical 形式全部拒绝。
- 原子性证明: 根因=exact bytes 授权事实不能直接作为 executable，也不能交给 shell 扩大语义；独立输入/结果=给定 verify bytes，compiler 唯一产生 plan 或在 spawn 前拒绝；独立 verify=只运行 `verify-compiler.test.ts`；独立回滚边界=只回滚 compiler 与该测试。

#### P-14 / T-25 真实 pi.exec verify

- 落点/refs: 修改 policy，新增 `verify-exec.test.ts`；覆盖 R-18、R-22、R-25、AC-19、AC-24、AC-28。
- `decision_bash` 每次重读当前 task verify 与 permit plan，随后只调用 `pi.exec(plan.executable, plan.args, {cwd, env, signal})`；不得调用 shell。spawn/abort/timeout/non-zero 在 reservation 后均 spent 并失败。
- 原子性证明: 根因=compiler 正确不证明真实 Pi executor 使用了该 plan；独立输入/结果=真实 runner 执行当前 task verify 并观测 executable/argv/env/cwd，反例 spawn 次数为零；独立 verify=只运行 `verify-exec.test.ts`；独立回滚边界=只回滚 decision_bash executor 与该测试。

#### P-15 / T-26 Agent launcher preflight

- 落点/refs: 修改入口与 policy，新增 `agent-launch-preflight.test.ts`；覆盖 R-21、R-22、R-23、AC-23、AC-24、AC-25。
- 新 Agent launch 只允许显式 background、无 resume/schedule/isolated/移除 gate 配置；matching launcher grant 绑定原始 input hash、task 与唯一 role。hook 生成至少 256-bit nonce/token，向 prompt 注入只读 envelope，重算 final hash，durable consume parent use 后写 launching pending。
- 原子性证明: 根因=parent permit 无法单凭 caller 自报身份安全授权尚未创建的 child；独立输入/结果=合法 Agent call 被注入唯一 capability/pending，预置保留字段或不匹配 input 在 launch 前拒绝；独立 verify=只运行 `agent-launch-preflight.test.ts`；独立回滚边界=只回滚 Agent tool_call preflight 与该测试。

#### P-16 / T-27 Agent tool_result finalization

- 落点/refs: 修改入口与 policy，新增 `agent-launch-result.test.ts`；覆盖 R-18、R-21、R-22、AC-19、AC-23、AC-24。
- matching `toolName + toolCallId` 的 result 只接受当前 AgentDetails 封闭字段、`status:"background"`、matching role 和合法 `details.agentId`；从可信 id 计算 exact session name并 append/fsync唯一 finalized。isError、缺/多字段、input hash 漂移或 prose-only id 形成 failed finalization。
- 原子性证明: 根因=preflight 时 manager child identity 尚不存在；独立输入/结果=matching 真实 result 生成唯一 manager 身份 finalization，非法 result 永不产生可 attach 身份；独立 verify=只运行 `agent-launch-result.test.ts`；独立回滚边界=只回滚 Agent tool_result 状态机与该测试。

#### P-17 / T-28 Agent child attach

- 落点/refs: 修改 policy，新增 `agent-child-attach.test.ts`；覆盖 R-21、R-22、R-23、AC-23、AC-24、AC-25。
- child 首次 attach 必须匹配 finalized pending、exact manager session name/role、nonce/token hash、final invocation hash、task 与 child permit；launching 时返回可重试 not-finalized且不消费，wrong session/role/hash 不消费，首次全匹配原子 attached，重放拒绝。
- 原子性证明: 根因=finalized launcher 身份仍需与实际 child session 一次性绑定；独立输入/结果=只有 exact child session attach 成功并激活独立 permit，抢占与重放失败；独立 verify=只运行 `agent-child-attach.test.ts`；独立回滚边界=只回滚 child attach 转换与该测试。

#### P-18 / T-29 SubagentWorkflow envelope

- 落点/refs: 修改入口与 policy，新增 `workflow-launch-envelope.test.ts`；覆盖 R-21、R-22、AC-23、AC-24。
- matching workflow grant 绑定完整原始 input、workflow identity 与 task；只接受 object/undefined args，在不可覆盖的 `args.decisionGate` 注入 envelope，生成 final hash，durable consume parent use并写 launching pending。resume 与预置 namespace 拒绝。
- 原子性证明: 根因=Workflow 的 args 是向内部 agent 传播 task capability 的唯一受控入口；独立输入/结果=合法顶层 call 得到绑定 pending/envelope，namespace 冲突或 grant 漂移在启动前失败；独立 verify=只运行 `workflow-launch-envelope.test.ts`；独立回滚边界=只回滚 Workflow tool_call preflight 与该测试。

#### P-19 / T-30 SubagentWorkflow result finalization

- 落点/refs: 修改入口与 policy，新增 `workflow-launch-result.test.ts`；覆盖 R-18、R-21、R-22、AC-19、AC-23、AC-24。
- matching result 仅接受精确 `{taskId}` 且 id 匹配 `^wf_[0-9a-f]{12}$`，append/fsync唯一 finalized run binding；缺/多字段、非法 id、input 漂移、isError 或 prose-only id 失败。顶层 workflow 不伪装成 child attach。
- 原子性证明: 根因=Workflow preflight 不能证明真实 run 已由 launcher 创建；独立输入/结果=可信 tool_result 绑定唯一 run id，任何非封闭 details 都不可放行；独立 verify=只运行 `workflow-launch-result.test.ts`；独立回滚边界=只回滚 Workflow tool_result finalization 与该测试。

#### P-20 / T-31 readiness 与 no-extra-runtime

- 落点/refs: 修改入口与 policy，新增 `readiness.test.ts`；覆盖 R-18、R-22、R-25、AC-19、AC-24、AC-28。
- `decision_gate_status` 报告 ready/reason；仅在 hooks、tool schemas、T-6 writer import、Pi API、cache/journal schema全部可用后 ready。检查不 spawn 外部解释器/编译器/helper，不探测非必需 executable；任一失败保持 hooks 生效与 ready false。
- 原子性证明: 根因=零散工具可注册不代表强制层所有前置能力可用；独立输入/结果=仅 Pi runtime 环境完成 readiness，缺任一必需能力稳定关闭；独立 verify=只运行 `readiness.test.ts`；独立回滚边界=只回滚 readiness 聚合器与该测试。

#### P-21 / T-32 Pi package 安装与发现

- 落点/refs: 新增 `/Users/bb/.pi/agent/package.json` 与 `package-install.test.ts`；覆盖 R-25、AC-28。
- manifest 显式发布 decision-gate extension 与 spec-docs skill；只声明 Pi/TypeBox peer dependencies，无 runtime dependencies。测试在临时安装根通过真实 DefaultResourceLoader/ExtensionRunner发现资源并取得 ready，不依赖 PATH 中额外 runtime。
- 原子性证明: 根因=本地自动发现成功不能证明可安装 package 的 manifest/resource layout 正确；独立输入/结果=安装同一 package 后 loader 精确发现 gate/writer skill 并进入 ready；独立 verify=只运行 `package-install.test.ts`；独立回滚边界=只删除 package manifest 与该安装测试。

### 2.4 P-22～P-27：角色 extension 加载与权限

六个角色分别规划，因为任一角色的加载或工具暴露都能独立失败。frontmatter 使用 `extensions: decision-gate`，`tools` 只暴露该角色所需 built-in read 工具与 `ext:decision-gate/...` guarded tools；raw edit/write/bash 不作为可写入口。

#### P-22 / T-33 planner 权限

- 落点/refs: 修改 `planner.md`，新增 `planner-gate-role.test.ts`；覆盖 R-22、R-26、AC-24、AC-29。
- planner 只可用 guarded write/edit 修改调用方指定 design.md/tasks.md，并须运行 task lint；其他文件与 raw mutation 阻断。
- 原子性证明: 根因=planner 仍 `extensions:false` 且持有 raw write；独立输入/结果=真实 planner registry 仅暴露规划范围 guarded mutation；独立 verify=只运行 `planner-gate-role.test.ts`；独立回滚边界=只回滚 planner gate frontmatter/说明与该测试。

#### P-23 / T-34 test-engineer 权限

- 落点/refs: 修改 `test-engineer.md`，新增 `test-gate-role.test.ts`；覆盖 R-22、R-23、AC-25。
- test-engineer 只可 attach 测试文件 create/replace permit并用 exact command executor建立 Red/baseline，生产文件拒绝。
- 原子性证明: 根因=Test 可写角色当前没有强制许可且持有 raw mutation；独立输入/结果=测试范围 guarded write 成功，生产路径与无许可写失败；独立 verify=只运行 `test-gate-role.test.ts`；独立回滚边界=只回滚 Test 角色配置与该测试。

#### P-24 / T-35 impl-engineer 权限

- 落点/refs: 修改 `impl-engineer.md`，新增 `impl-gate-role.test.ts`；覆盖 R-22、R-23、AC-25。
- impl-engineer 只可 attach 生产实现文件 permit并执行 exact verify；测试路径与 raw mutation 拒绝。
- 原子性证明: 根因=Impl 可写角色当前没有强制许可且持有 raw mutation；独立输入/结果=实现范围 guarded write 成功，测试路径与无许可写失败；独立 verify=只运行 `impl-gate-role.test.ts`；独立回滚边界=只回滚 Impl 角色配置与该测试。

#### P-25 / T-36 review-engineer 权限

- 落点/refs: 修改 `review-engineer.md`，新增 `review-gate-role.test.ts`；覆盖 R-4、R-23、AC-4、AC-25。
- review-engineer 加载 gate 以受 hook 约束，但不签发/attach mutation permit，不暴露 guarded write/command；唯一名称保持 review-engineer。
- 原子性证明: 根因=只读工具列表不足以证明 reviewer session 已加载强制 hook；独立输入/结果=真实角色 registry/session 可读但所有 mutation 尝试被 gate 拒绝；独立 verify=只运行 `review-gate-role.test.ts`；独立回滚边界=只回滚 Review 角色 gate 配置与该测试。

#### P-26 / T-37 acceptance-reviewer 权限

- 落点/refs: 修改 `acceptance-reviewer.md`，新增 `acceptance-gate-role.test.ts`；覆盖 R-22、R-23、AC-24、AC-25。
- acceptance-reviewer 加载 gate；角色本身不持有通用写许可，后续只 attach 指定 acceptance.md 与受控黑盒命令许可。
- 原子性证明: 根因=验收者当前 raw write/bash 可越过报告边界；独立输入/结果=角色无许可时任何写入失败且不暴露 raw mutation；独立 verify=只运行 `acceptance-gate-role.test.ts`；独立回滚边界=只回滚 Acceptance 角色 gate 配置与该测试。

#### P-27 / T-38 pre-reviewer 权限

- 落点/refs: 修改 `pre-reviewer.md`，新增 `pre-review-gate-role.test.ts`；覆盖 R-22、R-23、AC-24、AC-25。
- pre-reviewer 加载 gate并保持只读，不持有修复、push 或 PR/MR permit；远端动作只能由主 agent 在后续独立门禁执行。
- 原子性证明: 根因=pre-reviewer 当前 raw bash 能表达远端写且没有 hook；独立输入/结果=真实角色 session 可读审查证据但 mutation/remote tool 不可用；独立 verify=只运行 `pre-review-gate-role.test.ts`；独立回滚边界=只回滚 Pre-review 角色 gate 配置与该测试。

### 2.5 P-28～P-31：TDD workflow 接入

#### P-28 / T-39 串行结构化 TDD 门禁

- 落点/refs: 修改 `AGENTS.md` 与 `spec-flow/SKILL.md`，新增 `tdd-serial-gate.test.ts`；覆盖 R-1、R-2、R-3、R-6、R-7、R-8、AC-1、AC-2、AC-3、AC-6、AC-7、AC-9。
- 一个 task 一个 SubagentWorkflow，严格 Test→Impl→Review；三阶段带 JSON Schema、结构化 PASS 语义谓词和 evidence。可信 Green baseline 仍走 no-change Impl 与 Review。只有 Review PASS/GO 后才运行该 task 唯一 verify，exit 0 后 done；任何 null/非法/矛盾对象失败关闭。
- 原子性证明: 根因=当前三阶段基础规则没有和新强制 gate 的单 task 完成谓词形成一个可执行闭环；独立输入/结果=执行一个 TDD task 只产生一条串行阶段链并在 GO+verify 后完成；独立 verify=只运行 `tdd-serial-gate.test.ts`；独立回滚边界=只回滚 TDD 核心状态机与该测试。

#### P-29 / T-40 workflow 展示

- 落点/refs: 修改 `spec-flow/SKILL.md`，新增 `workflow-presentation.test.ts`；覆盖 R-9、R-10、AC-10、AC-11、AC-12。
- `meta.name` 精确为任务编号+标题；阶段标题固定“测试/实现/审查”，节点 label 是任务化工作，不是角色名。并行 tasks 各建同级独立 workflow/run id，禁止一个 workflow 遍历多个 task。
- 原子性证明: 根因=执行正确不保证用户看到 task 身份与独立阶段视图；独立输入/结果=启动一个或两个并行 task 时 UI metadata 精确呈现独立标题/节点/run id；独立 verify=只运行 `workflow-presentation.test.ts`；独立回滚边界=只回滚 workflow metadata 生成规则与该测试。

#### P-30 / T-41 快照、补审与续接

- 落点/refs: 修改 `spec-flow/SKILL.md`，新增 `tdd-resume-snapshot.test.ts`；覆盖 R-5、R-8、AC-5、AC-9。
- 每 task/每返修轮保留 before、Test-only、after 与 diff 的临时快照；未接受旧 task 缺 Review 时先补审。结构化结果只在 workflow 内存，tasks.agent 仅记 run id；无法恢复有效结构化阶段结果时从第一个不可证明阶段重跑，不从 prose 推断。
- 原子性证明: 根因=中断恢复若没有精确快照与结构化阶段证据会跳过 Review 或复用错误 diff；独立输入/结果=恢复缺 Review/缺阶段对象的 task 时只从正确门禁点继续；独立 verify=只运行 `tdd-resume-snapshot.test.ts`；独立回滚边界=只回滚快照/补审/续接规则与该测试。

#### P-31 / T-42 workflow permit 接入

- 落点/refs: 修改 `AGENTS.md` 与 `spec-flow/SKILL.md`，新增 `workflow-permit-integration.test.ts`；覆盖 R-21、R-22、R-23、AC-23、AC-24、AC-25。
- 主 agent 为 workflow launcher 与每阶段 child 分开签发 permit；workflow 读取只读 `args.decisionGate`，每次 `agent()` 把专属 envelope/token 传给真实 child attach。Test/Impl 只使用各自 taskPaths，Review 无 mutation permit；parent/child use 不共享。
- 原子性证明: 根因=launcher 安全握手存在不等于 TDD workflow 内部 child 实际取得正确阶段许可；独立输入/结果=真实三阶段 workflow 中 Test/Impl exact attach 且越权失败、Review 无写许可；独立 verify=只运行 `workflow-permit-integration.test.ts`；独立回滚边界=只回滚 TDD capability 传播规则与该测试。

### 2.6 P-32～P-37：直接审查门禁与限定动作

#### P-32 / T-43 acceptance 直接严格 JSON

- 落点/refs: 修改 `acceptance-reviewer.md` 与 `spec-flow/SKILL.md`，新增 `acceptance-direct-json.test.ts`；覆盖 R-8、R-12、AC-8、AC-9。
- 主 agent 以后台 Agent 直接调用 acceptance-reviewer，不启动 SubagentWorkflow；gate 只允许主 agent 用 matching finalized agent id 的可信 get_subagent_result 取得完整返回。返回值必须恰为一个 JSON object，经 closed schema与业务谓词校验；前后文字、Markdown、解析失败、缺字段或矛盾均 FAIL。
- 原子性证明: 根因=当前 acceptance 仍依赖 workflow StructuredOutput，违反直接严格 JSON 契约；独立输入/结果=matching 直接 Agent 的完整 JSON 唯一决定验收 gate，错误 agent 结果或任意包裹文本失败；独立 verify=只运行 `acceptance-direct-json.test.ts`；独立回滚边界=只回滚 Acceptance 直接裁决传输与该测试。

#### P-33 / T-44 acceptance.md 报告许可

- 落点/refs: 修改 acceptance 角色、spec-flow 与 gate policy，新增 `acceptance-report-permit.test.ts`；覆盖 R-21、R-22、R-23、AC-23、AC-24、AC-25。
- 仅在 accepting 且既有验收 task permit 下为该 slug 的指定 `acceptance.md` 签发 replace/create 一次许可；生产、测试、requirements/design/tasks 与其他 slug 拒绝。主 agent 重读报告 frontmatter/items与严格 JSON一致。
- 原子性证明: 根因=验收者需要写报告但不能因此获得通用写能力；独立输入/结果=指定 report 写入成功，任何其他路径保持不变；独立 verify=只运行 `acceptance-report-permit.test.ts`；独立回滚边界=只回滚报告 permit 特例与该测试。

#### P-34 / T-45 黑盒命令执行许可

- 落点/refs: 修改 acceptance 角色、spec-flow 与 gate policy，新增 `acceptance-command-permit.test.ts`；覆盖 R-12、R-22、R-23、AC-8、AC-15、AC-24、AC-25。
- 调用方从已确认 AC 的启动方式/命令触发生成封闭 executable/argv/env/cwd grant；acceptance-reviewer 只通过 guarded command tool执行这些 exact plans。未在 AC/启动输入中的命令、shell 串与 mutation 命令拒绝。
- 原子性证明: 根因=报告许可不能授权验收者运行黑盒触发且 raw bash 不能安全开放；独立输入/结果=已绑定验收命令可执行并返回原样观察，任意额外命令不 spawn；独立 verify=只运行 `acceptance-command-permit.test.ts`；独立回滚边界=只回滚验收 command grant 与该测试。

#### P-35 / T-46 pre-reviewer 直接严格 JSON

- 落点/refs: 修改 `pre-reviewer.md` 与 `git-push/SKILL.md`，新增 `pre-review-direct-json.test.ts`；覆盖 R-8、R-11、AC-8、AC-9。
- 主 agent 直接调用 Agent，不启动 workflow。完整返回值恰为一个 JSON object，经 closed schema与 PASS/FAIL 谓词校验；自然语言、首行、Markdown、substring 或对象矛盾均失败。
- 原子性证明: 根因=当前 pre-reviewer 仍由单 Agent workflow 调用；独立输入/结果=直接 Agent 的完整严格 JSON 是唯一放行输入，文本结果无法放行；独立 verify=只运行 `pre-review-direct-json.test.ts`；独立回滚边界=只回滚 Pre-review 直接裁决路径与该测试。

#### P-36 / T-47 pre-review 需求与快照绑定

- 落点/refs: 修改 `git-push/SKILL.md`，新增 `pre-review-binding.test.ts`；覆盖 R-11、R-17、R-18、R-20、AC-14、AC-18、AC-19、AC-22。
- 调用前计算 requirementDir/requirements hash、task ids、REVIEW_HEAD 与覆盖 tracked/untracked 的 fingerprint；严格结果必须回指这些值，PASS 后、push 前和创建前由调用方重算。需求、HEAD 或内容变化使 PASS 失效并重新审查。
- 原子性证明: 根因=严格 JSON 格式正确仍可能回指错误需求或过期代码；独立输入/结果=仅与当前需求和不可变快照一致的 PASS 可进入远端动作准备；独立 verify=只运行 `pre-review-binding.test.ts`；独立回滚边界=只回滚需求/快照谓词与该测试。

#### P-37 / T-48 远端命令许可

- 落点/refs: 修改 `git-push/SKILL.md` 与 gate policy，新增 `remote-command-permit.test.ts`；覆盖 R-11、R-18、R-20、R-21、R-22、R-23、AC-14、AC-19、AC-22、AC-23、AC-24、AC-25。
- 主 agent 仅在有效 pre-review PASS、快照重验与必要决定 receipt 后签发 remote permit；guarded remote tool 以 argv 调用非强推 `git push origin <REVIEW_HEAD>:refs/heads/<BRANCH>`，再只读核对 remote SHA，最后允许绑定同一 source branch 的 gh/glab create。reviewer 无该 permit。
- 原子性证明: 根因=审查 PASS 本身不能阻止 raw shell 执行越界远端写；独立输入/结果=精确已审 push/create plan 可执行，缺 receipt/过期快照/错 ref/force/额外 argv 全部不 spawn；独立 verify=只运行 `remote-command-permit.test.ts`；独立回滚边界=只回滚 remote guarded tool 与 git-push 接入测试。

### 2.7 P-38～P-39：统一归因和有界返修

#### P-38 / T-49 三类 Review 自动归因与路由

- 落点/refs: 修改 `AGENTS.md`、`spec-flow/SKILL.md`、`git-push/SKILL.md`，新增 `reviewer-repair-routing.test.ts`；覆盖 R-3、R-13、R-14、R-16、R-17、R-18、R-28、AC-3、AC-13、AC-14、AC-15、AC-16、AC-18、AC-19、AC-26、AC-31。
- 对 review/pre/acceptance 的每个 issue 归类为：当前 task 直接违反、其他独立 problem、产品决策。当前技术问题在既有范围内自动派 Test/Impl 后重审；独立 problem 走 P-4 新任务；产品决策询问用户，只有形成选择才先写用户决定。材料性 AI 路径先写 AI 决定；记录失败不执行动作。
- 原子性证明: 根因=三个 reviewer 的失败处理没有统一、可审计且不扩张当前 task 的路由；独立输入/结果=一个 reviewer FAIL 被唯一归类并进入对应动作分支，未回答问题无 ledger 行；独立 verify=只运行 `reviewer-repair-routing.test.ts`；独立回滚边界=只回滚统一归因/路由规则与该测试。

#### P-39 / T-50 三轮返修上限

- 落点/refs: 修改 `AGENTS.md`、`spec-flow/SKILL.md`、`git-push/SKILL.md`，新增 `reviewer-repair-limit.test.ts`；覆盖 R-15、AC-17。
- 每个 reviewer gate 单独计轮次；每轮包含归因、许可内修复、验证和原 reviewer 重审。最多三轮，第 3 次仍 FAIL 时记录技术阻塞并停止，不转成用户产品问题，不追加纯机械状态决定。
- 原子性证明: 根因=自动路由正确仍可能因没有统一计数而无限返修；独立输入/结果=连续失败恰执行三轮后停止且后续动作数为零；独立 verify=只运行 `reviewer-repair-limit.test.ts`；独立回滚边界=只回滚轮次计数/停止规则与该测试。

### 2.8 R-n 到文件/Problem 落点

| 需求 | 主要落点 |
|---|---|
| R-1～R-3 | P-28、P-38：`AGENTS.md`、`spec-flow/SKILL.md` |
| R-4 | 历史 T-1；P-25：`review-engineer.md` |
| R-5～R-8 | P-28、P-30：`AGENTS.md`、`spec-flow/SKILL.md`；P-32/P-35 直接 JSON |
| R-9～R-10 | P-29：`spec-flow/SKILL.md` |
| R-11 | P-35～P-37：`pre-reviewer.md`、`git-push/SKILL.md`、gate policy |
| R-12 | P-32～P-34：`acceptance-reviewer.md`、`spec-flow/SKILL.md`、gate policy |
| R-13～R-16 | P-38～P-39：三类 reviewer 统一归因和有界返修 |
| R-17～R-20、R-24 | 历史 T-6 writer；P-6/P-7 接入；P-36/P-38 流程绑定 |
| R-21～R-23 | P-8～P-19 强制层；P-22～P-27 角色；P-31/P-33/P-34/P-37 流程接入 |
| R-25 | P-13/P-14/P-20/P-21 的 Node-only compiler、readiness 与 package |
| R-26～R-27 | P-1～P-3/P-5 的格式、planner 与失败关闭 |
| R-28 | P-4、P-38 的独立 issue 新任务路由 |

## 3. 文件清单

### 3.1 规划原子性

| 路径 | 操作 | Problem |
|---|---|---|
| `/Users/bb/.pi/agent/skills/spec-docs/SKILL.md` | 修改 | P-1 |
| `/Users/bb/.pi/agent/skills/spec-docs/scripts/tasks-lint.ts` | 新增 | P-1 |
| `/Users/bb/.pi/agent/skills/spec-docs/__tests__/task-atomicity-lint.test.ts` | 新增 | P-1 |
| `/Users/bb/.pi/agent/agents/planner.md` | 修改 | P-2、P-22（串行） |
| `/Users/bb/.pi/agent/agents/__tests__/planner-atomicity.test.ts` | 新增 | P-2 |
| `/Users/bb/.pi/agent/skills/spec-flow/SKILL.md` | 修改 | P-3、P-4、P-5、P-28～P-34、P-38～P-39（按依赖串行） |
| `/Users/bb/.pi/agent/skills/spec-flow/__tests__/planning-atomicity-gate.test.ts` | 新增 | P-3 |
| `/Users/bb/.pi/agent/skills/spec-flow/__tests__/review-issue-routing.test.ts` | 新增 | P-4 |
| `/Users/bb/.pi/agent/skills/spec-flow/__tests__/incremental-history-boundary.test.ts` | 新增 | P-5 |

### 3.2 decision-gate 与 package

| 路径 | 操作 | Problem |
|---|---|---|
| `/Users/bb/.pi/agent/extensions/decision-gate/index.ts` | 新增后串行修改 | P-6、P-8、P-10、P-15、P-16、P-18～P-20 |
| `/Users/bb/.pi/agent/extensions/decision-gate/policy.ts` | 新增后串行修改 | P-6～P-20、P-32～P-34、P-37 |
| `/Users/bb/.pi/agent/extensions/__tests__/decision-record-schema.test.ts` | 新增 | P-6 |
| `/Users/bb/.pi/agent/extensions/__tests__/receipt-binding.test.ts` | 新增 | P-7 |
| `/Users/bb/.pi/agent/extensions/__tests__/permit-schema.test.ts` | 新增 | P-8 |
| `/Users/bb/.pi/agent/extensions/__tests__/permit-state.test.ts` | 新增 | P-9 |
| `/Users/bb/.pi/agent/extensions/__tests__/hook-provenance.test.ts` | 新增 | P-10 |
| `/Users/bb/.pi/agent/extensions/__tests__/guarded-mutation.test.ts` | 新增 | P-11 |
| `/Users/bb/.pi/agent/extensions/__tests__/atomic-write.test.ts` | 新增 | P-12 |
| `/Users/bb/.pi/agent/extensions/__tests__/verify-compiler.test.ts` | 新增 | P-13 |
| `/Users/bb/.pi/agent/extensions/__tests__/verify-exec.test.ts` | 新增 | P-14 |
| `/Users/bb/.pi/agent/extensions/__tests__/agent-launch-preflight.test.ts` | 新增 | P-15 |
| `/Users/bb/.pi/agent/extensions/__tests__/agent-launch-result.test.ts` | 新增 | P-16 |
| `/Users/bb/.pi/agent/extensions/__tests__/agent-child-attach.test.ts` | 新增 | P-17 |
| `/Users/bb/.pi/agent/extensions/__tests__/workflow-launch-envelope.test.ts` | 新增 | P-18 |
| `/Users/bb/.pi/agent/extensions/__tests__/workflow-launch-result.test.ts` | 新增 | P-19 |
| `/Users/bb/.pi/agent/extensions/__tests__/readiness.test.ts` | 新增 | P-20 |
| `/Users/bb/.pi/agent/package.json` | 新增 | P-21 |
| `/Users/bb/.pi/agent/extensions/__tests__/package-install.test.ts` | 新增 | P-21 |
| `/Users/bb/.pi/agent/extensions/__tests__/acceptance-report-permit.test.ts` | 新增 | P-33 |
| `/Users/bb/.pi/agent/extensions/__tests__/acceptance-command-permit.test.ts` | 新增 | P-34 |
| `/Users/bb/.pi/agent/extensions/__tests__/remote-command-permit.test.ts` | 新增 | P-37 |

`/Users/bb/.pi/agent/skills/spec-docs/scripts/decision-ledger.ts` 与其既有测试只读复用，不修改。

### 3.3 角色文件与独立权限测试

| 路径 | 操作 | Problem |
|---|---|---|
| `/Users/bb/.pi/agent/agents/__tests__/planner-gate-role.test.ts` | 新增 | P-22 |
| `/Users/bb/.pi/agent/agents/test-engineer.md` | 修改 | P-23 |
| `/Users/bb/.pi/agent/agents/__tests__/test-gate-role.test.ts` | 新增 | P-23 |
| `/Users/bb/.pi/agent/agents/impl-engineer.md` | 修改 | P-24 |
| `/Users/bb/.pi/agent/agents/__tests__/impl-gate-role.test.ts` | 新增 | P-24 |
| `/Users/bb/.pi/agent/agents/review-engineer.md` | 修改 | P-25 |
| `/Users/bb/.pi/agent/agents/__tests__/review-engineer-role.test.ts` | 修改 | P-25 |
| `/Users/bb/.pi/agent/agents/__tests__/review-gate-role.test.ts` | 新增 | P-25 |
| `/Users/bb/.pi/agent/agents/acceptance-reviewer.md` | 修改 | P-26、P-32～P-34（串行） |
| `/Users/bb/.pi/agent/agents/__tests__/acceptance-gate-role.test.ts` | 新增 | P-26 |
| `/Users/bb/.pi/agent/agents/pre-reviewer.md` | 修改 | P-27、P-35（串行） |
| `/Users/bb/.pi/agent/agents/__tests__/pre-review-gate-role.test.ts` | 新增 | P-27 |

### 3.4 workflow、直接审查与返修测试

| 路径 | 操作 | Problem |
|---|---|---|
| `/Users/bb/.pi/agent/AGENTS.md` | 修改 | P-28、P-31、P-38～P-39（串行） |
| `/Users/bb/.pi/agent/skills/spec-flow/__tests__/mandatory-review-gate.test.ts` | 修改 | P-28、P-38、P-39（串行） |
| `/Users/bb/.pi/agent/skills/spec-flow/__tests__/tdd-serial-gate.test.ts` | 新增 | P-28 |
| `/Users/bb/.pi/agent/skills/spec-flow/__tests__/workflow-presentation.test.ts` | 新增 | P-29 |
| `/Users/bb/.pi/agent/skills/spec-flow/__tests__/tdd-resume-snapshot.test.ts` | 新增 | P-30 |
| `/Users/bb/.pi/agent/skills/spec-flow/__tests__/workflow-permit-integration.test.ts` | 新增 | P-31 |
| `/Users/bb/.pi/agent/skills/spec-flow/__tests__/acceptance-direct-json.test.ts` | 新增 | P-32 |
| `/Users/bb/.pi/agent/skills/spec-flow/__tests__/acceptance-structured-gate.test.ts` | 修改 | P-32 |
| `/Users/bb/.pi/agent/skills/spec-flow/__tests__/reviewer-repair-routing.test.ts` | 新增 | P-38 |
| `/Users/bb/.pi/agent/skills/spec-flow/__tests__/reviewer-repair-limit.test.ts` | 新增 | P-39 |
| `/Users/bb/.pi/agent/skills/git-push/SKILL.md` | 修改 | P-35～P-39（按依赖串行） |
| `/Users/bb/.pi/agent/skills/git-push/__tests__/pre-review-direct-json.test.ts` | 新增 | P-35 |
| `/Users/bb/.pi/agent/skills/git-push/__tests__/pre-reviewer-gate.test.ts` | 修改 | P-35～P-37（串行） |
| `/Users/bb/.pi/agent/skills/git-push/__tests__/pre-review-binding.test.ts` | 新增 | P-36 |

不在实施任务中修改当前需求的 `requirements.md`、两个 ledger、`acceptance.md` 或现行规范；`acceptance.md` 仅在全部任务完成后的黑盒验收阶段由限定许可写入。

## 4. 数据与接口变更

### 4.1 tasks 原子格式与 lint CLI

新任务块字段固定为：

```text
### T-n <标题>
- depends_on: [T-a, ...]
- problem: P-n
- files: [<absolute-path>, ...]
- refs: [R-x, AC-y, ...]
- parallel: true | false
- verify: <single non-empty command line>
- status: todo | doing | done | failed
- step: test | impl | review | <empty>
- agent: <id or empty>
- commit: <hash or empty>
- note: <text or empty>
```

历史无 problem 块只允许 `done` 或 `failed`，原 bytes 不迁移。专用命令：

```text
bun /Users/bb/.pi/agent/skills/spec-docs/scripts/tasks-lint.ts --design <absolute-design.md> --tasks <absolute-tasks.md>
```

退出 0 表示结构 PASS。lint 机械校验：每个新任务恰有一个 P id；每个 design P id 恰有一个任务；problem/refs 映射一致；verify 恰一行且非空；编号唯一递增；depends_on 只向更小编号且无环；AC 全覆盖；`parallel:true` 的同时就绪任务文件集不相交。lint 不宣称判断自然语言中的多根因；主 agent 依据第 2 节原子性证明执行语义门禁。

### 4.2 decision_record 与 receipt

```typescript
type DecisionRecordToolInput =
  | {
      requirementDir: string;
      actor: "ai";
      source: string;
      scope: string;
      trigger: string;
      decision: string;
      basis: string[];
      alternatives: string[];
      action: string;
      supersedes?: Array<`AI-${number}` | `USER-${number}`>;
      materiality: Materiality;
    }
  | {
      requirementDir: string;
      actor: "user";
      source: string;
      trigger: string;
      decision: string;
      alternatives: string[];
      impact: string;
      supersedes?: Array<`AI-${number}` | `USER-${number}`>;
      materiality: Materiality;
    };

type Materiality = {
  alternativesExist: true;
  notUniquelyDetermined: true;
  effects: Array<"behavior" | "scope" | "authorization" | "architecture" | "risk" | "recovery" | "flow-branch">;
};

type DecisionReceiptV1 = {
  schema: "decision-receipt/v1";
  receiptId: string;
  decisionId: `AI-${number}` | `USER-${number}`;
  actor: "ai" | "user";
  requirementDir: string;
  ledgerPath: string;
  lineNumber: number;
  decisionHash: string;
  recordedAt: string;
};
```

两个 input 分支及 Materiality 都拒绝未知字段。receipt validator 从 `ledgerPath` 的 `lineNumber` 精确取 canonical JSON+LF，核对 actor/id/time、requirement slug与 SHA-256；同时重验 peer ledger及 accepted freeze。

### 4.3 permit 公共接口

```typescript
type TaskPath = { taskFile: string; operations: Array<"create" | "replace"> };
type ToolInputHash = { tool: string; sha256: string };
type ExactVerify = { command: string; cwd: string };
type LauncherGrant = {
  launcherTool: "Agent" | "SubagentWorkflow";
  originalInputHash: string;
  task: `T-${number}`;
  allowedRoles: string[];
  childPermitId: string;
  workflowIdentity?: string;
};

type PermitIssue = {
  operation: "issue";
  kind: "session" | "child";
  requirementDir: string;
  decisionReceiptId: string;
  task: `T-${number}`;
  audienceRole: string;
  tools: string[];
  taskPaths: TaskPath[];
  toolInputHashes: ToolInputHash[];
  exactVerify?: ExactVerify;
  launcherGrants: LauncherGrant[];
  ttlSeconds: number;
  maxUses: number;
};
type PermitAttach = {
  operation: "attach";
  requirementDir: string;
  permitId: string;
  childNonce: string;
  childToken: string;
  finalInvocationHash: string;
};
type PermitInspect = { operation: "inspect"; requirementDir: string; permitId: string };
type DecisionPermitInput = PermitIssue | PermitAttach | PermitInspect;
```

成品参数 Schema 是三个 `Type.Object` 等价分支的 `oneOf`；各层 closed。`kind:"session"` 可返回 token；`kind:"child"` 的明文 token 只由 launcher hook生成并注入。permit store 增加 taskTitle、taskBindingHash、requirementsHash、tokenHash、issuedAt/expiresAt/maxUses；明文 token 不落盘。

### 4.4 guarded mutation 与状态记录

```typescript
type DecisionEditInput = {
  requirementDir: string; permitId: string; token: string; path: string;
  edits: Array<{ oldText: string; newText: string }>;
};
type DecisionWriteInput = {
  requirementDir: string; permitId: string; token: string; path: string; content: string;
};
type ReservationV1 = {
  schema: "decision-gate-reservation/v1"; permitId: string; use: number;
  tool: string; operationHash: string; targetPath?: string; commandHash?: string;
  cwd?: string; reservedAt: string;
};
type CommitV1 = {
  schema: "decision-gate-commit/v1"; permitId: string; use: number;
  reservationHash: string; resultHash: string; committedAt: string;
};
type RevokeV1 = {
  schema: "decision-gate-revoke/v1"; permitId: string; reason: string; revokedAt: string;
};
```

状态写在 `<repo>/.pi-spec/.cache/decision-gate/<slug>/`，每行 canonical JSON+LF。durable reservation 是唯一 use 消费事实；后续 executor、commit 或 cleanup 失败不返还 use。cache 是临时运行状态，不加入版本控制。

### 4.5 exact verify grammar 与执行

```text
verify         := (env-assignment " ")* executable (" " argv-token)*
env-assignment := ENV_KEY "=" SAFE_VALUE
ENV_KEY        := [A-Za-z_][A-Za-z0-9_]*
SAFE_VALUE     := one-or-more [A-Za-z0-9_@%+,./:=~-]
executable     := one-or-more [A-Za-z0-9_@%+,./:~-] and contains no "="
argv-token     := one-or-more [A-Za-z0-9_@%+,./:=~-]
```

parser 可识别空格/tab 用于判错，但 serializer 固定单 ASCII space；序列化 bytes 必须与原 verify 完全一致。重复 env key、空值、前后 whitespace、quote、escape、`&&`、`||`、`;`、`&`、`<`、`>`、`|`、`$`、反引号、glob、括号、CR/LF/NUL 均拒绝。执行接口：

```typescript
type VerifyPlanV1 = {
  command: string; commandHash: string; cwd: string;
  env: Record<string, string>; executable: string; args: string[]; planHash: string;
};

const result = await pi.exec(plan.executable, plan.args, {
  cwd: plan.cwd,
  env: { ...process.env, ...plan.env },
  signal,
});
```

### 4.6 launcher envelope 与 finalization

```typescript
type GateEnvelopeV1 = {
  schema: "decision-gate-envelope/v1";
  requirementDir: string;
  task: `T-${number}`;
  role?: string;
  workflowIdentity?: string;
  pendingId: string;
  childPermitId: string;
  childNonce: string;
  childToken: string;
  parentPermitId: string;
  parentUse: number;
  finalInvocationHash: string;
};

type PendingLaunchV1 = {
  schema: "decision-gate-pending-launch/v1";
  status: "launching";
  pendingId: string;
  toolCallId: string;
  launcherTool: "Agent" | "SubagentWorkflow";
  parentPermitId: string;
  parentUse: number;
  originalInputHash: string;
  finalInvocationHash: string;
  task: `T-${number}`;
  childPermitId: string;
  childNonceHash: string;
  childTokenHash: string;
  allowedRoles: string[];
  workflowIdentity?: string;
  createdAt: string;
  expiresAt: string;
};
```

Agent finalized 分支含 `managerAgentId`、`expectedSessionName`、role、detailsHash；Workflow finalized 分支含 `workflowRunId`、detailsHash；failed 分支含 reason。每个 pending 只有一个终态。Agent attached 记录绑定 pending/finalization hash、child permit、exact session name、role、final hash和 capability 消费时间。

### 4.7 直接审查严格 JSON

Acceptance 完整对象：

```typescript
type AcceptanceResult = {
  phase: "acceptance";
  verdict: "PASS" | "FAIL";
  summary: string;
  issues: string[];
  evidence: string[];
  acceptanceResult: "accepted" | "rejected";
  reportPath: string;
  items: Array<{ id: string; result: "PASS" | "FAIL"; observed: string; difference: string }>;
  uncovered: string[];
};
```

Pre-review 完整对象：

```typescript
type PreReviewResult = {
  phase: "pre-review";
  verdict: "PASS" | "FAIL";
  summary: string;
  issues: string[];
  evidence: string[];
  requirementDir: string;
  requirementsHash: string;
  taskIds: Array<`T-${number}`>;
  reviewedHead: string;
  contentFingerprint: string;
  blockingFindings: Array<{ severity: "Blocker" | "Important"; location: string; problem: string }>;
};
```

两者由主 agent 直接启动后台 Agent，并通过绑定该 finalized agent id 的可信 get_subagent_result 取得完整返回；不启动 SubagentWorkflow。完整文本只允许一次整对象 JSON parse，随后 closed schema和语义谓词校验；这不是从自然语言提取 verdict。PASS 分支 issues/阻断/未覆盖为空且 evidence 非空；FAIL 分支有可定位问题。主 agent重读外部报告/快照作一致性校验。

### 4.8 acceptance 与 remote command grants

验收命令 grant 绑定 requirement、AC id、完整原始命令、compiled executable/argv/env/cwd 与 TTL；只能由 acceptance-reviewer 使用。远端 grant 绑定 requirement receipt、pre-review result hash、REVIEW_HEAD、fingerprint、source branch、remote、平台与单次操作序列。remote executor 不接受 shell string，仅接受由 policy生成的封闭 argv：非强推 push、只读 remote ref核验、绑定同一 branch 的 gh/glab create。

### 4.9 package manifest 与依赖

`/Users/bb/.pi/agent/package.json` 成品资源声明只包含：

```json
{
  "name": "pi-spec-decision-gate",
  "private": true,
  "keywords": ["pi-package"],
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "typebox": "*"
  },
  "pi": {
    "extensions": ["./extensions/decision-gate/index.ts"],
    "skills": ["./skills/spec-docs"]
  }
}
```

新增第三方依赖：无。package 不声明 runtime `dependencies`，不修改 `/Users/bb/.pi/agent/npm/package.json` 或 lockfile。

## 5. 测试策略

### 5.1 测试层级与隔离

- 每个 P-n 使用一个独立 Bun 测试文件，tasks.verify 只运行该文件；共享 fixture 可在测试文件内部最小定义，不新增跨 problem 巨型 harness。
- P-1～P-5 使用文档/CLI 契约测试，分别验证结构 lint、planner 规则、主 agent 计划门禁、Review 分流和历史执行集。
- P-6～P-21 使用真实 Pi ExtensionRunner/DefaultResourceLoader；公共 schema 必须经过真实 Pi 参数校验。writer failure 使用真实 T-6 `appendDecision()` 的受控 fs failure 注入，不伪造 writer 结果。
- launcher 正向至少一次使用真实 `@tintinweb/pi-subagents` Agent/SubagentWorkflow tool definition与实际 details；反例可对 result 字段做受控 mutation，但不能以手造 prose 作为正向身份。
- mutation 测试覆盖 create/replace、symlink/hardlink/path escape、reservation 前后失败、并发 maxUses、temp identity 与最终 hash；安全断言限于 Pi 控制面和 Node 可观察边界。
- role 测试分别加载实际 frontmatter/registry/session，断言每个角色的 extension 与精确工具能力，不用一个“六角色均通过”的结果替代各角色独立结论。
- workflow 测试分别验证串行门禁、展示、续接、capability 传播；直接 reviewer 测试断言没有 SubagentWorkflow launch。既有复合回归文件由改变其现行断言的对应 task 外科手术式修订，但不作为多个新 task 共用的唯一 verify；每个新 task 仍由自己的小测试给出独立结论。
- 所有任务实施仍走 test-engineer→impl-engineer→review-engineer 的结构化三阶段；每个任务一个 GO/NO-GO。正式 verify 在 Review GO 后运行。

### 5.2 AC 覆盖矩阵

| AC | 覆盖任务 |
|---|---|
| AC-1～AC-3 | 历史 T-2/T-3；T-39、T-49 |
| AC-4 | 历史 T-1；T-36 |
| AC-5 | 历史 T-2；T-41 |
| AC-6～AC-7 | 历史 T-3；T-39 |
| AC-8 | 历史 T-4/T-5；T-43、T-45、T-46 |
| AC-9 | 历史 T-3/T-4/T-5；T-39、T-41、T-43、T-46 |
| AC-10～AC-12 | T-40 |
| AC-13 | T-49 |
| AC-14 | T-47～T-49 |
| AC-15 | T-45、T-49 |
| AC-16 | T-49 |
| AC-17 | T-50 |
| AC-18 | 历史 T-6；T-17、T-47、T-49 |
| AC-19 | 历史 T-6；T-17～T-18、T-21、T-25、T-27、T-30～T-31、T-47～T-49 |
| AC-20～AC-21 | 历史 T-6 |
| AC-22 | 历史 T-6；T-47～T-48 |
| AC-23 | T-19～T-20、T-22、T-24、T-26～T-30、T-42、T-44、T-48 |
| AC-24 | T-19～T-22、T-24～T-31、T-33、T-37～T-38、T-42、T-44～T-45、T-48 |
| AC-25 | T-21～T-22、T-26～T-28、T-34～T-38、T-42、T-44～T-45、T-48 |
| AC-26～AC-27 | 历史 T-6；T-17、T-49 |
| AC-28 | T-25、T-31～T-32 |
| AC-29 | T-12～T-14、T-33 |
| AC-30 | T-12、T-14、T-16 |
| AC-31 | T-15、T-49 |

### 5.3 规划静态自检

- P-1～P-39 各出现一次且只映射 T-12～T-50 中一个任务。
- 全部 R-1～R-28 与 AC-1～AC-31 至少出现在一个历史或新任务 refs 中。
- depends_on 只向更小编号；共享 `index.ts`/`policy.ts`、`spec-flow/SKILL.md`、`git-push/SKILL.md` 的任务均串行。
- 仅 T-12/T-17 与 T-34～T-38 标记为可并行候选；任意两个标记为 parallel 的新任务文件集不相交且互不依赖。
- 所有新任务 status 为 todo，step/agent/commit/note 为空；每个 verify 是一个独立、退出 0 才通过的命令。

## 6. 备选方案与取舍

### 方案 A：P-n 一对一任务、结构 lint 加主 agent 语义门禁、共享文件串行（采用）

新增最小 `problem: P-n` 与专用 lint，planner 先写 problem register及四维证明，主 agent 再判断可独立失败/审查/回滚的语义。强制层按公共输入、状态、hook、mutation、executor、两类 launcher、readiness逐问题实现；共享 extension 或 skill 文件通过 depends_on 串行，不合并问题。

### 方案 B：只把 planner 文案从“一组行为”改成“一个问题”（否定）

没有 machine id、lint、状态门禁和 Review 新任务规则时，planner 仍可输出复合任务，主流程也会直接进入 planned/executing；只能缓解提示词症状。

### 方案 C：一个 decision-gate 大任务加一个综合测试（否定）

公共 schema、receipt、permit store、hook、原子写、verify、Agent、Workflow、readiness可分别失败和回滚。合并会再次形成 T-7 的单一 NO-GO 覆盖多个根因，违反 R-26/R-27 与 USER-037。

### 方案 D：按文件拆 task（否定）

`index.ts`/`policy.ts` 是共享集成点，按文件会把多个独立能力塞进同一 task；反过来强制一个 task 一个文件又会拆断同一纵向行为的测试与实现。正确边界是独立问题，文件冲突只决定依赖。

### 方案 E：用正则判定自然语言语义原子性（否定）

正则可校验单 problem id、字段和映射，不能可靠判断两个根因或两个回滚边界。声称 lint 完整判定语义会产生假安全，因此语义审查必须由 planner 自检加主 agent 计划门禁完成。

### 根源性自检

1. 是否触及根源：是。T-7 失败的根源既包括复合任务粒度，也包括公共 schema、receipt、真实 verify 和 launcher identity 等可独立裁决问题；P-n 一对一和门禁让每个根因有自己的 Red/Green/GO/verify/回滚边界，而不是仅缩短标题或增加提示词。
2. 是否有更优做法：在不新增第三方依赖、不修改 T-6 writer、不迁移历史任务且必须使用现有 Pi 控制面的约束下，按独立问题拆分并以 shared-file dependency 串行，比按 AC、按文件或单一 extension 大任务更直接；没有更小方案能同时机械阻断结构错误并对语义复合失败关闭。

推荐方案 A。成品不提供旧粒度回退、不复用 T-7/T-8～T-11 编号、不引入额外 runtime，也不把任何两个可独立失败能力重新合并。
