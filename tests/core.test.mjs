import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSrs, dueQuestions, STEPS_DAYS } from '../public/js/core/srs.js';
import { pickQuestions, pickUnseenFirst, weakSubs, weightOf } from '../public/js/core/select.js';
import { streak, addDays, daysUntil, subStats, heatmap } from '../public/js/core/stats.js';

const DAY = 86400000;

test('SRS: 正解で段が上がり、誤答で 0 段目に戻る', () => {
  const now = 1_000_000;
  let s = nextSrs(null, true, now);
  assert.equal(s.step, 0); assert.equal(s.dueTs, now + STEPS_DAYS[0] * DAY);
  s = nextSrs(s, true, now); assert.equal(s.step, 1);
  s = nextSrs(s, true, now); s = nextSrs(s, true, now); s = nextSrs(s, true, now); s = nextSrs(s, true, now); s = nextSrs(s, true, now);
  assert.equal(s.step, STEPS_DAYS.length - 1, '最上段で止まる');
  s = nextSrs(s, false, now); assert.equal(s.step, 0); assert.equal(s.reps, 8);
});

test('SRS: 期限が来た問題だけを古い順に返す', () => {
  const states = [
    { qid: 'a', srs: { dueTs: 300 } }, { qid: 'b', srs: { dueTs: 100 } }, { qid: 'c', srs: { dueTs: 900 } }, { qid: 'd', srs: null },
  ];
  assert.deepEqual(dueQuestions(states, 500), ['b', 'a']);
});

test('出題選択: 未出題は重み 3、定着済みは 0.3、直近出題は 0.1', () => {
  const now = 10 * DAY;
  assert.equal(weightOf({}, undefined, now), 3);
  assert.equal(weightOf({}, { attempts: 4, streak: 3, lastTs: now - 2 * DAY }, now), 0.3);
  assert.equal(weightOf({}, { attempts: 1, streak: 1, lastTs: now - 1000 }, now), 0.1);
  assert.equal(weightOf({}, { attempts: 2, streak: 0, lastCorrect: false, lastTs: now - 2 * DAY }, now), 2);
});

test('出題選択: 重複なく指定数を返し、未出題優先は未出題を先に出す', () => {
  const cands = Array.from({ length: 6 }, (_, i) => ({ id: `q${i}` }));
  const states = new Map([['q0', { attempts: 1, streak: 1, lastTs: 0 }], ['q1', { attempts: 1, streak: 1, lastTs: 0 }]]);
  const picked = pickQuestions(cands, states, 4, DAY * 5, () => 0.5);
  assert.equal(new Set(picked).size, 4);
  const first = pickUnseenFirst(cands, states, 5, DAY * 5, () => 0.5);
  assert.equal(first.length, 5);
  assert.ok(!first.slice(0, 4).includes('q0') && !first.slice(0, 4).includes('q1'));
});

test('弱点分野: 出題 5 問以上かつ 60% 未満。無ければ低い順に 3 つ', () => {
  const stats = [
    { sub: 'A', attempted: 6, accuracy: 0.5 }, { sub: 'B', attempted: 6, accuracy: 0.9 }, { sub: 'C', attempted: 2, accuracy: 0 },
  ];
  assert.deepEqual(weakSubs(stats), ['A']);
  assert.deepEqual(weakSubs([{ sub: 'X', attempted: 1, accuracy: 1 }, { sub: 'Y', attempted: 1, accuracy: 0 }]), ['Y', 'X']);
});

test('連続日数: 今日が未学習なら昨日までを数える', () => {
  const m = new Map([['2026-10-25', { answered: 3 }], ['2026-10-26', { answered: 1 }]]);
  assert.equal(streak(m, '2026-10-26'), 2);
  assert.equal(streak(m, '2026-10-27'), 2);
  assert.equal(streak(m, '2026-10-28'), 0);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(daysUntil('2026-11-29', '2026-10-27'), 33);
});

test('分野別指標: カバー率・正答率・弱点判定', () => {
  const index = [{ id: 'a', sub: 'S1' }, { id: 'b', sub: 'S1' }, { id: 'c', sub: 'S2' }];
  const states = new Map([['a', { attempts: 3, lastCorrect: true }], ['b', { attempts: 1, lastCorrect: false }]]);
  const subs = new Map([['S1', { name: '一' }], ['S2', { name: '二' }]]);
  const st = subStats(index, states, subs);
  const s1 = st.find((x) => x.sub === 'S1');
  assert.equal(s1.coverage, 1); assert.equal(s1.accuracy, 0.5); assert.equal(s1.weak, false);
  assert.equal(st.find((x) => x.sub === 'S2').attempted, 0);
});

test('ヒートマップ: 今日で終わる', () => {
  const cells = heatmap(new Map(), 2, '2026-10-27');
  assert.equal(cells.at(-1).day, '2026-10-27');
  assert.ok(cells.length >= 14);
});
