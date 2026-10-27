import { content } from '../content.js';
import { store, settings } from '../store.js';
import { streak, heatmap, subStats, totals, readiness, retention } from '../core/stats.js';
import { esc, pct, fmtMin } from '../ui/components.js';
import { bar, heatmapHtml, lineChart } from '../ui/charts.js';
import { BADGES, checkBadges } from '../badges.js';

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
  const rd = readiness(content.questions, store.states, content.subs);
  const rt = retention(content.questions.filter((q) => q.kind === 'A'), store.states);
  const topicsDone = content.topics.filter((t) => store.topics.get(t.id)?.rating === 2).length;
  const groupName = { aCore: '科目A 重点分野', aRelated: '科目A 関連分野', b: '科目B' };
  const sessions = (await store.listSessions()).sort((a, b) => b.endTs - a.endTs).slice(0, 5);
  const exams = (await store.listExams()).filter((e) => e.status === 'done' && e.result);
  const { earned } = await checkBadges(false);
  const nEarned = BADGES.filter((b) => earned[b.id]).length;
  root.innerHTML = `
    <h1>進捗</h1>
    <div class="stat-grid">
      <div class="stat"><div class="v">${t.answered}</div><div class="l">回答数</div></div>
      <div class="stat"><div class="v">${t.answered ? pct(t.correct / t.answered) : '–'}</div><div class="l">累計正答率</div></div>
      <div class="stat"><div class="v">${streak(store.daily)}</div><div class="l">連続日数</div></div>
    </div>
    <div class="card"><div class="card-title">合格目安 <span class="muted">（1,000 点換算の目安。本番は IRT 採点）</span></div>
      ${rd.enough ? `<div class="summary-big" style="color:${rd.score >= 600 ? 'var(--ok)' : 'var(--text)'}">${rd.score} <span class="muted" style="font-size:1rem">/ 1000</span></div>${bar(rd.score / 1000, rd.score >= 600 ? 'ok' : '')}` : `<div class="muted">20 問以上回答すると表示されます（今 ${rd.groups.aCore.n + rd.groups.aRelated.n + rd.groups.b.n} 問）</div>`}
      <div class="muted" style="margin-top:6px">${Object.entries(rd.groups).map(([k, g]) => `${groupName[k]} ${g.n ? pct(g.c / g.n) : '未着手'}`).join(' ・ ')}</div>
      <div class="muted">定着（7 日以上の間隔に到達）${rt.done} / ${rt.n} 問 ・ 教科書 理解した ${topicsDone} / ${content.topics.length} ページ</div></div>
    <div class="card"><div class="card-title">模試スコア推移 <span class="muted">（合格ライン 600）</span></div>${exams.length ? lineChart(exams.map((e) => e.result.scaled), { goal: 600, max: 1000 }) + `<div class="muted">最新 ${exams[exams.length - 1].result.scaled} 点 ・ 最高 ${Math.max(...exams.map((e) => e.result.scaled))} 点 ・ ${exams.length} 回</div>` : '<div class="muted">まだ受験していません。</div>'}<a class="btn btn-small" href="#exam" style="margin-top:8px">模擬試験へ</a></div>
    <div class="card"><div class="card-title">実績 <span class="muted">${nEarned} / ${BADGES.length}</span></div><div class="badges">${BADGES.map((b) => `<div class="badge-card ${earned[b.id] ? '' : 'locked'}" title="${esc(b.desc)}"><div class="ic">${b.icon}</div><div class="n">${esc(b.name)}</div><div class="d">${earned[b.id] ? new Date(earned[b.id]).toLocaleDateString('ja-JP') : esc(b.desc)}</div></div>`).join('')}</div></div>
    <div class="card"><div class="card-title">学習カレンダー <span class="muted">（直近 16 週・${fmtMin(studyMs)}）</span></div>${heatmapHtml(heatmap(store.daily), s.dailyGoal)}</div>
    <div class="card"><div class="card-title">科目A 分野別 <span class="muted">（最新回答の正答率。タップで演習）</span></div>${rows(statsA) || '<div class="muted">まだ記録がありません</div>'}</div>
    <div class="card"><div class="card-title">科目B</div>${rows(statsB) || '<div class="muted">まだ記録がありません</div>'}</div>
    <div class="card"><div class="card-title">最近のセッション</div>${sessions.map((x) => `<div class="row" style="padding:4px 0"><div class="grow">${esc(x.label || x.mode)}</div><div class="muted">${x.correct} / ${x.answered} ・ ${new Date(x.endTs).toLocaleDateString('ja-JP')}</div></div>`).join('') || '<div class="muted">まだありません</div>'}</div>`;
}
