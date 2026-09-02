# Git 推送前强制 PR 审查：设计

## 1. 现状

- `/Users/bb/.pi/agent/skills/git-push/SKILL.md` 是 `/skill:git-push` 的有效执行规则。它已经把本地 commit、待推送内容快照、同步 `pre-reviewer` 审查、push 和 PR/MR 创建串联起来，并以 `HEAD + tracked binary diff + 未跟踪文件路径及内容哈希` 表示一次审查快照。
- `/Users/bb/.pi/agent/agents/pre-reviewer.md` 已注册只读 `pre-reviewer` 角色，以首行 `## 结论 PASS` 或 `## 结论 FAIL` 返回 Markdown 裁决；本需求不修改该角色的标准、权限和输出格式。
- 当前 `git-push` 已直接使用 `Agent(subagent_type="pre-reviewer", run_in_background=false)`，但第 8 节仍以可变分支名执行 `git push --set-upstream origin <branch>`。若最终本地快照复核后分支从已审提交 A 前进到未审提交 B，push 会在执行时重新解析分支并把 B 写入远端，违反 R-6。
- 当前第 10 节已有 `git ls-remote` 只读检查，但必须把“唯一远端来源记录、精确等于有效 `REVIEW_HEAD`、失败关闭、检查先于创建”固化为完整门禁，并以测试单独覆盖 R-7。
- `/Users/bb/.pi/agent/skills/git-push/__tests__/pre-reviewer-gate.test.ts` 使用 Bun 读取有效 Markdown 规则，已覆盖 R-1 至 R-5 的主要契约以及部分复核路径；尚未明确断言 push 的来源是已审提交对象而不是当前分支，也未将远端来源唯一性作为 AC-7 的独立门禁测试。
- 仓库根目录没有项目级依赖清单；本次继续使用现有 Bun 契约测试，不引入持久化状态或第三方依赖。

## 2. 改动点

### R-1 固定推送前审查顺序

修改 `/Users/bb/.pi/agent/skills/git-push/SKILL.md`：

- 保持“本地 commit 完成 → 记录快照 → 同步启动一个 `pre-reviewer` → 解析完整结果 → 调用方复核”的串行顺序。
- `pre-reviewer` 返回完整结果前，禁止执行 push、`gh pr create` 或 `glab mr create`；同一时刻只允许一个有效审查调用。
- 保留现有 Agent 输入中的仓库根路径、目标基线、需求与验收标准、审查 HEAD 和内容指纹。

### R-2 审查通过后方可写入远端

- 只有完整审查结果的第一个非空行精确为 `## 结论 PASS`，且全文恰好存在一个精确 PASS/FAIL 裁决行时，才形成候选 PASS。
- 候选 PASS 后立即用同一套 fail-closed 快照过程重算本地状态；`HEAD` 与内容指纹均和审查前快照一致时，PASS 才有效。
- push 前和 PR/MR 创建前都重新核对有效 PASS 绑定的快照；任何远端写入都不得仅凭代理正常结束或正文中的 PASS 字样放行。

### R-3 审查未通过时阻断远端写入

- `pre-reviewer` 明确 FAIL、未明确 PASS、输出格式不合规、结果为空、角色不可用、Agent 启动失败或执行失败时，立即停止。
- 停止时保留本地 commit，push 次数与 PR/MR 创建次数均为 0；主 agent 不得替代审查，不自动修改、自动重试或绕过。

### R-4 内容变化后重新审查

- PASS 后任一次本地复核发现当前提交、tracked diff 或未跟踪文件发生变化时，立即使旧 PASS 失效。
- 对变化后的完整内容重新完成必要的范围检查、验证、用户确认与 commit，再串行记录新快照并重新启动 `pre-reviewer`。
- 新快照取得严格 PASS 且调用方复核一致后，流程回到 push；如果变化发生在首次 push 后、PR/MR 创建前，也必须按这一完整路径重新审查和推送，不得直接创建 PR/MR。

### R-5 移除已删除流程依赖

- 有效 `git-push/SKILL.md` 仅使用 `pre-reviewer` 和 `Agent`；全文不得出现已删除流程名称、`SubagentWorkflow` 或旧结构化结果字段。
- 不创建旧流程占位、别名或兼容分支，也不修改历史会话、历史任务和历史运行证据。

### R-6 推送已审提交

- 把第 8 节的 push 来源从可变的当前分支名改为不可变的有效 `REVIEW_HEAD`，目标仍为当前来源分支的完整远端 ref。
- 最终快照复核通过后，即使本地分支在 push 命令执行前前进到 B，显式 refspec 仍只把已审提交 A 推送到 `refs/heads/<branch>`；Git 的非快进保护保持启用，不使用任何强推参数。
- push 后不假定当前本地分支仍指向 A。进入 PR/MR 创建前再次执行本地快照复核；若已变为 B，A 的 PASS 对 B 失效，流程重新审查 B，而不能用 A 的结论创建后续 PR/MR。

### R-7 创建前确认远端来源

- PR/MR 创建前，在本地快照仍与有效 PASS 一致之后，使用完整来源 ref `refs/heads/<branch>` 查询远端。
- 查询失败、无记录、多记录、记录无法解析、返回 ref 不是精确目标 ref，或远端 SHA 不精确等于有效 `REVIEW_HEAD` 时，立即停止且不调用 `gh pr create` / `glab mr create`。
- 只有唯一远端来源记录同时满足“ref 精确匹配”和“SHA 精确匹配”时才可创建 PR/MR。此检查不宣称对检查后其他远端写入者提供跨平台原子锁，符合需求明确的非目标。

## 3. 文件清单

| 路径 | 操作 | 用途 |
|---|---|---|
| `/Users/bb/.pi/agent/skills/git-push/SKILL.md` | 修改 | 固化 pre-reviewer 门禁，以已审提交对象作为 push 来源，并在创建前校验唯一远端来源身份 |
| `/Users/bb/.pi/agent/skills/git-push/__tests__/pre-reviewer-gate.test.ts` | 修改 | 补齐 AC-6、AC-7 契约测试并保持 AC-1 至 AC-5 回归覆盖 |

## 4. 数据与接口变更

### 4.1 待推送内容快照

不新增持久化数据。每轮审查在流程上下文中维护：

```text
ReviewSnapshot = {
  head: git rev-parse HEAD,
  fingerprint: hash(
    "HEAD " + head + "\n" +
    git diff --binary --no-ext-diff HEAD +
    每个未跟踪文件的路径与 git hash-object --no-filters 内容哈希
  )
}
```

成品采集命令继续统一为：

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
```

初次采集和每次复核均使用同一过程；任一命令失败都停止，不生成候选快照，不沿用旧 PASS。

### 4.2 `pre-reviewer` 派工接口

`git-push` 在本地 commit 和快照采集成功后，通过现有 Agent 同步派工：

```text
Agent({
  description: "Review branch changes",
  subagent_type: "pre-reviewer",
  run_in_background: false,
  prompt: "仓库根路径：<repo-root>；基线：<target-branch>；需求与验收标准：<confirmed requirements>；审查重点：远端写入前完整审查；只读上下文：REVIEW_HEAD=<REVIEW_HEAD>；只读上下文：REVIEW_FINGERPRINT=<REVIEW_FINGERPRINT>。第一行必须精确为 ## 结论 PASS 或 ## 结论 FAIL，并返回完整 Markdown 审查报告。"
})
```

调用失败或角色不可用时 fail closed。调用方只解析现有 Markdown 契约，不要求 `pre-reviewer` 返回 `reviewedHead`、`contentFingerprint` 或其他结构化字段。

### 4.3 审查裁决接口

允许继续的必要且唯一裁决条件为：

```text
firstNonEmptyLine == "## 结论 PASS"
AND exactVerdictLineCount("## 结论 PASS" | "## 结论 FAIL") == 1
AND currentSnapshot == ReviewSnapshot
```

任一条件不成立即停止或按 R-4 对变化后的内容发起全新审查；旧 PASS 不能与新快照组合。

### 4.4 精确提交 push 接口

最终本地快照复核一致后，以不可变提交对象作为来源、以完整远端分支 ref 作为目标：

```bash
BRANCH="$(git branch --show-current)" || exit 1
git push origin "${REVIEW_HEAD}:refs/heads/${BRANCH}"
```

约束：

- `REVIEW_HEAD` 必须来自当前有效 PASS 绑定的快照，不能在 push 时重新读取为当前分支 HEAD。
- 不得使用 `git push ... <branch>`、`HEAD:...` 或其他会在执行时解析可变本地分支的来源。
- 不添加 `--force`、`--force-with-lease` 或其他覆盖远端历史的参数；非快进或权限失败时停止。
- push 返回成功只证明该次命令完成，不能替代 PR/MR 创建前的本地快照与远端身份复核。

### 4.5 PR/MR 创建前远端来源接口

本地快照复核一致后，先执行唯一远端来源查询：

```bash
REMOTE_SOURCE="$(
  git ls-remote --exit-code --refs origin "refs/heads/${BRANCH}"
)" || exit 1
```

调用方必须把 `REMOTE_SOURCE` 解析为记录集合，并仅在以下完整谓词为真时继续：

```text
recordCount == 1
AND record[0].ref == "refs/heads/${BRANCH}"
AND record[0].sha == REVIEW_HEAD
```

空输出、额外非空记录、字段缺失、ref 不匹配或 SHA 不匹配均停止。谓词通过后才允许二选一执行：

```bash
gh pr create --title '<title>' --body-file "$BODY_FILE" --base '<base-branch>' --head "$BRANCH"
```

```bash
glab mr create --title '<title>' --description "$(cat "$BODY_FILE")" --target-branch '<target-branch>' --source-branch "$BRANCH" --yes
```

### 4.6 门禁状态与转移

```text
LOCAL_COMMIT_READY
  → SNAPSHOT_RECORDED
  → REVIEW_CALL_ACTIVE
  → 非明确 PASS / 调用失败
      → STOPPED（保留本地 commit；push=0；PR/MR create=0）
  → 严格 PASS
      → SNAPSHOT_RECHECK
          → 变化：PASS_INVALID → 形成新提交/新快照 → REVIEW_CALL_ACTIVE
          → 一致：PASS_VALID
              → FINAL_PUSH_SNAPSHOT_RECHECK
                  → 变化：PASS_INVALID
                  → 一致：PUSH_EXACT(REVIEW_HEAD → refs/heads/BRANCH)
                      → CREATE_LOCAL_SNAPSHOT_RECHECK
                          → 变化：PASS_INVALID → 新审查 → 再次精确 push
                          → 一致：REMOTE_SOURCE_QUERY
                              → 非唯一 / ref 不符 / SHA 不符：STOPPED
                              → 唯一且 SHA == REVIEW_HEAD：PR/MR CREATE
```

### 4.7 第三方依赖

无新增第三方依赖。生产规则继续使用现有 pi `Agent`、Git、`gh` / `glab`；测试继续使用现有 Bun。

## 5. 测试策略

使用 Bun 契约测试读取 `/Users/bb/.pi/agent/skills/git-push/SKILL.md`，按 Markdown 章节提取并断言完整语义和先后顺序；只检查当前有效 skill，不扫描历史目录。

| AC | 测试层级 | 覆盖方式 |
|---|---|---|
| AC-1 | 流程契约测试 | 断言本地 commit 后采集快照、同步派发 `pre-reviewer`、严格 PASS、调用方复核、push、PR/MR 创建按序发生，审查结果返回前禁止远端写入 |
| AC-2 | 失败门禁契约测试 | 断言明确 FAIL 保留本地 commit，并同时禁止 push、GitHub PR 创建和 GitLab MR 创建 |
| AC-3 | fail-closed 契约测试 | 覆盖无明确 PASS、格式不合规、空结果、角色不可用、启动/执行失败和快照采集失败，确认代理正常结束或正文 PASS 不能放行 |
| AC-4 | 快照一致性契约测试 | 断言快照覆盖 HEAD、tracked binary diff、未跟踪路径与内容哈希；PASS 后、push 前和创建前变化均使旧 PASS 失效并回到完整新审查 |
| AC-5 | 有效规则残留测试 | 断言有效 skill 仅使用 `pre-reviewer` / `Agent`，已删除流程名称与 `SubagentWorkflow` 全文零残留 |
| AC-6 | 精确 push 来源契约测试 | 断言 push refspec 的来源是已审 `REVIEW_HEAD`、目标是完整远端分支 ref，并禁止 branch-only、`HEAD` 来源和强推；断言 push 后本地变化在创建前使旧 PASS 失效 |
| AC-7 | 远端身份门禁契约测试 | 断言创建前先执行 `git ls-remote --exit-code --refs`，仅唯一记录且 ref 与 SHA 分别精确匹配目标来源 ref 和 `REVIEW_HEAD` 时才进入 `gh pr create` / `glab mr create`；所有失败与不一致路径均停止创建 |

最小验证命令：

```text
bun test /Users/bb/.pi/agent/skills/git-push/__tests__/pre-reviewer-gate.test.ts
```

## 6. 备选方案与取舍

### 方案 A：以已审提交对象作为显式 refspec 来源（采用）

执行 `git push origin "${REVIEW_HEAD}:refs/heads/${BRANCH}"`。push 来源在取得 PASS 时已经固定，最终复核后的本地分支竞态不会改变实际写入对象；随后以本地快照复核和远端来源 SHA 校验约束 PR/MR 创建。

### 方案 B：复核后继续按当前分支名 push（否定）

保留 `git push --set-upstream origin <branch>`，并依赖 push 前最后一次 `git rev-parse HEAD`。检查和 push 是两个独立步骤，分支可在其间前进；push 会重新解析分支并写入未审提交，因此只能缩小竞态窗口，不能满足 R-6。

### 根源性自检

1. 方案 A 触及根源：风险来自 push 来源仍是可变 ref；把来源绑定为已审对象标识后，分支竞态不再影响该次 push。方案 B 只是增加或靠近检查，仍保留 TOCTOU。
2. 不需要引入锁、临时远端分支或平台专用 API：精确 Git refspec 已能固定 push 对象，创建前的远端 SHA 门禁覆盖 R-7；需求也明确不要求对其他远端写入者提供跨平台原子锁。

推荐方案 A。
