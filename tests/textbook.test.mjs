import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const tdir = path.resolve('content-src/textbook');
const qdir = path.resolve('content-src/questions');
const pages = JSON.parse(fs.readFileSync(path.join(tdir, 'pages.json'), 'utf8'));
const order = new Map(pages.map((p, i) => [p.id, i]));
const questionIds = fs.readdirSync(qdir).filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(qdir, f), 'utf8')).questions.map((q) => q.id));

test('確認テスト: すべての問題が教科書ページに割り当てられ、前提ページは主ページより前', () => {
  const map = JSON.parse(fs.readFileSync(path.join(tdir, 'question-map.json'), 'utf8'));
  for (const id of questionIds) {
    const m = map[id];
    assert.ok(m, `${id} が question-map.json にない`);
    assert.ok(order.has(m.page), `${id}: page ${m.page} が pages.json にない`);
    for (const a of m.also || []) assert.ok(order.get(a) < order.get(m.page), `${id}: also ${a} は ${m.page} より前のページにする`);
  }
  assert.deepEqual(Object.keys(map).filter((k) => !questionIds.includes(k)), [], '存在しない問題 id がある');
});

for (const p of pages) {
  test(`教科書 ${p.id}: 太字が正しく表示され、用語集の形式が保たれている`, () => {
    const raw = fs.readFileSync(path.join(tdir, `${p.id}.md`), 'utf8');
    const body = raw.replace(/^---[\s\S]*?\n---\n/, '');
    const html = marked.parse(body).replace(/<code>[\s\S]*?<\/code>/g, '');
    const left = html.replace(/<[^>]+>/g, '').match(/.{0,10}\*\*.{0,10}/g);
    assert.equal(left, null, `太字にならない **: ${left?.join(' / ')}`);
    const gloss = (body.split(/^## 用語集\s*$/m)[1] || '').split('\n').filter((l) => l.startsWith('- '));
    assert.ok(gloss.length > 0, '用語集がない');
    for (const l of gloss) assert.match(l, /^- \*\*(.+?)\*\*[:：]/, `用語集の形式でない行: ${l.slice(0, 30)}`);
  });
}
