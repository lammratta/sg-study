// 演習: モード選択 → 出題 → 結果 → セッション終了。
import { content } from '../content.js';
import { store, settings } from '../store.js';
import { pickQuestions, pickUnseenFirst, weakSubs } from '../core/select.js';
import { dueQuestions } from '../core/srs.js';
import { subStats, endOfDay } from '../core/stats.js';
import { esc, toast, topbar, pct, fmtMin } from '../ui/components.js';

const SESSION_KEY = 'sg-study.session';
let session = null;
let shownAt = 0;
let touchX = null;

function loadSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
function saveSession() { try { session ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)) : sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } }

export function fullscreen(sub) { return sub === 'run' || sub === 'done'; }

function candidates({ kind = 'A', sub = null }) {
  const s = settings.get();
  return content.questions.filter((q) => q.kind === kind && (!sub || q.sub === sub) && (s.includeOutdated || !q.outdated));
}

/** モードから出題リストを作る */
export function buildSession(mode, params = {}) {
  const count = Number(params.count || settings.get().sessionSize || 10);
  const now = Date.now();
  let qids = [];
  let label = '';
  if (mode === 'review') {
    qids = dueQuestions([...store.states.values()], endOfDay(), 50).slice(0, count);
    label = '今日の復習';
  } else if (mode === 'bookmark') {
    qids = [...store.states.values()].filter((s) => s.bookmarked).map((s) => s.qid).slice(0, count);
    label = 'ブックマーク';
  } else if (mode === 'weak') {
    const stats = subStats(content.questions.filter((q) => q.kind === 'A'), store.states, content.subs);
    const subs = new Set(weakSubs(stats));
    qids = pickQuestions(candidates({ kind: 'A' }).filter((q) => subs.has(q.sub)), store.states, count, now);
    label = '弱点優先';
  } else if (mode === 'case') {
    qids = pickUnseenFirst(candidates({ kind: 'B' }), store.states, count, now);
    label = '科目B ケース演習';
  } else if (mode === 'sub') {
    qids = pickUnseenFirst(candidates({ kind: params.kind || 'A', sub: params.sub }), store.states, count, now);
    label = content.subName(params.sub);
  } else if (mode === 'unseen') {
    qids = pickUnseenFirst(candidates({ kind: 'A' }), store.states, count, now);
    label = '未出題優先';
  } else {
    qids = pickQuestions(candidates({ kind: 'A' }), store.states, count, now);
    label = 'ランダム';
  }
  return { id: `s${now}`, mode, label, qids, idx: 0, results: [], startTs: now };
}

export async function render(root, { sub, params }) {
  if (sub === 'run') return renderRun(root, params);
  if (sub === 'done') return renderDone(root);
  return renderMenu(root);
}

function renderMenu(root) {
  const due = dueQuestions([...store.states.values()], endOfDay(), 50).length;
  const marks = [...store.states.values()].filter((s) => s.bookmarked).length;
  const nA = content.questions.filter((q) => q.kind === 'A').length;
  const nB = content.questions.filter((q) => q.kind === 'B').length;
  const seenA = content.questions.filter((q) => q.kind === 'A' && store.states.get(q.id)?.attempts).length;
  const resume = loadSession();
  const subsA = [...content.subs.values()];
  const s = settings.get();
  root.innerHTML = `
    <h1>演習</h1>
    ${resume && resume.idx < resume.qids.length ? `<a class="btn btn-primary" href="#quiz/run?resume=1">続きから（${esc(resume.label)} ${resume.idx + 1} / ${resume.qids.length}）</a>` : ''}
    <h2>科目A ドリル <span class="muted">（${seenA} / ${nA} 問 出題済み）</span></h2>
    <div class="card">
      <label class="field"><span>1 回の出題数</span>
        <select id="count">${[5, 10, 20, 30].map((n) => `<option value="${n}" ${n === Number(s.sessionSize) ? 'selected' : ''}>${n} 問</option>`).join('')}</select></label>
      <label class="field"><span>分野</span>
        <select id="sub"><option value="">すべて</option>${subsA.map((x) => `<option value="${x.id}">${esc(x.kind === '重点' ? '★ ' : '')}${esc(x.name)}</option>`).join('')}</select></label>
    </div>
    <div class="list">
      <a class="list-item" href="#quiz/run?mode=unseen"><div class="grow"><div>未出題を優先</div><div class="muted">まだ解いていない問題から</div></div><span class="chev">›</span></a>
      <a class="list-item" href="#quiz/run?mode=random"><div class="grow"><div>ランダム</div><div class="muted">誤答・復習期限の問題が出やすい重み付き</div></div><span class="chev">›</span></a>
      <a class="list-item" href="#quiz/run?mode=weak"><div class="grow"><div>弱点優先</div><div class="muted">正答率の低い分野から</div></div><span class="chev">›</span></a>
    </div>
    <h2>復習</h2>
    <div class="list">
      <a class="list-item ${due ? '' : 'muted'}" href="#quiz/run?mode=review"><div class="grow"><div>今日の復習</div><div class="muted">期限が来た問題 ${due} 問</div></div><span class="chev">›</span></a>
      <a class="list-item" href="#quiz/run?mode=bookmark"><div class="grow"><div>ブックマーク</div><div class="muted">${marks} 問</div></div><span class="chev">›</span></a>
    </div>
    <h2>科目B <span class="muted">（${nB} 問）</span></h2>
    <div class="list">
      <a class="list-item" href="#quiz/run?mode=case"><div class="grow"><div>ケース演習</div><div class="muted">長文の事例を読んで解答群から選ぶ</div></div><span class="chev">›</span></a>
    </div>`;
  const countEl = root.querySelector('#count');
  const subEl = root.querySelector('#sub');
  const sync = () => {
    settings.set({ sessionSize: Number(countEl.value) });
    root.querySelectorAll('a.list-item[href^="#quiz/run"]').forEach((a) => {
      const u = new URL(a.getAttribute('href').slice(1), 'http://x/');
      const q = new URLSearchParams(u.search);
      q.set('count', countEl.value);
      if (subEl.value && ['unseen', 'random'].includes(q.get('mode'))) { q.set('sub', subEl.value); q.set('mode', 'sub'); }
      a.setAttribute('href', `#quiz/run?${q}`);
    });
  };
  countEl.onchange = sync; subEl.onchange = sync; sync();
}

async function renderRun(root, params) {
  if (params.resume) session = loadSession();
  else if (params.mode) { session = buildSession(params.mode, params); saveSession(); }
  if (!session || !session.qids.length) {
    root.innerHTML = `${topbar('演習')}<div class="card"><div class="card-title">出題できる問題がありません</div><div class="muted">このモードの条件に合う問題がまだありません。</div><a class="btn" href="#quiz">戻る</a></div>`;
    return;
  }
  if (session.idx >= session.qids.length) { location.replace('#quiz/done'); return; }
  const qid = session.qids[session.idx];
  const q = await content.getQuestion(qid);
  const st = store.states.get(qid);
  const figs = (pos) => (q.figures || []).filter((f) => f.position === pos).map((f) => `<div class="figure"><img src="${content.figureUrl(f.src)}" alt="${esc(f.alt)}" loading="lazy"></div>`).join('');
  root.innerHTML = `
    ${topbar(session.label, '#quiz')}
    <div class="q-head"><span>${session.idx + 1} / ${session.qids.length}</span><span>${esc(content.subName(q.tags.sub))}${q.difficulty ? ' ・ 難易度 ' + '★'.repeat(q.difficulty) : ''}</span></div>
    ${q.flags.outdated ? `<div class="outdated">注意: ${esc(q.flags.note || '制度変更により現在の扱いが異なる可能性があります')}</div>` : ''}
    ${q.kind === 'B' ? `<div class="case-wrap" id="case"><div class="case">${q.caseHtml}${figs('case')}</div></div><button class="btn btn-small btn-ghost" id="case-toggle" type="button">本文を全部表示</button>` : ''}
    <div class="q-stem">${q.stemHtml}${figs('stem')}</div>
    <div class="choices" id="choices">${q.choices.map((c) => `<button class="choice" type="button" data-key="${c.key}"><span class="k">${c.key}</span><span>${c.html}</span></button>`).join('')}</div>
    <div class="result hidden" id="result"></div>
    <div class="bottom-bar hidden" id="next-bar"><button class="btn btn-primary" id="next" type="button">次へ ›</button></div>`;
  shownAt = Date.now();
  const toggle = root.querySelector('#case-toggle');
  if (toggle) toggle.onclick = () => { const c = root.querySelector('#case'); c.classList.toggle('expanded'); toggle.textContent = c.classList.contains('expanded') ? '本文を折りたたむ' : '本文を全部表示'; };
  root.querySelector('#choices').addEventListener('click', async (e) => {
    const btn = e.target.closest('.choice');
    if (!btn || btn.disabled) return;
    await answer(root, q, btn.dataset.key);
  });
  root.querySelector('#next').onclick = () => next();
  root.ontouchstart = (e) => { touchX = e.touches[0].clientX; };
  root.ontouchend = (e) => { if (touchX !== null && !root.querySelector('#next-bar').classList.contains('hidden') && touchX - e.changedTouches[0].clientX > 80) next(); touchX = null; };
}

async function answer(root, q, key) {
  const correct = q.answer.includes(key);
  const elapsedMs = Date.now() - shownAt;
  root.querySelectorAll('.choice').forEach((b) => {
    b.disabled = true;
    if (q.answer.includes(b.dataset.key)) b.classList.add('correct');
    else if (b.dataset.key === key) b.classList.add('wrong');
  });
  const state = await store.recordAttempt({ qid: q.id, chosen: [key], correct, elapsedMs, mode: session.mode === 'review' ? 'review' : q.kind === 'B' ? 'case' : 'drill', sessionId: session.id });
  session.results.push({ qid: q.id, correct });
  saveSession();
  const res = root.querySelector('#result');
  res.classList.remove('hidden');
  res.innerHTML = `
    <div class="verdict ${correct ? 'ok' : 'ng'}">${correct ? '正解' : '不正解'}（正解: ${q.answer.join('，')}）${state.streak >= 2 && correct ? ` <span class="badge">${state.streak} 連続</span>` : ''}</div>
    <div class="explanation">${q.explanationHtml || '<p class="muted">解説は準備中です。</p>'}</div>
    <div class="citation">出典: ${esc(q.source.citation)}${q.source.modified ? `（原文の一部を変更: ${esc(q.source.modifiedNote)}）` : ''}</div>
    <div class="row" style="margin-top:10px"><button class="btn btn-small" id="bm" type="button">${state.bookmarked ? '★ ブックマーク済み' : '☆ ブックマーク'}</button>
      <a class="btn btn-small btn-ghost" href="${esc(q.source.url)}" target="_blank" rel="noopener">原文 PDF</a></div>`;
  res.querySelector('#bm').onclick = async (e) => { const on = await store.toggleBookmark(q.id); e.target.textContent = on ? '★ ブックマーク済み' : '☆ ブックマーク'; toast(on ? 'ブックマークしました' : '解除しました'); };
  root.querySelector('#next-bar').classList.remove('hidden');
  res.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function next() {
  session.idx += 1;
  saveSession();
  if (session.idx >= session.qids.length) location.hash = '#quiz/done';
  else { location.hash = '#quiz/run?resume=1'; renderRunAgain(); }
}
// 同じハッシュへの遷移では hashchange が発火しないため明示的に再描画
function renderRunAgain() { if (location.hash === '#quiz/run?resume=1') render(document.getElementById('screen'), { sub: 'run', params: { resume: '1' } }); }

async function renderDone(root) {
  const s = session || loadSession();
  if (!s) { location.replace('#quiz'); return; }
  const n = s.results.length, c = s.results.filter((r) => r.correct).length;
  const wrong = s.results.filter((r) => !r.correct).map((r) => r.qid);
  await store.saveSession({ id: s.id, startTs: s.startTs, endTs: Date.now(), mode: s.mode, label: s.label, qids: s.qids, answered: n, correct: c });
  const bySub = new Map();
  for (const r of s.results) { const sub = content.byId.get(r.qid)?.sub; const a = bySub.get(sub) || { n: 0, c: 0 }; a.n += 1; a.c += r.correct ? 1 : 0; bySub.set(sub, a); }
  const today = store.daily.get(new Date().toISOString().slice(0, 10)) || store.daily.get([...store.daily.keys()].sort().pop());
  session = null; saveSession();
  root.innerHTML = `
    ${topbar('結果', '#quiz')}
    <div class="card"><div class="summary-big">${c} / ${n}</div><div class="muted" style="text-align:center">正答率 ${pct(n ? c / n : 0)} ・ 所要 ${fmtMin(Date.now() - s.startTs)}</div></div>
    <div class="card"><div class="card-title">分野別</div>${[...bySub.entries()].map(([sub, a]) => `<div class="row" style="padding:4px 0"><div class="grow">${esc(content.subName(sub))}</div><div class="muted">${a.c} / ${a.n}</div></div>`).join('')}</div>
    ${wrong.length ? `<button class="btn" id="retry" type="button">間違えた ${wrong.length} 問をもう一度</button>` : ''}
    <a class="btn btn-primary" href="#quiz">演習メニューへ</a>
    <a class="btn btn-ghost" href="#home">ホームへ</a>`;
  const retry = root.querySelector('#retry');
  if (retry) retry.onclick = () => { session = { id: `s${Date.now()}`, mode: 'retry', label: '間違えた問題', qids: wrong, idx: 0, results: [], startTs: Date.now() }; saveSession(); location.hash = '#quiz/run?resume=1'; };
}
