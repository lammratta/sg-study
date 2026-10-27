// 出題選択。候補に重みを付けて非復元抽出する。
const DAY = 86400000;

export function weightOf(entry, state, now) {
  if (!state || !state.attempts) return 3.0;           // 未出題
  let w = 1.0;
  if (state.srs?.dueTs && state.srs.dueTs <= now) w = Math.max(w, 2.0); // 復習期限
  if (state.lastCorrect === false) w = Math.max(w, 2.0);               // 最新が誤答
  if (state.streak >= 3) w = 0.3;                                      // 定着済み
  if (now - (state.lastTs || 0) < DAY) w = Math.min(w, 0.1);           // 直近 24 時間に出題
  return w;
}

/**
 * @param {Array} candidates 問題一覧エントリ（{id, kind, sub, outdated}）
 * @param {Map} states qid -> questionState
 */
export function pickQuestions(candidates, states, count, now = Date.now(), rng = Math.random) {
  const pool = candidates.map((c) => ({ id: c.id, w: weightOf(c, states.get(c.id), now) }));
  const picked = [];
  while (picked.length < count && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = rng() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { idx = i; break; } }
    picked.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return picked;
}

/** 未出題を優先し、足りなければ重み抽選で補う */
export function pickUnseenFirst(candidates, states, count, now, rng) {
  const unseen = candidates.filter((c) => !states.get(c.id)?.attempts);
  const shuffled = [...unseen].sort(() => (rng ? rng() : Math.random()) - 0.5).slice(0, count).map((c) => c.id);
  if (shuffled.length >= count) return shuffled;
  const rest = candidates.filter((c) => !shuffled.includes(c.id));
  return shuffled.concat(pickQuestions(rest, states, count - shuffled.length, now, rng));
}

/** 弱点分野: 出題 5 問以上かつ正答率 60% 未満。無ければ正答率の低い 3 分野 */
export function weakSubs(subStats) {
  const attempted = subStats.filter((s) => s.attempted >= 1);
  const weak = attempted.filter((s) => s.attempted >= 5 && s.accuracy < 0.6);
  if (weak.length) return weak.map((s) => s.sub);
  return attempted.sort((a, b) => a.accuracy - b.accuracy).slice(0, 3).map((s) => s.sub);
}
