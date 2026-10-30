# IPA 情報セキュリティマネジメント試験（SG）学習アプリ

iPhone だけで SG の学習（教科書・過去問演習・学習履歴）を回すための、自分専用アプリの企画・設計プロジェクトです。

## 現在の状態

Phase 3 まで完了（2026-10-27）。科目A ドリル・科目B ケース演習・教科書 36 ページ・進捗（合格目安）・模擬試験（60 問・120 分）・実績バッジが使えます。受験日は 2026-11-29。

- リポジトリ: https://github.com/lammratta/sg-study （公開）
- 配信 URL: https://lammratta.github.io/sg-study/ （`main` に push すると自動更新）

## 文書

| 文書 | 内容 |
|---|---|
| [docs/01_企画書.md](docs/01_企画書.md) | 目的、方式の比較（PWA を推奨）、試験の基礎情報と重要日程、公式問題ソースと利用条件、機能要件、決めてほしいこと |
| [docs/02_設計書.md](docs/02_設計書.md) | アーキテクチャ、技術スタック、ディレクトリ構成、コンテンツと学習記録のデータモデル、画面設計、出題・間隔反復・進捗指標のロジック、PWA/iOS 対応、生成パイプライン、デプロイ |
| [docs/03_開発ロードマップ.md](docs/03_開発ロードマップ.md) | Phase 0〜4 の進め方と作業量の目安 |
| [docs/04_公式ソース一覧.md](docs/04_公式ソース一覧.md) | IPA 公式ページ・PDF の URL 一覧と、PDF の文字抽出可否の確認結果 |
| [docs/05_配信手順.md](docs/05_配信手順.md) | GitHub Pages と Cloudflare Pages の違いと設定手順 |

## 方針の要点

- サーバーを持たない PWA（静的サイトをホーム画面に追加）。Apple の審査も Developer Program も不要。
- 学習記録は端末内（IndexedDB）にだけ保存し、JSON でバックアップ・復元できる。
- 問題は IPA が公開している公式問題だけを使い、出典を明記する。解説と教科書は自作。
- 現行の CBT 試験は 2026-12-27 開催分を最後に休止、2027 年度春頃から新制度（SG は継続）。どちらで受験しても使えるように、現行シラバスと新シラバス案の両方の分類に対応する。

## 使い方

1. iPhone の Safari で https://lammratta.github.io/sg-study/ を開く（下の QR コードを iPhone のカメラで読み取ってもよい）
2. 共有ボタン →「ホーム画面に追加」
3. ホーム画面のアイコンから起動（2 回目以降はオフラインでも動く）

<img src="docs/qr-sg-study.png" alt="アプリを開く QR コード" width="180">

QR コードは `swift scripts/make-qr.swift https://lammratta.github.io/sg-study/ docs/qr-sg-study.png` で作り直せる（macOS）。カメラから開くと Safari のタブで開き、ホーム画面のアプリとは学習記録が別になる。ホーム画面に追加したあとは、アイコンから開く。

## 開発

```bash
npm install && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
npm run build   # content-src/ を検証して public/content/ と sw.js を生成
npm test
npm run dev     # http://localhost:8080
```

`main` に push すると GitHub Actions が `public/` を配信する。

教科書の各ページ末尾の「確認テスト」には、`content-src/textbook/question-map.json` でそのページに割り当てた公式問題だけが出る。割当ての基準と書き方のルールは `content-src/textbook/README.md` にある。ページを直したら `node scripts/check-textbook.mjs <ページid>` で太字の崩れや用語集の形式を確認する。

## 次のステップ

- 仕上げ: 新機能は作らず、演習・弱点潰し・模試 3 回。解説の修正だけ行う
- 新制度のサンプル問題が公開されたら取り込む（Phase 4）
- 教科書の内容で気付いた誤りは content-src/textbook/*.md を直して `npm run build` → push
