import { content } from '../content.js';
import { store, settings } from '../store.js';
import { subStats } from '../core/stats.js';
import { esc, pct } from '../ui/components.js';

export async function render(root) {
  const s = settings.get();
  const stats = new Map(subStats(content.questions, store.states, content.subs).map((x) => [x.sub, x]));
  const cats = content.syllabus.categories;
  root.innerHTML = `
    <h1>教科書</h1>
    <div class="card"><div class="card-title">準備中</div><div class="muted">シラバス Ver.4.1 に沿った解説ページは Phase 2 で追加します。今は分野ごとの問題数と正答率を確認し、分野を選んで演習できます。</div></div>
    ${cats.map((c) => `<h2>${c.kind === '重点' ? '★ ' : ''}${esc(c.middle)} <span class="muted">${esc(c.kind)}分野</span></h2>
      <div class="list">${c.subs.map((sub) => { const x = stats.get(sub.id); return `
        <a class="list-item" href="${x?.total ? `#quiz/run?mode=sub&sub=${sub.id}&count=${s.sessionSize || 10}` : '#textbook'}">
          <div class="grow"><div>${esc(sub.name)}</div><div class="muted">${x?.total ? `${x.total} 問 ・ 出題済み ${x.attempted} ・ 正答率 ${x.attempted ? pct(x.accuracy) : '–'}` : '問題なし'}</div></div>
          ${x?.total ? '<span class="chev">›</span>' : ''}</a>`; }).join('')}</div>`).join('')}`;
}
