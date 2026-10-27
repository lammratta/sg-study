import { content } from '../content.js';
import { store, settings } from '../store.js';
import { dayKey, streak, daysUntil, subStats, endOfDay } from '../core/stats.js';
import { dueQuestions } from '../core/srs.js';
import { weakSubs } from '../core/select.js';
import { esc, pct, fmtMin } from '../ui/components.js';
import { ring } from '../ui/charts.js';

export async function render(root) {
  const s = settings.get();
  const today = store.daily.get(dayKey()) || { answered: 0, correct: 0, studyMs: 0 };
  const left = daysUntil(s.examDate);
  const due = dueQuestions([...store.states.values()], endOfDay(), 50).length;
  const stats = subStats(content.questions.filter((q) => q.kind === 'A'), store.states, content.subs);
  const weak = weakSubs(stats).map((id) => stats.find((x) => x.sub === id)).filter(Boolean);
  const unseen = content.questions.filter((q) => q.kind === 'A' && !store.states.get(q.id)?.attempts).length;
  const pace = left && left > 0 ? Math.ceil(unseen / left) : null;
  const backupAge = s.lastBackupTs ? Math.floor((Date.now() - s.lastBackupTs) / 86400000) : null;
  const answeredSince = [...store.states.values()].reduce((n, x) => n + (x.attempts || 0), 0);
  const needBackup = (backupAge === null && answeredSince >= 30) || (backupAge !== null && backupAge >= 14);
  root.innerHTML = `
    <div class="row" style="justify-content:space-between"><h1 style="margin:0">SG 学習</h1>
      <span class="badge">${left === null ? '試験日未設定' : left > 0 ? `試験まで ${left} 日` : left === 0 ? '試験当日' : '試験終了'}</span></div>
    <div class="card"><div class="row">
      ${ring(today.answered / (s.dailyGoal || 10), `${today.answered}/${s.dailyGoal}`)}
      <div class="grow"><div class="card-title">今日の学習</div>
        <div>正答率 ${today.answered ? pct(today.correct / today.answered) : '–'} ・ ${fmtMin(today.studyMs)}</div>
        <div class="muted">🔥 連続 ${streak(store.daily)} 日${pace ? ` ・ 1 日 ${pace} 問で全問 1 周` : ''}</div></div></div></div>
    <a class="btn btn-primary" href="#quiz/run?mode=unseen&count=${s.sessionSize || 10}">${s.sessionSize || 10} 問クイック演習（未出題優先）</a>
    <a class="btn" href="#quiz">演習メニュー</a>
    <h2>今日のおすすめ</h2>
    <div class="list">
      ${due ? `<a class="list-item" href="#quiz/run?mode=review&count=${Math.min(due, 20)}"><div class="grow"><div>今日の復習</div><div class="muted">期限が来た問題 ${due} 問</div></div><span class="chev">›</span></a>` : ''}
      ${weak.length ? `<a class="list-item" href="#quiz/run?mode=sub&sub=${weak[0].sub}&count=${s.sessionSize || 10}"><div class="grow"><div>弱点分野: ${esc(weak[0].name)}</div><div class="muted">正答率 ${pct(weak[0].accuracy)}（${weak[0].attempted} 問）</div></div><span class="chev">›</span></a>` : ''}
      ${!due && !weak.length ? '<div class="muted">演習を始めると、復習と弱点がここに出ます。</div>' : ''}
    </div>
    ${needBackup ? `<a class="list-item" href="#settings" style="margin-top:12px"><div class="grow"><div>バックアップをおすすめします</div><div class="muted">${backupAge === null ? 'まだ一度も保存していません' : `最後の保存から ${backupAge} 日`}</div></div><span class="chev">›</span></a>` : ''}`;
}
