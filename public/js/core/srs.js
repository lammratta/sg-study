// 間隔反復（階段方式）。正解で 1 段上がり、誤答で 0 段目に戻る。
export const STEPS_DAYS = [1, 3, 7, 14, 30, 60];
const DAY = 86400000;

/** @returns {{step:number, dueTs:number, reps:number}} */
export function nextSrs(prev, correct, now) {
  const reps = (prev?.reps || 0) + 1;
  if (!correct) return { step: 0, dueTs: now + STEPS_DAYS[0] * DAY, reps };
  const step = Math.min((prev?.step ?? -1) + 1, STEPS_DAYS.length - 1);
  return { step, dueTs: now + STEPS_DAYS[step] * DAY, reps };
}

/** 復習期限が来ている問題（期限の古い順） */
export function dueQuestions(states, endOfTodayTs, limit = 20) {
  return states
    .filter((s) => s.srs && s.srs.dueTs && s.srs.dueTs <= endOfTodayTs)
    .sort((a, b) => a.srs.dueTs - b.srs.dueTs)
    .slice(0, limit)
    .map((s) => s.qid);
}
