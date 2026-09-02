#!/usr/bin/env bash
set -euo pipefail

f="${1:?用法: lint.sh <requirements.md>}"
if [[ ! -f "$f" ]]; then
  echo "FAIL: requirements.md 不存在"
  exit 1
fi

fail() {
  echo "FAIL: $1"
  exit 1
}

patterns=(
  '^```'
  '\.(go|ts|tsx|js|jsx|py|rs|java|kt|sql|vue|proto|ya?ml|toml)\b'
  '\b(src|pkg|internal|cmd|lib|app|components|services|handlers|repository|migrations|tests?)/'
  '\b[A-Za-z_][A-Za-z0-9_]*\(\)'
  '^[[:space:]]*(func|function|class|import|package|struct|interface|def)\b'
)

hits=$(for p in "${patterns[@]}"; do grep -nE "$p" "$f" || true; done | sort -t: -k1,1n -u)
if [[ -n "$hits" ]]; then
  printf '%s\n' "$hits"
  fail "含实现细节，需求文档必须保持黑盒"
fi

sections=$(grep -oE '^## [0-9]+\.' "$f" || true)
expected=$'## 1.\n## 2.\n## 3.\n## 4.\n## 5.\n## 6.\n## 7.'
[[ "$sections" == "$expected" ]] || fail "requirements.md 必须恰好包含第 1 至第 7 节"
grep -qE '^## 8\.' "$f" && fail "requirements.md 不得包含第 8 节"
rids=$(grep -oE '^### R-[0-9]+' "$f" | grep -oE 'R-[0-9]+' || true)
acids=$(grep -oE '^### AC-[0-9]+' "$f" | grep -oE 'AC-[0-9]+' || true)
[[ -n "$rids" ]] || fail "requirements.md 至少需要一个 R 条目"
[[ -n "$acids" ]] || fail "requirements.md 至少需要一个 AC 条目"

effective_r_count=$(grep -E '^### R-[0-9]+' "$f" | grep -vc '\[作废\]' || true)
(( effective_r_count <= 6 )) || fail "有效 R 不得超过 6 条，当前 $effective_r_count 条，需拆成多个需求"
ac_count=$(printf '%s\n' "$acids" | grep -c . || true)
(( ac_count <= 8 )) || fail "AC 不得超过 8 条，当前 $ac_count 条，需拆成多个需求"

r_duplicates=$(printf '%s\n' "$rids" | sort | uniq -d)
[[ -z "$r_duplicates" ]] || fail "R 编号不得重复: $r_duplicates"
ac_duplicates=$(printf '%s\n' "$acids" | sort | uniq -d)
[[ -z "$ac_duplicates" ]] || fail "AC 编号不得重复: $ac_duplicates"

refs=$(sed -n '/^### AC-[0-9].*←/s/.*←//p' "$f" | grep -oE 'R-[0-9]+' || true)
[[ -n "$refs" ]] || fail "每条 AC 必须回指至少一个已声明的 R"
while IFS= read -r ref; do
  [[ -z "$ref" ]] && continue
  grep -qE "^### $ref([[:space:]]|$)" "$f" || fail "AC 回指了未声明的 $ref"
done <<< "$refs"
while IFS= read -r rid; do
  [[ -z "$rid" ]] && continue
  grep -qE "^### AC-[0-9]+.*←.*$rid([[:space:],]|$)" "$f" || fail "$rid 没有被任何 AC 覆盖"
done <<< "$rids"
while IFS= read -r acid; do
  [[ -z "$acid" ]] && continue
  ac_line=$(grep -m1 -E "^### $acid([[:space:]]|$)" "$f")
  printf '%s\n' "$ac_line" | grep -qE '←[[:space:]]*R-[0-9]+' || fail "$acid 必须回指至少一个 R"
done <<< "$acids"

ac_shape=$(awk '
function check() {
  if (ac != "" && (!trigger || !given || !when || !then)) print ac
}
/^### AC-[0-9]+/ {
  check()
  ac=$2
  trigger=given=when=then=0
  next
}
/^- 触发:/ { trigger=1; next }
/^- Given:/ { given=1; next }
/^- When:/ { when=1; next }
/^- Then:/ { then=1; next }
END { check() }
' "$f")
[[ -z "$ac_shape" ]] || fail "AC 缺少固定的触发 / Given / When / Then: $ac_shape"

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
requirement_dir=$(CDPATH= cd -- "$(dirname -- "$f")" && pwd)
if ! bun "$script_dir/decision-ledger.ts" validate --requirement-dir "$requirement_dir" >/dev/null; then
  fail "需求目录必须包含并通过 canonical v1 AI/user JSONL 台账校验"
fi

echo "PASS"
