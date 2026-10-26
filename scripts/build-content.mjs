#!/usr/bin/env node
// content-src/ を検証して public/content/ に配信用 JSON を生成する。
//   node scripts/build-content.mjs          通常ビルド（検証に失敗したら終了コード 1）
//   node scripts/build-content.mjs --check  検証だけ行い、ファイルは書かない
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { escapeHtml, textToHtml } from './lib/html.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'content-src');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(PUBLIC, 'content');
const CHECK_ONLY = process.argv.includes('--check');

marked.use({ gfm: true, breaks: false });

const errors = [];
const warnings = [];
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

// ---- シラバス -------------------------------------------------------------
const syllabus = readJson(path.join(SRC, 'syllabus', 'syllabus-4.1.json'));
const subIndex = new Map();
for (const c of syllabus.categories) for (const s of c.subs) subIndex.set(s.id, { ...s, category: c.id, field: c.field, kind: c.kind });
const skillIds = new Set(syllabus.skills.map((s) => s.id));

// ---- 問題 -----------------------------------------------------------------
const qdir = path.join(SRC, 'questions');
const files = fs.readdirSync(qdir).filter((f) => f.endsWith('.json')).sort();
const seen = new Set();
const sets = new Map(); // setId -> { setId, source, questions: [] }
const index = [];
let reviewed = 0;

function convertQuestion(q, file) {
  const where = `${file}:${q.id}`;
  if (seen.has(q.id)) errors.push(`${where}: id が重複`);
  seen.add(q.id);
  if (!['A', 'B'].includes(q.kind)) errors.push(`${where}: kind が A/B でない`);
  if (!q.stem || !q.stem.trim()) errors.push(`${where}: stem が空`);
  if (!Array.isArray(q.choices) || q.choices.length < 2) errors.push(`${where}: 選択肢が 2 個未満`);
  if (q.kind === 'A' && q.choices.length !== 4) errors.push(`${where}: 科目A なのに選択肢が ${q.choices.length} 個`);
  const keys = new Set((q.choices || []).map((c) => c.key));
  if (!Array.isArray(q.answer) || q.answer.length === 0) errors.push(`${where}: answer が空`);
  for (const a of q.answer || []) if (!keys.has(a)) errors.push(`${where}: answer "${a}" が選択肢にない`);
  if (!q.source?.citation) errors.push(`${where}: 出典（source.citation）がない`);
  if (q.kind === 'B' && !q.case?.text) errors.push(`${where}: 科目B なのに case.text がない`);
  const sub = q.tags?.sub ? subIndex.get(q.tags.sub) : null;
  if (q.tags?.sub && !sub) errors.push(`${where}: tags.sub "${q.tags.sub}" がシラバスにない`);
  if (q.tags?.skill && !skillIds.has(q.tags.skill)) errors.push(`${where}: tags.skill "${q.tags.skill}" がシラバスにない`);
  if (q.parse?.status === 'reviewed') reviewed += 1;
  else warnings.push(`${where}: 未レビュー（parse.status=${q.parse?.status}）`);
  if (!q.explanation?.md) warnings.push(`${where}: 解説が空`);
  if (!q.tags?.sub) warnings.push(`${where}: 分野タグなし`);
  if (q.needsFigure && (!q.figures || q.figures.length === 0)) warnings.push(`${where}: 図が必要だが画像未添付（${q.figureNote || ''}）`);
  for (const f of q.figures || []) {
    if (!fs.existsSync(path.join(SRC, 'figures', f.src))) errors.push(`${where}: 図ファイルがない content-src/figures/${f.src}`);
  }

  const field = q.tags?.field || sub?.field || null;
  return {
    id: q.id,
    kind: q.kind,
    source: q.source,
    stemHtml: q.stemHtml || textToHtml(q.stem),
    caseHtml: q.kind === 'B' ? (q.case?.html || textToHtml(q.case?.text)) : undefined,
    choices: (q.choices || []).map((c) => ({ key: c.key, html: escapeHtml(c.text) })),
    answer: q.answer,
    figures: (q.figures || []).map((f) => ({ src: `figures/${f.src}`, alt: f.alt || '', position: f.position || 'stem' })),
    tags: { sub: q.tags?.sub || null, item: q.tags?.item || null, skill: q.tags?.skill || null, field, newSubs: q.tags?.sub ? (syllabus.newSystem.map[q.tags.sub] || []) : [] },
    explanationHtml: q.explanation?.md ? marked.parse(q.explanation.md) : '',
    flags: { outdated: !!q.flags?.outdated, note: q.flags?.note || '' },
    difficulty: q.difficulty ?? null,
    reviewed: q.parse?.status === 'reviewed',
  };
}

for (const file of files) {
  const data = readJson(path.join(qdir, file));
  for (const q of data.questions) {
    const out = convertQuestion(q, file);
    const setId = q.source.setId;
    if (!sets.has(setId)) sets.set(setId, { setId, year: q.source.year, session: q.source.session, url: q.source.url, questions: [] });
    sets.get(setId).questions.push(out);
    index.push({ id: out.id, kind: out.kind, setId, no: q.source.no, sub: out.tags.sub, skill: out.tags.skill, field: out.tags.field, difficulty: out.difficulty, outdated: out.flags.outdated, figure: out.figures.length > 0, reviewed: out.reviewed });
  }
}
for (const s of sets.values()) s.questions.sort((a, b) => a.source.no - b.source.no);

// ---- 教科書（Phase 2 で追加。今は存在すれば変換する）-------------------------
const topics = [];
const tdir = path.join(SRC, 'textbook');
if (fs.existsSync(tdir)) {
  for (const f of fs.readdirSync(tdir).filter((f) => f.endsWith('.md')).sort()) {
    const raw = fs.readFileSync(path.join(tdir, f), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) { errors.push(`textbook/${f}: frontmatter がない`); continue; }
    const meta = Object.fromEntries(m[1].split('\n').filter(Boolean).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
    topics.push({ id: meta.id || f.replace(/\.md$/, ''), title: meta.title || '', topicIds: (meta.topicIds || '').split(',').map((s) => s.trim()).filter(Boolean), html: marked.parse(m[2]), readingMinutes: Number(meta.readingMinutes || 5), updatedAt: meta.updatedAt || '' });
  }
}

// ---- 結果 -----------------------------------------------------------------
const total = index.length;
console.log(`問題 ${total} 問（科目A ${index.filter((i) => i.kind === 'A').length} / 科目B ${index.filter((i) => i.kind === 'B').length}）、レビュー済み ${reviewed}、教科書 ${topics.length} ページ`);
for (const w of warnings.slice(0, 15)) console.log('  warn:', w);
if (warnings.length > 15) console.log(`  warn: …ほか ${warnings.length - 15} 件`);
for (const e of errors) console.log('  ERROR:', e);
if (errors.length) { console.log(`検証エラー ${errors.length} 件。生成を中止します。`); process.exit(1); }
if (CHECK_ONLY) process.exit(0);

// ---- 書き出し ---------------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'questions'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'textbook'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'figures'), { recursive: true });
const written = {};
const write = (rel, obj) => {
  const body = JSON.stringify(obj);
  fs.writeFileSync(path.join(OUT, rel), body);
  written[rel] = { hash: sha(body), bytes: Buffer.byteLength(body) };
};
write('syllabus.json', syllabus);
write('questions/index.json', index);
for (const s of sets.values()) write(`questions/${s.setId}.json`, s);
for (const t of topics) write(`textbook/${t.id}.json`, t);
const figDir = path.join(SRC, 'figures');
if (fs.existsSync(figDir)) {
  for (const f of fs.readdirSync(figDir)) {
    const buf = fs.readFileSync(path.join(figDir, f));
    fs.writeFileSync(path.join(OUT, 'figures', f), buf);
    written[`figures/${f}`] = { hash: sha(buf), bytes: buf.length };
  }
}

// contentVersion: 中身が変わったときだけ増やす
const combined = sha(Object.keys(written).sort().map((k) => `${k}:${written[k].hash}`).join('\n'));
let prev = null;
try { prev = readJson(path.join(OUT, 'index.json')); } catch { /* 初回 */ }
const prevHash = prev?.hash;
let prevVersion = prev?.contentVersion || 0;
try { prevVersion = readJson(path.join(ROOT, 'content-src', 'version.json')).contentVersion; } catch { /* なし */ }
const contentVersion = combined === prevHash ? prevVersion : prevVersion + 1;
fs.writeFileSync(path.join(ROOT, 'content-src', 'version.json'), JSON.stringify({ contentVersion, hash: combined }, null, 2) + '\n');
const indexJson = {
  contentVersion,
  hash: combined,
  builtAt: new Date().toISOString(),
  counts: { questionsA: index.filter((i) => i.kind === 'A').length, questionsB: index.filter((i) => i.kind === 'B').length, reviewed, topics: topics.length, figures: Object.keys(written).filter((k) => k.startsWith('figures/')).length },
  files: written,
};
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(indexJson, null, 2));

// Service Worker 用の事前キャッシュ一覧（public/ 配下の全ファイル）
const walk = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const rel = base ? `${base}/${e.name}` : e.name;
  if (e.isDirectory()) return walk(path.join(dir, e.name), rel);
  if (['sw.js', 'sw-manifest.json', '_headers'].includes(rel)) return [];
  return [{ path: rel, hash: sha(fs.readFileSync(path.join(dir, e.name))) }];
});
fs.writeFileSync(path.join(PUBLIC, 'sw-manifest.json'), JSON.stringify({ contentVersion, files: walk(PUBLIC) }, null, 2));
console.log(`public/content/ を生成しました（contentVersion ${contentVersion}、${Object.keys(written).length} ファイル）`);
