#!/usr/bin/env bash
# IPA 公式 PDF を raw/ にダウンロードする。既にあるファイルは再取得しない。
#   使い方: scripts/fetch-ipa.sh          # 現行形式（サンプル問題・公開問題・シラバス）
#           scripts/fetch-ipa.sh --paper  # 筆記時代（H28春〜R1秋）も取得
# 出典: docs/04_公式ソース一覧.md
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p raw
BASE="https://www.ipa.go.jp/shiken"

# 保存名|URL
CURRENT=(
  "sample2022_qs.pdf|$BASE/syllabus/henkou/2022/gmcbt80000007cfs-att/sg_set_sample_qs.pdf"
  "sample2022_ans.pdf|$BASE/syllabus/henkou/2022/gmcbt80000007cfs-att/sg_set_sample_ans.pdf"
  "sample2022b_qs.pdf|$BASE/syllabus/henkou/2022/gmcbt80000007cfs-att/sg_kamoku_b_sample.pdf"
  "2023r05_qs.pdf|$BASE/mondai-kaiotu/sg_fe/koukai/t6hhco0000003zx0-att/2023r05_sg_qs.pdf"
  "2023r05_ans.pdf|$BASE/mondai-kaiotu/sg_fe/koukai/t6hhco0000003zx0-att/2023r05_sg_ans.pdf"
  "2024r06_qs.pdf|$BASE/mondai-kaiotu/sg_fe/koukai/eid2eo0000007g1d-att/2024r06_sg_qs.pdf"
  "2024r06_ans.pdf|$BASE/mondai-kaiotu/sg_fe/koukai/eid2eo0000007g1d-att/2024r06_sg_ans.pdf"
  "2025r07_qs.pdf|$BASE/mondai-kaiotu/sg_fe/koukai/tbl5kb0000005r9r-att/2025r07_sg_qs.pdf"
  "2025r07_ans.pdf|$BASE/mondai-kaiotu/sg_fe/koukai/tbl5kb0000005r9r-att/2025r07_sg_ans.pdf"
  "2026r08_qs.pdf|$BASE/mondai-kaiotu/sg_fe/koukai/rcu1hd0000012qj6-att/2026r08_sg_qs.pdf"
  "2026r08_ans.pdf|$BASE/mondai-kaiotu/sg_fe/koukai/rcu1hd0000012qj6-att/2026r08_sg_ans.pdf"
  "syllabus_sg_ver4_1.pdf|$BASE/syllabus/nl10bi0000007tch-att/syllabus_sg_ver4_1.pdf"
  "syllabus_sg_ver0_1.pdf|$BASE/syllabus/minaoshi/rqr7mi00000068se-att/syllabus_sg_ver0_1.pdf"
)

# 筆記時代: ディレクトリID|ファイル接頭辞
PAPER=(
  "gmcbt8000000gn5o|2016h28h"
  "gmcbt8000000g6fw|2016h28a"
  "gmcbt8000000fzx1|2017h29h"
  "gmcbt8000000fqpm|2017h29a"
  "gmcbt8000000fabr|2018h30h"
  "gmcbt8000000f01f|2018h30a"
  "gmcbt8000000ddiw|2019h31h"
  "gmcbt8000000dict|2019r01a"
)

fetch() {
  local name="$1" url="$2"
  if [ -s "raw/$name" ]; then echo "skip  $name"; return; fi
  echo "fetch $name"
  curl -fsSL --retry 3 -o "raw/$name" "$url"
  sleep 1
}

for entry in "${CURRENT[@]}"; do fetch "${entry%%|*}" "${entry#*|}"; done

if [ "${1:-}" = "--paper" ]; then
  for entry in "${PAPER[@]}"; do
    dir="${entry%%|*}"; prefix="${entry#*|}"
    for f in am_qs am_ans pm_qs pm_ans pm_cmnt; do
      fetch "${prefix}_sg_${f}.pdf" "$BASE/mondai-kaiotu/${dir}-att/${prefix}_sg_${f}.pdf"
    done
  done
fi
echo "done: $(ls raw | wc -l | tr -d ' ') files in raw/"
