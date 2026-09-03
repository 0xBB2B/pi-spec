---
name: git-push
description: 完整 PR/MR 提交流程在本地 commit 后直接调用 pre-reviewer 审查，只有严格 JSON 的 verdict PASS 且快照一致才可放行 push 或创建 PR/MR；用户要求提交 PR、Pull Request、Merge Request 或调用 `/skill:git-push` 时使用。
---

# 提交 PR/MR

## 核心原则

优先服从目标仓库自己的贡献指南、PR 模板、commit 历史和发布约定；只有仓库没有可用证据时，才使用本 skill 的通用 fallback。

- commit 标题和 PR 标题分别根据各自用途生成；
- PR 正文聚焦可审阅信息，并以真实的测试、release note、issue 关联和 reviewer 安排为依据；
- 任何 push 或 PR/MR 创建前必须先完成第 7 节的 pre-reviewer 审查；只有严格 JSON 明确的 `verdict: PASS` 且审查快照一致时才可继续。不可用、调用失败、回复非法或快照不一致时 fail closed；合法严格 JSON `verdict: FAIL` 按第 7 节的归因、自动返修或产品升级路径处理。

## 适用边界

只在用户明确要求提交 PR、Pull Request、Merge Request，或显式调用 `/skill:git-push` 时执行。

这个 skill 负责：

- 检查当前仓库、分支、改动和远端状态；
- 识别仓库原生的 commit、PR、DCO、签名、changelog 和 backport 约定；
- 根据项目已经定义的命令运行适用的测试、类型检查、lint 或构建；
- 为当前工作区改动创建符合项目约定的 commit；
- 推送当前分支；
- 使用 `gh` 创建 GitHub Pull Request，或使用 `glab` 创建 GitLab Merge Request；
- 输出提交结果、验证结果和 PR/MR 地址。

这个 skill 不负责：

- 合并、关闭、批准或修改已有 PR/MR；
- 强制推送、重写远端历史或跳过 Git hooks；
- 把用户未要求的文件加入提交；
- 通过浏览器、REST API 或手写 API 请求完成 PR/MR 操作；
- 替换仓库已有的 PR 模板或贡献流程。

## 工具原则

- GitHub 远端优先使用 `gh`：认证检查、仓库信息、已有 PR 检查和 PR 创建都使用 `gh`。
- GitLab 远端优先使用 `glab`：认证检查、仓库信息、已有 MR 检查和 MR 创建都使用 `glab`。
- 本地工作区没有等价的 `gh` 或 `glab` 操作，因此状态、diff、暂存、commit 和 push 使用原生 `git`；不能为了形式上的“全程 gh/glab”而绕过本地 Git 语义。
- 只使用非破坏性 push：`git push origin "${REVIEW_HEAD}:refs/heads/${BRANCH}"`。push 被拒绝时停止，不使用 `--force`、`--force-with-lease` 或其他覆盖远端历史的选项。
- 不使用 `--no-verify` 绕过 hooks。

## 执行流程

### 1. 预检

在仓库根目录执行并记录：

```bash
git rev-parse --show-toplevel
git status --short --branch
git branch --show-current
git remote get-url origin
git diff --stat
git diff --cached --stat
```

然后确认：

- 当前目录是 Git 仓库；
- 当前分支不是 detached HEAD，也不是默认分支或主分支；
- 无论远端默认分支如何配置，以下主分支名称都禁止直接提交或推送：`main`、`master`、`trunk`、`develop`、`production`、`stable`，匹配这些名称的大小写变体也禁止直接提交或推送；
- `origin` 远端存在且属于 GitHub 或 GitLab；
- 当前工作区中的文件都属于本次需求；
- 没有来源不明的未跟踪文件、用户未授权的 staged 文件或无关改动。

如果当前位于主分支，不要直接停止；先根据实际改动给出 2 个具体分支名建议，并询问用户是否切换。例如：

- Bug 修复：`fix/<scope>-<short-description>`；
- 功能改动：`feat/<scope>-<short-description>`；
- 文档改动：`docs/<short-description>`。

建议名应使用短横线、小写英文和实际 scope，例如：

- `fix/subagent-cluster-decision-flow`；
- `fix/subagent-cluster-dashboard-layout`；
- `docs/contribution-workflow`。

主分支切换询问必须提供以下选择：

1. 创建并切换到推荐的新分支；
2. 切换到用户指定的已有分支；
3. 使用用户自定义分支名。

用户拒绝切换时停止，不创建 commit、不 push、不创建 PR/MR。

用户确认后：

```bash
git switch -c <branch>
```

或：

```bash
git switch <branch>
```

切换完成后重新执行分支和工作区预检。若切换失败，停止并报告，不绕过冲突或覆盖用户改动。

确认 `gh` 或 `glab` 已安装并且对应平台认证有效：

```bash
# GitHub
gh auth status --hostname <host>

# GitLab
glab auth status --hostname <host>
```

认证失败时停止，提示用户完成对应 CLI 登录；不要读取、输出或请求 token。

使用平台 CLI 获取默认分支：

```bash
# GitHub
gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'

# GitLab
glab repo view --output json
```

GitLab 的默认分支从 `glab repo view --output json` 返回结果中读取。无法可靠读取时停止并让用户明确指定目标分支。

### 2. 识别仓库原生规范

在拟定 commit 或 PR 文案前，先读取适用的贡献文档、PR 模板和发布配置：

```bash
find .github -maxdepth 3 -type f -print 2>/dev/null | sort
find . -maxdepth 2 -type f \( \
  -iname 'CONTRIBUTING*' -o \
  -iname '*PULL_REQUEST_TEMPLATE*' -o \
  -iname '*COMMIT*GUIDE*' -o \
  -iname '*CHANGELOG*' -o \
  -iname '*RELEASE*NOTE*' -o \
  -iname 'CODEOWNERS' -o \
  -iname '.commitlintrc*' -o \
  -iname 'commitlint.config.*' \
\) -print 2>/dev/null | sort
```

至少检查：

- `CONTRIBUTING.md`、`CONTRIBUTING.rst`；
- `.github/CONTRIBUTING.md`；
- `.github/PULL_REQUEST_TEMPLATE.md`、`.github/pull_request_template.md`；
- `.github/PULL_REQUEST_TEMPLATE/` 下的模板；
- `docs/contributing/`、`contributing-docs/`；
- `CHANGELOG.md`、`newsfragments`、`whatsnew` 或 `.changes`；
- commitlint、DCO、签名、CODEOWNERS 和 backport 配置。

再读取最近的历史样本：

```bash
git log --format='%H%n%s%n%b%n---' -n 30
```

平台允许时，再读取最近的已合并 PR/MR，观察实际写法：

```bash
# GitHub
gh pr list --state merged --limit 10 --json number,title,body,url

# GitLab
glab mr list --state merged --per-page 10 --output json
```

按以下证据优先级判断规范：

1. 仓库贡献指南中的明确要求；
2. PR 模板中的字段、checklist 和自动化指令；
3. commitlint、DCO、签名、changelog 或 backport 配置；
4. 最近合并的非机器人 commit 和 PR；
5. 语言生态或组织级惯例；
6. 本 skill 的通用 fallback。

识别时排除 release bot、依赖升级 bot、merge bot 和纯同步 commit，避免把自动化文案误判成开发者提交规范。

在内部形成一份简短的“仓库约定摘要”，至少包含：

- commit 标题格式或类别前缀；
- commit 正文是否常用、是否有固定时态或标点；
- 必须存在的 trailers，例如 `Signed-off-by`、`Co-authored-by`、`PR-URL`；
- PR 标题格式；
- PR 模板必填字段；
- issue 关联关键词，例如 `Fixes`、`Closes`、`Refs`；
- release note、changelog、newsfragment、backport、security 或 rollback 要求；
- 测试、benchmark、截图或录屏要求。

如果文档和历史样本冲突，优先执行文档中的明确要求；如果仍然无法判断，采用最近的多个非机器人样本的共同写法，并在用户确认摘要中说明这个判断。

### 3. 检查已有 PR/MR

创建前必须确认当前分支没有已有的开放 PR/MR，避免重复创建：

```bash
# GitHub
gh pr view --json url,state,isDraft,baseRefName,headRefName

# GitLab
glab mr list --source-branch <branch> --output json
```

命令成功并返回已有开放 PR/MR 时，停止创建动作，输出已有地址并询问用户是否要改为更新流程。本 skill 不自动修改已有 PR/MR。

### 4. 了解改动并拟定文案

完整阅读以下内容后再拟定提交和 PR/MR 文案：

```bash
git status --short
git diff
git diff --cached
git log --oneline --decorate -n 10
```

确认改动范围只包含本次需求。发现无关改动、来源不明的未跟踪文件或用户未授权的 staged 文件时，先列出文件并等待处理，不使用 `git add -A`。

#### Commit 标题规则

- 如果仓库文档明确规定格式，严格遵循仓库格式；
- 否则根据最近非机器人 commit 推断标题风格；
- 如果仓库使用组件或子系统前缀，保留该前缀；
- 如果仓库使用 `BUG`、`DOC`、`TST`、`CI` 等类别，使用该类别；
- 如果仓库使用 issue、ticket 或 PR 编号，按仓库格式加入；
- 如果仓库没有可识别的约定，才使用以下 fallback：

```text
<type>(<scope>): <short imperative subject>
```

fallback 中优先使用 `feat`、`fix`、`docs`、`refactor`、`perf`、`test`、`build`、`ci` 或 `chore`。标题简洁、描述实际意图，不以句号结尾，除非仓库明确要求句号。

#### Commit 正文规则

- 根据仓库历史决定正文形式；仓库偏好短 commit 时只生成标题；
- 仓库有固定正文格式时严格遵循；
- 改动复杂、需要保留设计原因或仓库历史明显使用正文时，生成正文；
- 正文使用简洁自然段说明问题、实现和关键边界；
- 只添加仓库实际要求的 trailers；
- 不把 PR 正文整段复制到每一个 commit。

通用 fallback 正文可以采用：

```text
<问题或根因>

<实现方式与关键边界>

<必要的兼容性、测试或用户影响>
```

#### PR 标题规则

PR 标题和 commit 标题分别生成：

- 优先遵循仓库 PR 模板或贡献指南；
- 如果标题会进入 changelog，使用用户可理解的影响描述；
- 如果需要 issue、ticket、backport 或 release 标识，按仓库格式加入；
- 没有独立 PR 规范时，再与 commit 标题保持一致；
- 不因为 commit 使用短标题，就把缺少用户影响的标题直接用于 PR。

#### PR 正文规则

如果仓库存在 PR/MR 模板：

- 以模板中的标题、顺序、checklist 和仓库专用指令作为正文结构；
- 填写所有适用字段；
- 保留项目要求的 issue、release note、AI disclosure、security 或 rollback 字段；
- 不把不适用字段伪造为已完成，按模板写 `N/A`、`NONE` 或保持空白，仅在仓库模板允许时使用。

如果仓库没有 PR/MR 模板，使用与仓库语言一致的简洁 fallback。英语仓库默认使用：

```markdown
## Summary

<一句话说明变更>

## Context

<问题、根因、关联 issue>

## Changes

<实际实现、范围和关键取舍>

## Testing

<执行过的命令和关键结果；不要粘贴大段日志>

## User impact / Release notes

<用户可见变化；没有变化时明确写 NONE>

## Notes for reviewers

<建议从哪里开始看、风险、未决问题或替代方案>
```

中文仓库使用等价的中文标题，但仍以仓库已有语言和术语为准。

PR 正文还必须遵循：

- 使用 `Fixes`、`Closes` 只表示确实应在合并后关闭的 issue；仅关联时使用 `Refs`、`Related to` 或仓库规定的关键词；
- 测试部分写命令、覆盖范围和关键结果，不粘贴完整 CI 输出；
- 用户可见改动按仓库要求写 release note、changelog、newsfragment 或 change file；
- 只有仓库要求时才写 AI 使用披露、署名或作者责任；一旦要求，必须准确写明工具、用途、人工复核情况和后续回复责任，不得笼统声称“AI 已验证”；
- 只有实际存在安全影响、回滚方案、benchmark、截图或录屏时才填写相应内容；
- reviewer notes 应该降低阅读成本，例如说明推荐阅读顺序、关键取舍和不确定点，不要为了填充模板重复方案正文。

### 5. 运行验证

根据仓库中的 `package.json`、`Makefile`、`pyproject.toml`、`go.mod`、`Cargo.toml`、CI 配置和项目文档识别现有验证命令，只运行与本次改动相关且项目已经定义的命令。优先级如下：

1. 相关单元测试或集成测试；
2. 类型检查；
3. lint 或格式检查；
4. benchmark 或性能验证（仅当改动涉及性能）；
5. 构建检查；
6. Git 差异检查。

至少执行：

```bash
git diff --check
```

准确记录每个命令及其结果。命令失败时停止，不创建 commit、push 或 PR/MR；先报告失败原因。项目没有自动化测试命令时，不能虚构测试通过，只能记录“未发现项目定义的自动化测试命令”，并执行可用的静态检查。

如果仓库模板要求特定的验证命令、benchmark、截图或录屏，必须优先执行或明确说明无法执行的真实原因。

### 6. 创建 commit 前确认

验证通过后，只暂存本次需求涉及的明确路径：

```bash
git add <path1> <path2> ...
git diff --cached --check
git diff --cached --stat
git diff --cached
```

创建 commit 前输出一次操作摘要，至少包含：

- 仓库约定摘要及其证据来源；
- 将要提交的文件；
- commit 标题和正文；
- 是否添加 signoff、签名或其他 trailers；
- 目标平台、当前分支和目标分支；
- PR/MR 标题；
- 实际采用的 PR 模板或 fallback 章节；
- PR/MR 正文；
- 已执行的验证命令及结果；
- 没有执行的验证及真实原因。

等待用户确认后执行。

如果工作区没有改动但当前分支已有待提交 commit，不创建空 commit，直接进入验证和推送流程；如果既没有工作区改动也没有相对目标分支的新 commit，则停止并说明没有可提交内容。

根据仓库约定创建 commit。示例 fallback：

```bash
git commit -m '<title>'
```

如果确实需要正文：

```bash
git commit -m '<title>' -m '<body>'
```

如果仓库明确要求 DCO signoff，通过仓库要求的 Git 提交流程完成；DCO signoff 与 PR 文案分开处理：

```bash
git commit -s -m '<title>'
```

hook 失败时停止并报告，不绕过 hook。

### 7. 强制 pre-reviewer 审查

本地 commit 完成后、任何远端写入前，必须记录审查快照；此时远端写入保持为 0。记录 REVIEW_HEAD 与 REVIEW_FINGERPRINT 快照值，指纹覆盖 HEAD、tracked 文件相对 HEAD 的完整 binary diff，以及所有未跟踪文件的路径和内容哈希：

```bash
set -o pipefail
REVIEW_HEAD="$(git rev-parse HEAD)" || exit 1
REVIEW_FINGERPRINT="$(
  {
    printf 'HEAD %s\n' "$REVIEW_HEAD" || exit 1
    git diff --binary --no-ext-diff HEAD || exit 1
    {
      git ls-files --others --exclude-standard -z || exit 1
    } |
      while IFS= read -r -d '' path; do
        printf 'UNTRACKED %s\0' "$path" || exit 1
        git hash-object --no-filters -- "$path" || exit 1
      done || exit 1
  } | git hash-object --stdin || exit 1
)" || exit 1
printf 'review head: %s\nreview fingerprint: %s\n' "$REVIEW_HEAD" "$REVIEW_FINGERPRINT" || exit 1
```

上述同一套快照命令必须 fail closed：任一采集命令失败都停止；不保留候选快照，不调用 pre-reviewer，也不进行任何远端写入。把成功输出的两个值记录在当前流程上下文中；不要写入仓库文件或持久化凭证。审查后、push 前和 PR/MR 创建前的调用方复核必须使用同一套 fail-closed 快照过程；复核命令失败时同样停止，不得沿用旧快照或旧 PASS。

记录快照后，主 agent 直接调用一次 `Agent` 执行 `pre-reviewer`，等待其完整最终回复；不得为该审查启动任何 workflow。调用方将仓库根路径、基线、需求与验收标准，以及只读的 `REVIEW_HEAD` 和 `REVIEW_FINGERPRINT` 原样传入。远端写入保持为 0，直到直接回复通过全部门禁。

调用方必须对完整最终回复整体只执行一次 JSON 解析，不截取首行或非空行，不剥离围栏，不从自然语言推断结果。等价的调用方校验顺序如下：

```javascript
const TOP_LEVEL_FIELDS = [
  "phase", "verdict", "summary", "issues", "evidence",
  "reviewedHead", "contentFingerprint", "blockingFindings",
]
const FINDING_FIELDS = ["severity", "location", "problem"]
const nonEmptyText = value => typeof value === "string" && value.trim().length > 0
const exactFields = (value, fields) => {
  const keys = Object.keys(value)
  return keys.length === fields.length && fields.every(field => keys.includes(field))
}
const textArray = value => Array.isArray(value) && value.every(nonEmptyText)
const finding = value => value
  && typeof value === "object"
  && !Array.isArray(value)
  && exactFields(value, FINDING_FIELDS)
  && ["Blocker", "Important"].includes(value.severity)
  && nonEmptyText(value.location)
  && nonEmptyText(value.problem)
const failClosed = reason => ({ verdict: "FAIL", reason: `pre-reviewer ${reason}` })

let reviewReply
try {
  reviewReply = await Agent(
    `仓库根路径：${repoRoot}；基线：${targetBranch}；需求与验收标准：${requirements}；审查重点：远端写入前完整审查；REVIEW_HEAD=${REVIEW_HEAD}；REVIEW_FINGERPRINT=${REVIEW_FINGERPRINT}`,
    { label: "pre-reviewer", agentType: "pre-reviewer" },
  )
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  return failClosed(`调用失败：${reason}`)
}
if (typeof reviewReply !== "string" || reviewReply.trim().length === 0) {
  return failClosed("回复为空或不是文本")
}

let result
try {
  result = JSON.parse(reviewReply)
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  return failClosed(`完整最终回复整体 JSON 解析失败：${reason}`)
}
if (!result || typeof result !== "object" || Array.isArray(result)) {
  return failClosed("结果必须是唯一、非空且非数组的 JSON 对象")
}
if (!exactFields(result, TOP_LEVEL_FIELDS)) {
  return failClosed("顶层字段缺失、额外或约定外字段")
}
if (result.phase !== "pre-review" || !["PASS", "FAIL"].includes(result.verdict)) {
  return failClosed("phase 或 verdict 字段非法")
}
if (!nonEmptyText(result.summary)
  || !textArray(result.issues)
  || !textArray(result.evidence)
  || result.evidence.length === 0
  || !nonEmptyText(result.reviewedHead)
  || !nonEmptyText(result.contentFingerprint)
  || !Array.isArray(result.blockingFindings)
  || !result.blockingFindings.every(finding)) {
  return failClosed("必需字段类型、非空值或 blockingFindings 条目非法")
}
if (result.reviewedHead !== REVIEW_HEAD
  || result.contentFingerprint !== REVIEW_FINGERPRINT) {
  return failClosed("审查快照不匹配或不一致")
}
if (result.verdict === "PASS"
  && (result.issues.length !== 0 || result.blockingFindings.length !== 0)) {
  return failClosed("PASS 与 issues 或 blockingFindings 语义矛盾")
}
if (result.verdict === "FAIL"
  && (result.issues.length === 0 || result.blockingFindings.length === 0)) {
  return failClosed("FAIL 缺少 issues 或 blockingFindings")
}
if (result.verdict === "FAIL") {
  return { verdict: "FAIL", preReviewResult: result }
}
return { verdict: "PASS", preReviewResult: result }
```

解析、字段、类型、枚举、语义或快照校验任一失败，都返回明确的 FAIL 原因；保留本地 commit，立即停止，不得执行 push 或创建 PR/MR。只有通过上述完整校验的合法严格 JSON `verdict: FAIL` 才进入下面的归因与返修路径。直接回复及校验结果只在当前流程内存中传递，不写入报告、JSON、Markdown、requirements 或其他文件。

#### 合法 FAIL 的归因、自动返修与产品升级

- `pre-reviewer` 返回合法 FAIL 后，主 agent 逐条归因；审查角色保持只读。当前改动直接造成且违反当前目标的问题才进入当前返修；与当前目标和根因可独立验证的问题必须分流为独立后续任务，不得扩大当前返修范围。
- pre-reviewer 返回合法 FAIL 后，主 agent 逐条归因；可自动解决的问题在 AI 决策台账记录成功后，自动派发所需的测试或实现修复并完成必要验证。
- 自动派修只交给 `test-engineer` 或 `impl-engineer`，不得让 `pre-reviewer` 修改文件。派修前由主 agent 校验用户已授权的目标、文件范围和验收标准；归因与修复路径必须先通过 `decision_record` 记录，台账追加失败时显示原因且不得派发修复。
- 返修改动必须按 git-commit 约定形成新的本地提交，重新采集 REVIEW_HEAD 与 REVIEW_FINGERPRINT，再直接调用 pre-reviewer；取得并复核绑定新快照的严格 JSON PASS 前，远端写入保持为 0。
- 每一个新提交都必须重新运行项目规定的验证；新提交完成后丢弃旧的 `REVIEW_HEAD`、`REVIEW_FINGERPRINT` 与旧 PASS，重新采集完整快照并直接调用只读 `pre-reviewer`。重审必须复用第 7 节完整 JSON 校验，不得从自然语言、旧快照或旧 PASS 放行。
- pre-reviewer 门禁独立计数，一次归因、修复派发并再次直接调用 pre-reviewer 计为一轮，最多三轮。
- 修复派发失败、重审结果非法或证据不足均计入当前门禁的一轮并按未通过处理；第三轮仍未通过时报告技术阻塞并停止，不再返修，不询问用户如何解决纯技术问题，也不写机械状态决定。
- 问题会改变外部可观察行为、数据、安全、权限或验收标准，修复超出已授权目标、文件范围或验收标准，或无法由已确认规范与项目惯例唯一推导时，必须向用户展示具体选项、适用场景、代价和推荐项。
- 用户忽略、取消或未回答时，不新增任何决策台账行，也不修改相关行为；用户明确选择后，必须先通过 decision_record 追加一行完整用户决定，再执行修复。

合法 FAIL 的产品升级必须暂停当前门禁的远端写入。用户作出明确选择并且 `decision_record` 返回成功后，才可按所选行为派修；仍须完成新的本地提交、新快照和直接重审。用户未形成选择时保持本地现状不变。

只有上述完整校验通过且 verdict 为 PASS 时才可放行。PASS 后、push 前和 PR/MR 创建前，调用方必须立即使用上述同一套 fail-closed 快照过程重新计算当前 HEAD 和当前内容指纹，并分别与 REVIEW_HEAD、REVIEW_FINGERPRINT 精确比较；任一采集命令失败、值变化或不一致都使原 PASS 失效。不得把 pre-reviewer 自报的快照替代调用方复核；复核失败时保留本地 commit，停止远端写入，并对变化后的完整内容重新启动 pre-reviewer。

初次 push 后、PR/MR 创建前，若 HEAD、工作区或指纹发生变化，旧 PASS 立即失效，禁止创建 PR/MR。若存在未提交的 tracked 或 untracked 变化，必须先回到既有范围检查/预检、项目验证、用户确认和本地 commit；不得直接 push 未提交内容。形成新的本地 commit/新的待推送 HEAD 后，重新记录完整快照，重新直接调用 pre-reviewer，取得严格 JSON verdict PASS，再由调用方复核；复核一致后回到第 8 节重新 push。每一次新 commit 都必须重复“新 HEAD → 完整快照 → 直接 pre-reviewer → 严格 JSON PASS → 复核”的顺序。

任何初次调用失败、空值、非法对象、矛盾或快照不一致均保留本地 commit，立即停止，不得执行 push 或创建 PR/MR；合法严格 JSON `verdict: FAIL` 按本节的归因、返修、产品升级和三轮上限处理。
### 8. 推送分支

commit 成功后再次检查：

```bash
git status --short --branch
git log -1 --format='%H%n%s'
```

在 push 前 fail closed 获取来源分支；无法读取或结果为空时停止：

```bash
BRANCH="$(git branch --show-current)" || exit 1
[ -n "$BRANCH" ] || exit 1
```

确认工作区没有本次流程遗漏的未提交改动后，只能把当前有效 PASS 快照中的不可变 `REVIEW_HEAD` 推送到已捕获的完整来源分支 ref：

```bash
git push origin "${REVIEW_HEAD}:refs/heads/${BRANCH}"
```

push 不重新读取当前 HEAD 或分支作为 source；即使本地分支在最终复核后已从已审的 A 推进到 B，本次命令仍只发送 `REVIEW_HEAD` 指向的已审 A。保持非快进保护，不使用 `--force` 或 `--force-with-lease`。push 失败时停止，不修改远端历史。

push 后、PR/MR 创建前仍必须执行第 7 节同一套 fail-closed 本地快照复核；若本地 HEAD、tracked diff、untracked 文件或内容指纹已变化，旧 PASS 失效，必须重走提交、审查和精确 push，不得创建 PR/MR。

### 9. 准备 PR/MR 正文

正文写入临时文件供 CLI 使用，创建完成后立即删除：

```bash
BODY_FILE="$(mktemp "${TMPDIR:-/tmp}/git-push-pr.XXXXXX.md")"
trap 'rm -f "$BODY_FILE"' EXIT
```

写入前检查：

- 若仓库有模板，所有必填标题和适用 checklist 都已填写；
- 未覆盖或删除仓库专用字段；
- 关联 issue 关键词准确；
- release note 与真实用户影响一致；
- 测试结果来自实际执行，不是推测；
- AI、作者、reviewer、security、rollback 等信息真实且有依据；
- 没有“待补充”“同上”或大段无关日志；
- PR 标题与 commit 标题分别符合各自约定。

### 10. 创建 PR/MR

确认分支已经推送、正文检查通过，并在 PR/MR 创建前先复核第 7 节同一套 fail-closed HEAD + 内容指纹命令；只有两个值仍与第 7 节同步审查的 PASS 快照完全一致才可继续。若任一变化或不一致，旧 PASS 立即失效，必须对变化后的完整内容重新启动 pre-reviewer；不得沿用失效结论。

本地复核通过后，先做只读的 source branch 身份检查，不得先创建 PR/MR：

```bash
REMOTE_SOURCE="$(git ls-remote --exit-code --refs origin "refs/heads/${BRANCH}")" || exit 1
[ -n "$REMOTE_SOURCE" ] || exit 1
```

将 `REMOTE_SOURCE` 的完整输出按非空行解析为记录集合 `records`；每条记录必须有独立的 `sha` 和 `ref` 字段，无法解析、字段缺失或格式错误时 fail closed。设 `recordCount = records.length`，只允许唯一放行谓词成立：`recordCount == 1`，且唯一记录的 `record.ref` 精确等于 `refs/heads/${BRANCH}`，唯一记录的 `record.sha` 精确等于 `REVIEW_HEAD`。远端 source branch SHA 必须与 REVIEW_HEAD 精确一致。

查询失败时停止且不得创建 PR/MR；输出为空时停止且不得创建 PR/MR；输出包含多条记录时停止且不得创建 PR/MR；无法解析、字段缺失或格式错误时停止且不得创建 PR/MR；`record.ref` 与 `refs/heads/${BRANCH}` 不一致时停止且不得创建 PR/MR；`record.sha` 与 `REVIEW_HEAD` 不一致时停止且不得创建 PR/MR。不要把部分输出、模糊匹配或其他记录解释为通过。

只有以上唯一放行谓词全部通过后才出现并执行 `gh pr create` 或 `glab mr create`。该校验不宣称对校验后其他用户或 CI 的远端写入提供跨平台原子锁，符合已确认的非目标；不要扩展远端锁定实现。

```bash
# GitHub Pull Request
gh pr create \
  --title '<title>' \
  --body-file "$BODY_FILE" \
  --base '<base-branch>' \
  --head "$BRANCH"

# GitLab Merge Request
glab mr create \
  --title '<title>' \
  --description "$(cat "$BODY_FILE")" \
  --target-branch '<target-branch>' \
  --source-branch "$BRANCH" \
  --yes
```

只有用户明确要求草稿时才添加 `--draft`。创建成功后记录 CLI 输出的 URL；不要打开浏览器，也不要继续执行 merge、approve 或 close。

## 异常处理

- detached HEAD、无法识别的平台、认证失败、无关改动或验证失败：停止并报告，不做部分提交；
- 当前位于默认分支或主分支时，必须先完成分支切换询问；用户拒绝切换、未确认分支名或切换失败时，停止，不创建 commit、不 push、不创建 PR/MR；
- 无法读取仓库贡献规范时，不猜测，说明缺失项并使用最小 fallback，必要时询问用户；
- 已有开放 PR/MR：输出已有 URL，不创建重复对象；
- 第 7 节初次 pre-reviewer 审查不可用、执行失败、结果缺失、回复非法或快照不匹配：保留本地 commit，停止 push 和 PR/MR 创建；合法严格 JSON `verdict: FAIL` 转入第 7 节的归因、自动返修或产品升级路径；
- push 被拒绝：保留本地结果，报告远端分叉或权限问题，不强推；
- CLI 创建失败：保留 commit 和已推送分支，删除正文临时文件，报告完整错误；不要改写 commit 来“重试”；
- 任一步骤产生的临时文件、日志或输出文件在结束前清理，不把它们加入 commit。

## 完成报告

完成后用中文报告：

- 仓库识别到的 commit 和 PR 约定；
- commit hash 和标题；
- 是否使用了项目要求的正文、signoff、签名或 trailers；
- 推送的分支与目标分支；
- 实际运行的测试及结果；
- 调用方记录的 REVIEW_HEAD、REVIEW_FINGERPRINT、审查范围与 pre-reviewer 返回的严格 JSON `verdict: PASS` 及其快照绑定；
- PR/MR 标题和 URL；
- 尚未解决的问题；
- 本次流程产生的临时文件及清理结果。
