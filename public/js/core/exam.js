// 模擬試験の構成とスコア換算。すべて純粋関数。
const DAY = 86400000;

export const EXAM_SPEC = {
  nA: 48,
  nB: 12,
  durationMs: 120 * 60 * 1000,
  // 科目A の分野配分（既定）。順に セキュリティ・法務（重点）、テクノロジ・マネジメント・ストラテジ（関連）
  distribution: [['security', 28], ['legal', 4], ['T', 4], ['M', 6], ['S', 6]],
  weights: { a: 0.8, b: 0.2 },
};

export const GROUP_NAMES = { security: 'セキュリティ', legal: '法務', T: 'テクノロジ', M: 'マネジメント', S: 'ストラテジ', B: '科目B' };

/** 問題一覧エントリの所属グループ */
export function groupOf(q, subs) {
  if (q.kind === 'B') return 'B';
  const s = subs.get(q.sub);
  if (!s) return 'T';
  if (s.kind === '重点') return s.field === 'S' ? 'legal' : 'security';
  return s.field || 'T';
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * 模試の出題を組む。未出題 → 30 日より前に出題 → 直近 30 日に出題 の順に優先し、各段の中はシャッフルする。
 * @returns {{qids:string[], groups:Object<string,string>, shortage:Object<string,number>, reusedB:number}}
 */
export function composeExam(index, states, subs, { now = Date.now(), rng = Math.random, recentMs = 30 * DAY, spec = EXAM_SPEC, includeOutdated = true } = {}) {
  const pool = index.filter((q) => includeOutdated || !q.outdated);
  const tier = (q) => { const s = states.get(q.id); if (!s?.attempts) return 0; return now - (s.lastTs || 0) < recentMs ? 2 : 1; };
  const byGroup = new Map();
  for (const q of pool) { const g = groupOf(q, subs); if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(q); }
  const used = new Set();
  const groups = {};
  const take = (list, n) => {
    const out = [];
    for (const t of [0, 1, 2]) {
      for (const q of shuffle(list.filter((q) => !used.has(q.id) && tier(q) === t), rng)) { if (out.length >= n) break; out.push(q); used.add(q.id); }
      if (out.length >= n) break;
    }
    return out;
  };
  const shortage = {};
  const a = [];
  for (const [g, n] of spec.distribution) {
    const got = take(byGroup.get(g) || [], n);
    if (got.length < n) shortage[g] = n - got.length;
    for (const q of got) { groups[q.id] = g; a.push(q.id); }
  }
  const missing = spec.nA - a.length;
  if (missing > 0) {
    const restA = pool.filter((q) => q.kind === 'A');
    for (const q of take(restA, missing)) { groups[q.id] = groupOf(q, subs); a.push(q.id); }
  }
  const b = take(byGroup.get('B') || [], spec.nB);
  for (const q of b) groups[q.id] = 'B';
  const reusedB = b.filter((q) => tier(q) > 0).length;
  return { qids: a.concat(b.map((q) => q.id)), groups, shortage, reusedB };
}

/**
 * 採点。items: [{qid, group, sub, correct, answered}]
 * 換算目安 = 1000 × (0.8 × 科目A 正答率 + 0.2 × 科目B 正答率)。本番の IRT 採点とは異なる。
 */
export function scoreExam(items, weights = EXAM_SPEC.weights) {
  const a = items.filter((x) => x.group !== 'B');
  const b = items.filter((x) => x.group === 'B');
  const nA = a.length, nB = b.length;
  const correctA = a.filter((x) => x.correct).length;
  const correctB = b.filter((x) => x.correct).length;
  const rateA = nA ? correctA / nA : 0;
  const rateB = nB ? correctB / nB : 0;
  const wA = nB ? weights.a : 1, wB = nB ? weights.b : 0;
  const scaled = Math.round(1000 * (wA * rateA + wB * rateB));
  const perGroup = {};
  const perSub = {};
  for (const x of items) {
    const g = perGroup[x.group] || (perGroup[x.group] = { n: 0, c: 0 });
    g.n += 1; if (x.correct) g.c += 1;
    if (x.sub) { const s = perSub[x.sub] || (perSub[x.sub] = { n: 0, c: 0 }); s.n += 1; if (x.correct) s.c += 1; }
  }
  return { nA, correctA, nB, correctB, scaled, perGroup, perSub, unanswered: items.filter((x) => !x.answered).length };
}

export function fmtClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
