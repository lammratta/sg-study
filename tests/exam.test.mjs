import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeExam, scoreExam, groupOf, fmtClock } from '../public/js/core/exam.js';
import { earnedBadges } from '../public/js/core/badges.js';

const subs = new Map([
  ['A1-1', { kind: '重点', field: 'T' }], ['A2-1', { kind: '重点', field: 'S' }],
  ['A3-1', { kind: '関連', field: 'T' }], ['A6-1', { kind: '関連', field: 'M' }], ['A9-1', { kind: '関連', field: 'S' }],
]);
const mk = (n, kind, sub) => Array.from({ length: n }, (_, i) => ({ id: `${sub}-${kind}-${i}`, kind, sub }));
const index = [...mk(40, 'A', 'A1-1'), ...mk(6, 'A', 'A2-1'), ...mk(6, 'A', 'A3-1'), ...mk(8, 'A', 'A6-1'), ...mk(8, 'A', 'A9-1'), ...mk(20, 'B', null)];
let seed = 1; const rng = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };

test('模試: 48 + 12 問を配分どおりに重複なく組む', () => {
  const ex = composeExam(index, new Map(), subs, { rng });
  assert.equal(ex.qids.length, 60);
  assert.equal(new Set(ex.qids).size, 60);
  const count = (g) => ex.qids.filter((q) => ex.groups[q] === g).length;
  assert.deepEqual([count('security'), count('legal'), count('T'), count('M'), count('S'), count('B')], [28, 4, 4, 6, 6, 12]);
  assert.deepEqual(ex.shortage, {});
});

test('模試: 未出題を優先し、分野の在庫不足は他分野で補う', () => {
  const now = 100 * 86400000;
  const states = new Map(index.filter((q) => q.kind === 'B').slice(0, 15).map((q) => [q.id, { attempts: 1, lastTs: now - 1000 }]));
  const ex = composeExam(index, states, subs, { rng, now });
  const b = ex.qids.filter((q) => ex.groups[q] === 'B');
  assert.equal(b.filter((q) => !states.has(q)).length, 5, '未出題の 5 問はすべて入る');
  assert.equal(ex.reusedB, 7);
  const small = index.filter((q) => q.sub !== 'A2-1' || q.id.endsWith('-0'));
  const ex2 = composeExam(small, new Map(), subs, { rng });
  assert.equal(ex2.qids.filter((q) => ex2.groups[q] !== 'B').length, 48);
  assert.equal(ex2.shortage.legal, 3);
});

test('模試: 換算は 0.8 × A + 0.2 × B', () => {
  const items = [...Array.from({ length: 48 }, (_, i) => ({ qid: `a${i}`, group: 'security', sub: 'A1-1', correct: i < 36, answered: i < 40 })), ...Array.from({ length: 12 }, (_, i) => ({ qid: `b${i}`, group: 'B', correct: i < 6, answered: true }))];
  const r = scoreExam(items);
  assert.equal(r.correctA, 36); assert.equal(r.correctB, 6); assert.equal(r.unanswered, 8);
  assert.equal(r.scaled, Math.round(1000 * (0.8 * 0.75 + 0.2 * 0.5)));
  assert.equal(groupOf({ kind: 'A', sub: 'A2-1' }, subs), 'legal');
  assert.equal(fmtClock(61000), '1:01');
});

test('バッジ: 条件を満たした id を返す', () => {
  const ctx = { answered: 60, seenA: 10, totalA: 96, seenB: 26, totalB: 26, streak: 7, topicsDone: 0, topicsTotal: 36, exams: [{ scaled: 580 }, { scaled: 640 }], sessions: [{ answered: 10, correct: 10 }], reviewAnswered: 3 };
  assert.deepEqual(earnedBadges(ctx), ['first', 'q50', 'streak3', 'streak7', 'lapB', 'perfect', 'exam1', 'exam600']);
});
