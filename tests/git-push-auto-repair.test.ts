import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GIT_PUSH_SKILL_PATH = join(PACKAGE_ROOT, "skills", "git-push", "SKILL.md");

const REQUIRED_SENTENCES = [
  "pre-reviewer 返回合法 FAIL 后，主 agent 逐条归因；可自动解决的问题在 AI 决策台账记录成功后，自动派发所需的测试或实现修复并完成必要验证。",
  "返修改动必须按 git-commit 约定形成新的本地提交，重新采集 REVIEW_HEAD 与 REVIEW_FINGERPRINT，再直接调用 pre-reviewer；取得并复核绑定新快照的严格 JSON PASS 前，远端写入保持为 0。",
  "pre-reviewer 门禁独立计数，一次归因、修复派发并再次直接调用 pre-reviewer 计为一轮，最多三轮。",
  "修复派发失败、重审结果非法或证据不足均计入当前门禁的一轮并按未通过处理；第三轮仍未通过时报告技术阻塞并停止，不再返修，不询问用户如何解决纯技术问题，也不写机械状态决定。",
  "问题会改变外部可观察行为、数据、安全、权限或验收标准，修复超出已授权目标、文件范围或验收标准，或无法由已确认规范与项目惯例唯一推导时，必须向用户展示具体选项、适用场景、代价和推荐项。",
  "用户忽略、取消或未回答时，不新增任何决策台账行，也不修改相关行为；用户明确选择后，必须先通过 decision_record 追加一行完整用户决定，再执行修复。",
];

const FORBIDDEN_SENTENCES = [
  "审查明确 FAIL 后立即停止且不自动返修。",
  "第 7 节 pre-reviewer 审查未通过时一律停止。",
  "pre-reviewer 可以直接修改文件。",
  "第三轮失败后向用户询问如何修复纯技术问题。",
  "沿用返修前的 REVIEW_HEAD 或 REVIEW_FINGERPRINT 放行远端写入。",
];

async function readGitPushSkill(): Promise<string> {
  return Bun.file(GIT_PUSH_SKILL_PATH).text();
}

describe("pre-reviewer 自动返修", () => {
  for (const sentence of REQUIRED_SENTENCES) {
    test(`要求流程包含：${sentence}`, async () => {
      expect(await readGitPushSkill()).toContain(sentence);
    });
  }

  for (const sentence of FORBIDDEN_SENTENCES) {
    test(`流程不再包含：${sentence}`, async () => {
      expect(await readGitPushSkill()).not.toContain(sentence);
    });
  }
});
