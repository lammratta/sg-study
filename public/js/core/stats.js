// 日次集計・連続日数・分野別指標。すべて純粋関数。
const DAY = 86400000;

export function dayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
export function endOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - 1;
}
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}
export function daysUntil(dateStr, today = dayKey()) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - new Date(ty, tm - 1, td)) / DAY);
}

/** 連続学習日数。今日に記録がなければ昨日までの連続を数える */
export function streak(dailyMap, today = dayKey()) {
  const active = (k) => { const s = dailyMap.get(k); return !!s && (s.answered > 0 || s.topicsRead > 0); };
  let day = active(today) ? today : addDays(today, -1);
  let n = 0;
  while (active(day)) { n += 1; day = addDays(day, -1); }
  return n;
}

/** 直近 weeks 週分のヒートマップ用データ（古い順） */
export function heatmap(dailyMap, weeks = 16, today = dayKey()) {
  const out = [];
  const [ty, tm, td] = today.split('-').map(Number);
  const todayDate = new Date(ty, tm - 1, td);
  const start = new Date(todayDate);
  start.setDate(start.getDate() - (weeks * 7 - 1) - todayDate.getDay());
  for (let i = 0; i < weeks * 7 + todayDate.getDay() + 1; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (d > todayDate) break;
    const k = dayKey(d);
    out.push({ day: k, answered: dailyMap.get(k)?.answered || 0 });
  }
  return out;
}

/** 分野別の指標。index: 問題一覧、states: Map qid -> state */
export function subStats(index, states, subs) {
  const acc = new Map();
  for (const q of index) {
    if (!q.sub) continue;
    if (!acc.has(q.sub)) acc.set(q.sub, { sub: q.sub, total: 0, attempted: 0, correct: 0 });
    const a = acc.get(q.sub);
    a.total += 1;
    const s = states.get(q.id);
    if (s?.attempts) { a.attempted += 1; if (s.lastCorrect) a.correct += 1; }
  }
  return [...acc.values()].map((a) => ({
    ...a,
    name: subs.get(a.sub)?.name || a.sub,
    category: subs.get(a.sub)?.category,
    kind: subs.get(a.sub)?.kind,
    coverage: a.total ? a.attempted / a.total : 0,
    accuracy: a.attempted ? a.correct / a.attempted : 0,
    weak: a.attempted >= 5 && a.correct / a.attempted < 0.6,
  }));
}

export function totals(states) {
  let answered = 0, correct = 0, seen = 0;
  for (const s of states.values()) { answered += s.attempts || 0; correct += s.correct || 0; if (s.attempts) seen += 1; }
  return { answered, correct, seen };
}

export const DEFAULT_WEIGHTS = { aCore: 0.55, aRelated: 0.25, b: 0.2 };

/** 合格目安スコア（1000 点換算の目安。IRT ではない）。グループごとの最新回答の正答率を配点ウェイトで合成する */
export function readiness(index, states, subs, weights = DEFAULT_WEIGHTS) {
  const g = { aCore: { n: 0, c: 0 }, aRelated: { n: 0, c: 0 }, b: { n: 0, c: 0 } };
  for (const q of index) {
    const s = states.get(q.id);
    if (!s?.attempts) continue;
    const key = q.kind === 'B' ? 'b' : subs.get(q.sub)?.kind === '重点' ? 'aCore' : 'aRelated';
    g[key].n += 1;
    if (s.lastCorrect) g[key].c += 1;
  }
  let score = 0;
  const missing = [];
  for (const k of Object.keys(weights)) {
    if (g[k].n === 0) missing.push(k);
    else score += weights[k] * (g[k].c / g[k].n);
  }
  const total = g.aCore.n + g.aRelated.n + g.b.n;
  return { score: Math.round(score * 1000), groups: g, missing, enough: total >= 20 };
}

/** 定着率: 間隔反復で 7 日以上の段に達した問題の割合 */
export function retention(index, states) {
  let n = 0, done = 0;
  for (const q of index) { n += 1; const s = states.get(q.id); if (s?.srs && s.srs.step >= 2) done += 1; }
  return { n, done, ratio: n ? done / n : 0 };
}
