// 実績バッジの判定と保存。新しく獲得したバッジをトーストで知らせる。
import { content } from './content.js';
import { store } from './store.js';
import { BADGES, earnedBadges } from './core/badges.js';
import { streak, totals } from './core/stats.js';
import { toast } from './ui/components.js';

export { BADGES };

export async function badgeContext() {
  const t = totals(store.states);
  const seen = (kind) => content.questions.filter((q) => q.kind === kind && store.states.get(q.id)?.attempts).length;
  const [exams, sessions, reviewAnswered] = await Promise.all([store.listExams(), store.listSessions(), store.countAttempts((a) => a.mode === 'review')]);
  return {
    answered: t.answered,
    seenA: seen('A'), totalA: content.questions.filter((q) => q.kind === 'A').length,
    seenB: seen('B'), totalB: content.questions.filter((q) => q.kind === 'B').length,
    streak: streak(store.daily),
    topicsDone: content.topics.filter((x) => store.topics.get(x.id)?.rating === 2).length,
    topicsTotal: content.topics.length,
    exams: exams.filter((e) => e.status === 'done' && e.result).map((e) => ({ scaled: e.result.scaled })),
    sessions,
    reviewAnswered,
  };
}

/** 判定して新規獲得分を保存。notify=true なら通知する。@returns {Promise<{earned:Object, fresh:string[]}>} */
export async function checkBadges(notify = true) {
  const earned = await store.getBadges();
  const ids = earnedBadges(await badgeContext());
  const fresh = ids.filter((id) => !earned[id]);
  if (fresh.length) {
    const now = Date.now();
    for (const id of fresh) earned[id] = now;
    await store.saveBadges(earned);
    if (notify) {
      const names = fresh.map((id) => BADGES.find((b) => b.id === id)).filter(Boolean).map((b) => `${b.icon} ${b.name}`);
      setTimeout(() => toast(`実績を獲得: ${names.join('、')}`, 3500), 600);
    }
  }
  return { earned, fresh };
}
