// 実績バッジの定義と判定。ctx は純粋なデータで、判定は副作用なし。
// ctx: { answered, seenA, totalA, seenB, totalB, streak, topicsDone, topicsTotal, exams:[{scaled}], sessions:[{answered, correct}], reviewAnswered }
export const BADGES = [
  { id: 'first', icon: '🌱', name: 'はじめの一歩', desc: '最初の 1 問に回答', test: (c) => c.answered >= 1 },
  { id: 'q50', icon: '✏️', name: '50 問', desc: '累計 50 問に回答', test: (c) => c.answered >= 50 },
  { id: 'q200', icon: '📚', name: '200 問', desc: '累計 200 問に回答', test: (c) => c.answered >= 200 },
  { id: 'q500', icon: '🏔️', name: '500 問', desc: '累計 500 問に回答', test: (c) => c.answered >= 500 },
  { id: 'streak3', icon: '🔥', name: '3 日連続', desc: '3 日続けて学習', test: (c) => c.streak >= 3 },
  { id: 'streak7', icon: '🔥', name: '1 週間連続', desc: '7 日続けて学習', test: (c) => c.streak >= 7 },
  { id: 'streak14', icon: '🔥', name: '2 週間連続', desc: '14 日続けて学習', test: (c) => c.streak >= 14 },
  { id: 'streak30', icon: '🏆', name: '30 日連続', desc: '30 日続けて学習', test: (c) => c.streak >= 30 },
  { id: 'lapA', icon: '🔁', name: '科目A 一周', desc: '科目A の全問題に回答', test: (c) => c.totalA > 0 && c.seenA >= c.totalA },
  { id: 'lapB', icon: '🔁', name: '科目B 一周', desc: '科目B の全問題に回答', test: (c) => c.totalB > 0 && c.seenB >= c.totalB },
  { id: 'perfect', icon: '💯', name: '全問正解', desc: '10 問以上のセッションで全問正解', test: (c) => c.sessions.some((s) => s.answered >= 10 && s.correct === s.answered) },
  { id: 'review50', icon: '🧠', name: '復習 50 問', desc: '復習モードで 50 問に回答', test: (c) => c.reviewAnswered >= 50 },
  { id: 'text10', icon: '📖', name: '教科書 10 ページ', desc: '10 ページを「理解した」に', test: (c) => c.topicsDone >= 10 },
  { id: 'textAll', icon: '🎓', name: '教科書 読破', desc: '全ページを「理解した」に', test: (c) => c.topicsTotal > 0 && c.topicsDone >= c.topicsTotal },
  { id: 'exam1', icon: '📝', name: '模試デビュー', desc: '模擬試験を 1 回受験', test: (c) => c.exams.length >= 1 },
  { id: 'exam3', icon: '📝', name: '模試 3 回', desc: '模擬試験を 3 回受験', test: (c) => c.exams.length >= 3 },
  { id: 'exam600', icon: '🎯', name: '合格ライン', desc: '模試で 600 点以上', test: (c) => c.exams.some((e) => e.scaled >= 600) },
  { id: 'exam700', icon: '⭐', name: '余裕の合格', desc: '模試で 700 点以上', test: (c) => c.exams.some((e) => e.scaled >= 700) },
  { id: 'exam600x2', icon: '🛡️', name: '安定圏', desc: '模試で 600 点以上を 2 回連続', test: (c) => c.exams.length >= 2 && c.exams.slice(-2).every((e) => e.scaled >= 600) },
];

/** 条件を満たすバッジの id 一覧 */
export function earnedBadges(ctx) {
  return BADGES.filter((b) => { try { return b.test(ctx); } catch { return false; } }).map((b) => b.id);
}
