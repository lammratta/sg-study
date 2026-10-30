// 教科書ページの簡易チェック（ビルドを走らせずに使える）。
// 使い方: node scripts/check-textbook.mjs A1-1-01 A1-1-02 …（省略時は全ページ）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'content-src', 'textbook');
const args = process.argv.slice(2);
const ids = args.length ? args : fs.readdirSync(dir).filter((f) => /^A\d.*\.md$/.test(f)).map((f) => f.replace(/\.md$/, '')).sort();
const HEADINGS = ['## 要点', '## 解説', '## 試験での問われ方', '## 用語集'];
const strip = (h) => h.replace(/<[^>]+>/g, '');
let bad = 0;

for (const id of ids) {
  const file = path.join(dir, `${id}.md`);
  if (!fs.existsSync(file)) { console.log(`${id}: ファイルがない`); bad += 1; continue; }
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) { console.log(`${id}: frontmatter がない`); bad += 1; continue; }
  const body = m[2];
  const problems = [];
  const hints = [];
  const lines = body.split(/\r?\n/);
  for (const h of HEADINGS) if (!lines.includes(h)) problems.push(`見出し「${h}」がない`);
  const html = marked.parse(body);
  const visible = html.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code>[\s\S]*?<\/code>/g, '');
  const left = strip(visible).match(/.{0,12}\*\*.{0,12}/g);
  if (left) problems.push(`太字にならない ** が ${left.length} か所: ${left.slice(0, 6).map((s) => `「${s}」`).join(' ')}`);
  const gloss = body.split(/^## 用語集\s*$/m)[1] || '';
  const glossItems = gloss.split(/\r?\n/).filter((l) => l.startsWith('- '));
  const terms = glossItems.filter((l) => /^- \*\*(.+?)\*\*[:：]/.test(l));
  if (terms.length !== glossItems.length) problems.push(`用語集の形式（- **用語**: 説明）でない行が ${glossItems.length - terms.length} 行`);
  const paras = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((x) => strip(x[1]));
  const longParas = paras.filter((p) => p.length > 220);
  if (longParas.length) hints.push(`220 字を超える段落 ${longParas.length} 個（分けられないか検討）: ${longParas.map((p) => `「${p.slice(0, 18)}…」`).join(' ')}`);
  const dense = [...html.matchAll(/<(p|li)>([\s\S]*?)<\/\1>/g)].filter((x) => (x[2].match(/<strong>/g) || []).length > 3);
  if (dense.length) hints.push(`太字が 4 か所以上の段落・箇条 ${dense.length} 個`);
  const strong = (html.match(/<strong>/g) || []).length;
  const chars = strip(html).replace(/\s/g, '').length;
  const fm = Object.fromEntries(m[1].split(/\r?\n/).filter(Boolean).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  const minutes = Math.max(1, Math.round(chars / 500));
  if (Number(fm.readingMinutes) !== minutes) hints.push(`readingMinutes は ${fm.readingMinutes}。本文量からの目安は ${minutes}`);
  console.log(`${id}: ${chars} 字 ・ 太字 ${strong} か所 ・ 用語 ${terms.length} 語 ${problems.length ? 'NG' : 'OK'}`);
  for (const p of problems) console.log(`  NG: ${p}`);
  for (const h of hints) console.log(`  参考: ${h}`);
  if (problems.length) bad += 1;
}
process.exit(bad ? 1 : 0);
