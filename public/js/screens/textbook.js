import { content } from '../content.js';
import { store, settings } from '../store.js';
import { subStats } from '../core/stats.js';
import { esc, pct, toast, topbar } from '../ui/components.js';

const RATING = ['未学習', '学習中', '理解した'];
let query = '';

export function fullscreen(sub) { return !!sub; }

export async function render(root, { sub }) {
  if (sub) return renderPage(root, sub);
  return renderIndex(root);
}

function renderIndex(root) {
  const s = settings.get();
  const stats = new Map(subStats(content.questions, store.states, content.subs).map((x) => [x.sub, x]));
  const topics = content.topics;
  const done = topics.filter((t) => store.topics.get(t.id)?.rating === 2).length;
  const q = query.trim().toLowerCase();
  const hit = (t) => !q || t.title.toLowerCase().includes(q) || (t.terms || []).some((w) => w.toLowerCase().includes(q)) || content.subName(t.sub).toLowerCase().includes(q);
  const cats = content.syllabus.categories;
  const section = (c) => {
    const items = c.subs.flatMap((sub) => topics.filter((t) => t.sub === sub.id && hit(t)).map((t) => {
      const r = store.topics.get(t.id)?.rating || 0;
      const x = stats.get(t.sub);
      const matched = q ? (t.terms || []).filter((w) => w.toLowerCase().includes(q)).slice(0, 3) : [];
      return `<a class="list-item" href="#textbook/${t.id}"><div class="grow"><div>${esc(t.title)}</div>
        <div class="muted">${t.readingMinutes} 分 ・ 関連 ${t.questions} 問${x?.attempted ? ` ・ 正答率 ${pct(x.accuracy)}` : ''}${matched.length ? ` ・ 用語: ${esc(matched.join('、'))}` : ''}</div></div>
        <span class="badge ${r === 2 ? 'badge-ok' : r === 1 ? 'badge-mid' : ''}">${RATING[r]}</span></a>`;
    }));
    if (!items.length) return '';
    return `<h2>${c.kind === '重点' ? '★ ' : ''}${esc(c.middle)} <span class="muted">${esc(c.kind)}分野</span></h2><div class="list">${items.join('')}</div>`;
  };
  root.innerHTML = `
    <h1>教科書</h1>
    <div class="row" style="margin-bottom:8px"><div class="grow"><input type="search" id="q" placeholder="用語・ページ名で検索" value="${esc(query)}" style="width:100%"></div></div>
    <div class="muted" style="margin-bottom:4px">${topics.length} ページ ・ 理解した ${done}</div>
    ${topics.length ? cats.map(section).join('') || '<div class="muted">該当するページがありません</div>' : '<div class="card"><div class="card-title">準備中</div><div class="muted">教科書ページは配信待ちです。</div></div>'}`;
  const input = root.querySelector('#q');
  let timer = null;
  input.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { query = input.value; const pos = input.selectionStart; renderIndex(root); const el = root.querySelector('#q'); el.focus(); el.setSelectionRange(pos, pos); }, 250); };
}

async function renderPage(root, id) {
  const t = await content.getTopic(id);
  const s = settings.get();
  const order = content.topics;
  const i = order.findIndex((x) => x.id === id);
  const prev = i > 0 ? order[i - 1] : null, next = i >= 0 && i < order.length - 1 ? order[i + 1] : null;
  const st = store.topics.get(id);
  const related = t.relatedQuestionIds || [];
  const seen = related.filter((q) => store.states.get(q)?.attempts).length;
  const correct = related.filter((q) => store.states.get(q)?.lastCorrect).length;
  const subInfo = content.subs.get(t.sub);
  root.innerHTML = `
    ${topbar(t.title, '#textbook')}
    <div class="muted" style="margin:-6px 0 10px">${esc(subInfo?.middle || '')} › ${esc(subInfo?.name || '')} ・ 約 ${t.readingMinutes} 分${t.updatedAt ? ` ・ ${esc(t.updatedAt)} 更新` : ''}</div>
    <article class="topic">${t.html}</article>
    <div class="card"><div class="card-title">関連する問題 ${related.length} 問</div>
      <div class="muted" style="margin-bottom:8px">出題済み ${seen} ・ 最新回答で正解 ${correct}</div>
      ${related.length ? `<a class="btn btn-primary" href="#quiz/run?mode=ids&ids=${related.join(',')}&count=${Math.min(related.length, s.sessionSize || 10)}&label=${encodeURIComponent(t.title)}">この分野の問題を解く</a>` : ''}</div>
    <div class="card"><div class="card-title">このページの理解度</div>
      <div class="rating">${RATING.map((r, k) => `<button type="button" class="btn ${st?.rating === k ? 'btn-primary' : ''}" data-r="${k}">${r}</button>`).join('')}</div></div>
    <div class="row">${prev ? `<a class="btn btn-ghost" href="#textbook/${prev.id}">‹ ${esc(prev.title)}</a>` : '<span class="grow"></span>'}${next ? `<a class="btn btn-ghost" href="#textbook/${next.id}">${esc(next.title)} ›</a>` : ''}</div>`;
  root.querySelector('.rating').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-r]');
    if (!b) return;
    await store.rateTopic(id, Number(b.dataset.r));
    root.querySelectorAll('.rating button').forEach((x) => x.classList.toggle('btn-primary', x === b));
    toast(`「${RATING[b.dataset.r]}」として記録しました`);
  });
}
