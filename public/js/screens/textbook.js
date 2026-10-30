import { content } from '../content.js';
import { checkBadges } from '../badges.js';
import { store } from '../store.js';
import { esc, toast, topbar } from '../ui/components.js';

const RATING = ['未学習', '学習中', '理解した'];
let query = '';

export function fullscreen(sub) { return !!sub; }

export async function render(root, { sub }) {
  if (sub) return renderPage(root, sub);
  return renderIndex(root);
}

function renderIndex(root) {
  const topics = content.topics;
  const done = topics.filter((t) => store.topics.get(t.id)?.rating === 2).length;
  const q = query.trim().toLowerCase();
  const hit = (t) => !q || t.title.toLowerCase().includes(q) || (t.terms || []).some((w) => w.toLowerCase().includes(q)) || content.subName(t.sub).toLowerCase().includes(q);
  const cats = content.syllabus.categories;
  const section = (c) => {
    const items = c.subs.flatMap((sub) => topics.filter((t) => t.sub === sub.id && hit(t)).map((t) => {
      const r = store.topics.get(t.id)?.rating || 0;
      const ids = t.questionIds || [];
      const tried = ids.filter((id) => store.states.get(id)?.attempts);
      const ok = tried.filter((id) => store.states.get(id)?.lastCorrect).length;
      const matched = q ? (t.terms || []).filter((w) => w.toLowerCase().includes(q)).slice(0, 3) : [];
      return `<a class="list-item" href="#textbook/${t.id}"><div class="grow"><div>${esc(t.title)}</div>
        <div class="muted">${t.readingMinutes} 分 ・ ${ids.length ? `確認テスト ${ids.length} 問${tried.length ? ` ・ 正解 ${ok} / ${tried.length}` : ''}` : '確認テストなし'}${matched.length ? ` ・ 用語: ${esc(matched.join('、'))}` : ''}</div></div>
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
  const order = content.topics;
  const i = order.findIndex((x) => x.id === id);
  const prev = i > 0 ? order[i - 1] : null, next = i >= 0 && i < order.length - 1 ? order[i + 1] : null;
  const st = store.topics.get(id);
  const related = (t.relatedQuestionIds || []).filter((q) => content.byId.has(q));
  const seen = related.filter((q) => store.states.get(q)?.attempts).length;
  const correct = related.filter((q) => store.states.get(q)?.lastCorrect).length;
  const isOrig = (q) => !!content.byId.get(q).original;
  const idsA = related.filter((q) => !isOrig(q) && content.byId.get(q).kind === 'A');
  const idsB = related.filter((q) => !isOrig(q) && content.byId.get(q).kind === 'B');
  const idsO = related.filter(isOrig);
  const nOfficial = idsA.length + idsB.length;
  const runUrl = (ids, label) => `#quiz/run?mode=ids&ids=${ids.join(',')}&count=${ids.length}&label=${encodeURIComponent(label)}`;
  const subInfo = content.subs.get(t.sub);
  root.innerHTML = `
    ${topbar(t.title, '#textbook')}
    <div class="muted" style="margin:-6px 0 10px">${esc(subInfo?.middle || '')} › ${esc(subInfo?.name || '')} ・ 約 ${t.readingMinutes} 分${t.updatedAt ? ` ・ ${esc(t.updatedAt)} 更新` : ''}</div>
    <article class="topic">${t.html}</article>
    <div class="card"><div class="card-title">確認テスト</div>
      ${related.length ? `<div class="muted" style="margin-bottom:8px">このページの内容で解ける${nOfficial ? `公式問題 ${nOfficial} 問` : ''}${nOfficial && idsO.length ? ' ・ ' : ''}${idsO.length ? `オリジナル問題 ${idsO.length} 問` : ''} ・ 出題済み ${seen} ・ 最新の回答で正解 ${correct}</div>
      ${idsA.length ? `<a class="btn btn-primary" href="${runUrl(idsA, `確認テスト: ${t.title}`)}">確認テストを解く（科目A ${idsA.length} 問）</a>` : ''}
      ${idsB.length ? `<a class="btn ${idsA.length ? '' : 'btn-primary'}" href="${runUrl(idsB, `ケース問題: ${t.title}`)}">ケース問題を解く（科目B ${idsB.length} 問）</a>` : ''}
      ${idsO.length ? `<a class="btn ${nOfficial ? '' : 'btn-primary'}" href="${runUrl(idsO, `オリジナル問題: ${t.title}`)}">オリジナル問題で確認する（${idsO.length} 問）</a>
      <div class="muted" style="margin-top:8px;font-size:.85rem">オリジナル問題は、教科書の内容から本アプリで作った問題です。IPA の試験問題ではありません。</div>` : ''}`
      : '<div class="muted">このページの内容だけで解ける公式問題は、収録している過去問・サンプル問題の中にありません。</div>'}</div>
    <div class="card"><div class="card-title">このページの理解度</div>
      <div class="rating">${RATING.map((r, k) => `<button type="button" class="btn ${st?.rating === k ? 'btn-primary' : ''}" data-r="${k}">${r}</button>`).join('')}</div></div>
    <div class="row">${prev ? `<a class="btn btn-ghost" href="#textbook/${prev.id}">‹ ${esc(prev.title)}</a>` : '<span class="grow"></span>'}${next ? `<a class="btn btn-ghost" href="#textbook/${next.id}">${esc(next.title)} ›</a>` : ''}</div>`;
  // 解説の小見出しが 3 つ以上あるときは、要点と解説の間に「このページの内容」を出す
  const heads = [...root.querySelectorAll('.topic .tb-body h3')];
  const body = root.querySelector('.topic .tb-body');
  if (heads.length >= 3 && body) {
    const toc = document.createElement('nav');
    toc.className = 'toc';
    toc.innerHTML = `<div class="toc-title">このページの内容</div>${heads.map((h, k) => `<button type="button" data-k="${k}">${esc(h.textContent)}</button>`).join('')}`;
    toc.addEventListener('click', (e) => { const b = e.target.closest('button[data-k]'); if (b) heads[Number(b.dataset.k)].scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    body.before(toc);
  }
  root.querySelector('.rating').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-r]');
    if (!b) return;
    await store.rateTopic(id, Number(b.dataset.r));
    checkBadges(true).catch(() => {});
    root.querySelectorAll('.rating button').forEach((x) => x.classList.toggle('btn-primary', x === b));
    toast(`「${RATING[b.dataset.r]}」として記録しました`);
  });
}
