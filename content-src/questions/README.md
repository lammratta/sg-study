# content-src/questions の編集ガイド

このフォルダの JSON が問題データの原稿（唯一の編集場所）です。`scripts/parse_questions.py` が IPA の PDF から機械的に作った下書き（`parse.status = "auto"`）を、人（Claude）がページ画像と突き合わせて整え、解説とタグを付けて `parse.status = "reviewed"` にします。配信用の `public/content/` は `npm run build:content` で生成するので直接編集しません。

## ファイル

| ファイル | 内容 |
|---|---|
| `sample2022-a1.json` / `-a2.json` / `-a3.json` | サンプル問題セット（2022-12）科目A 問1〜16 / 17〜32 / 33〜48 |
| `sample2022-b1.json` / `-b2.json` | 同セット 科目B 問49〜54 / 55〜60 |
| `sample2022b.json` | 科目B サンプル問題（2022-04）問1・問3（問2 はセット問58 と同一のため除外） |
| `2023r05.json` 〜 `2026r08.json` | 令和5〜8年度 公開問題（各 15 問。問13〜15 が科目B） |

元の PDF のページ画像（2 倍スケール）は `work/text/<setId>_qs_pages/pNNN.png` にあります（`sample2022-*` は `work/text/sample2022_qs_pages/`、`sample2022b` は `work/text/sample2022b_qs_pages/`）。各問題の `pages` が該当ページ番号です。テキストが崩れている箇所、表、図は必ずページ画像で確認してください。

## 1 問ごとの作業

1. **本文の整形**: `stem`（科目B は `case.text` と `stem`）を原文どおりに直す。PDF の折返しで入った不要な改行・空白を除く。IPA の表記（読点「，」、英数字の前後の半角スペース「A 社」「PC がある」、脆弱性のルビ「ぜい」の混入除去）に注意。段落・箇条書きの区切りは `\n` で表す。空欄（穴埋め）は `［　a　］` のように全角括弧で示す。
2. **表**: 表を含む問題は `stemHtml`（科目B の本文中の表は `case.html`）に HTML を書く。HTML を書いた場合も `stem` / `case.text` はテキストとして残す（検索用）。使う要素は `<p>` `<ul><li>` `<table><thead><tbody><tr><th><td>` `<div class="box">`（図 1 のような囲み。末尾に `<p class="caption">図 1 ○○</p>`）`<strong>` `<br>` だけ。
3. **図**: テキストにできない図（フロー図、ネットワーク構成図、画面イメージなど）は `needsFigure: true` のままにして `figureNote` に「p.6 の a〜d のフロー図。選択肢と対応付けが必要」のようにページと内容を書く（後で画像を切り出す）。テキストで再現できる「図」（箇条書きの囲みなど）は HTML にして `needsFigure: false` にする。`hasTable` は表を HTML 化したら true のまま、表がなければ false にする。
4. **選択肢**: `choices[].text` を原文どおりに。科目B の解答群（ア〜コ）も同様。意味を変えない。
5. **解答**: `answer` は IPA の解答例で、変更しない。解答例と問題文が矛盾すると感じたら `parse.notes` に書く。
6. **解説** `explanation.md`（Markdown、日本語、300〜600 字程度）:
   - 1 段落目: 正解の選択肢とその理由。根拠となる知識・用語・規格・法律名を明示する。
   - 続けて、他の選択肢が誤りである理由を 1 行ずつ（`- ア: …` の箇条書き）。科目B は本文中のどの記述が根拠かを示す。
   - 最後に `**ポイント**` として覚えるべき知識を 1〜3 行。
   - 断定できない場合は「〜と考えられる」と書き、`parse.notes` に疑問点を残す。他サイトの解説を転載しない。
7. **タグ**: `tags.sub` にシラバスの小分類 ID（`content-src/syllabus/syllabus-4.1.json` の `categories[].subs[].id`。例 `A1-2`）。`tags.field` はその分類の `field`（T / M / S）。科目B は加えて `tags.skill` に技能の大項目 ID（`skills[].id`、B1〜B12）。`tags.item` は今は `null` のまま。
8. **難易度** `difficulty`: 1（用語を知っていれば解ける）/ 2（標準）/ 3（計算・複数の知識の組合せ・本文の読解判断が要る）。
9. **古い問題** `flags.outdated`: 法改正や制度変更で現在の正解や表現が変わる問題は `true` にし、`flags.note` に現在の扱いを書く（例: 「プロバイダ責任制限法は 2025 年に情報流通プラットフォーム対処法へ改正」）。該当しなければ `false`。
10. 終わったら `parse.status` を `"reviewed"` にする。`parse.notes` には確認してほしい点だけ残す（機械判定のメモは消してよい）。

## 禁止事項

- 問題文・選択肢の意味を変えない。`answer` を変えない。`id` / `source` を変えない。
- 他サイト・他書籍の解説を転載しない。
- 担当ファイル以外を編集しない。

## 確認

編集後に JSON として読めることを確認する:

```bash
python3 -c "import json,sys; json.load(open(sys.argv[1]))" content-src/questions/2026r08.json
```
