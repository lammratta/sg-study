import { content } from '../content.js';
import { store, settings } from '../store.js';
import { streak, heatmap, subStats, totals } from '../core/stats.js';
import { esc, pct, fmtMin } from '../ui/components.js';
import { bar, heatmapHtml } from '../ui/charts.js';

export async function render(root) {
  const s = settings.get();
  const t = totals(store.states);
  const studyMs = [...store.daily.values()].reduce((n, d) => n + (d.studyMs || 0), 0);
  const statsA = subStats(content.questions.filter((q) => q.kind === 'A'), store.states, content.subs);
  const statsB = subStats(content.questions.filter((q) => q.kind === 'B'), store.states, content.subs);
  const order = [...content.subs.keys()];
  const rows = (stats) => stats.sort((a, b) => order.indexOf(a.sub) - order.indexOf(b.sub)).map((x) => `
    <a class="row" style="padding:6px 0;text-decoration:none;color:inherit" href="#quiz/run?mode=sub&sub=${x.sub}&count=${s.sessionSize || 10}">
      <div class="grow"><div class="row" style="justify-content:space-between"><span>${x.kind === '重点' ? '★ ' : ''}${esc(x.name)}${x.weak ? ' <span class="badge badge-warn">弱点</span>' : ''}</span><span class="muted">${x.correct} / ${x.attempted}（全 ${x.total}）</span></div>
      ${bar(x.attempted ? x.accuracy : 0, x.attempted ? (x.accuracy >= 0.8 ? 'ok' : x.weak ? 'ng' : '') : '')}</div></a>`).join('');
  const sessions = (await (await import('../db.js')).getAll('sessions')).sort((a, b) => b.endTs - a.endTs).slice(0, 5);
  root.innerHTML = `
    <h1>進捗</h1>
    <div class="stat-grid">
      <div class="stat"><div class="v">${t.answered}</div><div class="l">回答数</div></div>
      <div class="stat"><div class="v">${t.answered ? pct(t.correct / t.answered) : '–'}</div><div class="l">累計正答率</div></div>
      <div class="stat"><div class="v">${streak(store.daily)}</div><div class="l">連続日数</div></div>
    </div>
    <div class="card"><div class="card-title">学習カレンダー <span class="muted">（直近 16 週・${fmtMin(studyMs)}）</span></div>${heatmapHtml(heatmap(store.daily), s.dailyGoal)}</div>
    <div class="card"><div class="card-title">科目A 分野別 <span class="muted">（最新回答の正答率。タップで演習）</span></div>${rows(statsA) || '<div class="muted">まだ記録がありません</div>'}</div>
    <div class="card"><div class="card-title">科目B</div>${rows(statsB) || '<div class="muted">まだ記録がありません</div>'}</div>
    <div class="card"><div class="card-title">最近のセッション</div>${sessions.map((x) => `<div class="row" style="padding:4px 0"><div class="grow">${esc(x.label || x.mode)}</div><div class="muted">${x.correct} / ${x.answered} ・ ${new Date(x.endTs).toLocaleDateString('ja-JP')}</div></div>`).join('') || '<div class="muted">まだありません</div>'}</div>`;
}
