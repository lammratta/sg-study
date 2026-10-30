// 模擬試験: メニュー → 出題（タイマー・行き来・見直しフラグ・一覧） → 提出 → 結果 → レビュー。
import { content } from '../content.js';
import { store, settings } from '../store.js';
import { composeExam, scoreExam, fmtClock, EXAM_SPEC, GROUP_NAMES } from '../core/exam.js';
import { checkBadges } from '../badges.js';
import { esc, toast, pct, fmtMin } from '../ui/components.js';
import { bar, lineChart } from '../ui/charts.js';
import { textbookLinks } from '../ui/links.js';

let exam = null;        // 進行中の模試（メモリ上の正）
let timer = null;       // setInterval
let lastTick = 0;       // 非厳格モードで経過時間を数える基準
let shownAt = 0;        // 現在の問題を表示した時刻
let persistCount = 0;
let submitting = false;
const PERSIST_EVERY = 10;

export function fullscreen(sub) { return ['run', 'result', 'review'].includes(sub); }

export async function render(root, { sub, params }) {
  if (sub === 'run') return renderRun(root, params);
  if (sub === 'result') return renderResult(root, params);
  if (sub === 'review') return renderReview(root, params);
  return renderMenu(root);
}

/** 画面を離れるとき: 経過時間を確定して保存、タイマー停止 */
export function destroy() {
  stopTimer();
  if (exam && exam.status === 'running') { flushSpent(); flushTime(); store.saveExam(exam).catch(() => {}); }
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', onPageHide);
}

function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

function remainingMs() {
  if (!exam) return 0;
  if (exam.strict) return exam.deadlineTs - Date.now();
  return exam.remainingMs - (lastTick ? Date.now() - lastTick : 0);
}
function flushTime() {
  if (!exam || exam.strict || !lastTick) return;
  const now = Date.now();
  exam.remainingMs = Math.max(0, exam.remainingMs - (now - lastTick));
  lastTick = now;
}
function flushSpent() {
  if (!exam || !shownAt) return;
  const qid = exam.qids[exam.idx];
  const now = Date.now();
  if (qid) exam.spent[qid] = (exam.spent[qid] || 0) + (now - shownAt);
  shownAt = now;
}
function onVisibility() {
  if (!exam || exam.status !== 'running') return;
  if (document.hidden) { flushSpent(); flushTime(); store.saveExam(exam).catch(() => {}); lastTick = 0; shownAt = 0; }
  else { lastTick = Date.now(); shownAt = Date.now(); }
}
function onPageHide() { if (exam && exam.status === 'running') { flushSpent(); flushTime(); store.saveExam(exam).catch(() => {}); } }

/* ---------- メニュー ---------- */
async function renderMenu(root) {
  exam = null; stopTimer();
  const s = settings.get();
  const all = await store.listExams();
  const running = all.find((e) => e.status === 'running');
  const done = all.filter((e) => e.status === 'done' && e.result);
  const nB = content.questions.filter((q) => q.kind === 'B').length;
  const unseenB = content.questions.filter((q) => q.kind === 'B' && !store.states.get(q.id)?.attempts).length;
  root.innerHTML = `
    <h1>模擬試験</h1>
    <div class="card">
      <div class="card-title">本番形式 60 問・120 分</div>
      <div class="muted">科目A 48 問（セキュリティ 28・法務 4・テクノロジ 4・マネジメント 6・ストラテジ 6）と科目B 12 問。回答中は正誤を表示せず、提出後にまとめて採点します。問題は行き来でき、見直しフラグを付けられます。</div>
      <div class="muted" style="margin-top:6px">${s.strictExamTimer ? '厳格モード: 画面を閉じても時計は止まりません' : '通常モード: 画面を閉じると時計が止まり、続きから再開できます'}（<a href="#settings">設定</a>）</div>
      ${unseenB < EXAM_SPEC.nB ? `<div class="muted" style="margin-top:6px">科目B の未出題は残り ${unseenB} / ${nB} 問のため、解いたことのある問題も含まれます。</div>` : ''}
    </div>
    ${running ? `<a class="btn btn-primary" href="#exam/run">続きから再開（問 ${running.idx + 1} / ${running.qids.length} ・ 残り ${fmtClock(running.strict ? running.deadlineTs - Date.now() : running.remainingMs)}）</a>
      <button class="btn btn-ghost" id="discard" type="button">途中の模試を破棄する</button>` : `<button class="btn btn-primary" id="start" type="button">模擬試験を始める</button>`}
    <h2>スコア推移 <span class="muted">（1,000 点換算の目安・合格ライン 600）</span></h2>
    <div class="card">${done.length ? lineChart(done.map((e) => e.result.scaled), { goal: 600, max: 1000 }) : '<div class="muted">まだ受験していません</div>'}</div>
    ${done.length ? `<h2>受験履歴</h2><div class="list">${done.slice().reverse().map((e) => `<a class="list-item" href="#exam/result?id=${e.id}"><div class="grow"><div><strong style="color:${e.result.scaled >= 600 ? 'var(--ok)' : 'inherit'}">${e.result.scaled} 点</strong> <span class="muted">科目A ${e.result.correctA}/${e.result.nA} ・ 科目B ${e.result.correctB}/${e.result.nB}</span></div><div class="muted">${new Date(e.endTs).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })} ・ ${fmtMin(e.usedMs)}</div></div><span class="chev">›</span></a>`).join('')}</div>` : ''}`;
  const start = root.querySelector('#start');
  if (start) start.onclick = () => startExam();
  const discard = root.querySelector('#discard');
  if (discard) discard.onclick = async () => { if (!confirm('途中の模試を破棄します。回答は記録されません。よろしいですか？')) return; await store.saveExam({ ...running, status: 'abandoned', endTs: Date.now() }); toast('破棄しました'); renderMenu(root); };
}

async function startExam() {
  const s = settings.get();
  const c = composeExam(content.questions, store.states, content.subs, { includeOutdated: s.includeOutdated });
  if (c.qids.length < 10) { toast('出題できる問題が足りません'); return; }
  const now = Date.now();
  const e = { id: `e${now}`, startTs: now, endTs: null, status: 'running', qids: c.qids, groups: c.groups, answers: {}, flags: {}, spent: {}, idx: 0, durationMs: EXAM_SPEC.durationMs, remainingMs: EXAM_SPEC.durationMs, strict: !!s.strictExamTimer, deadlineTs: s.strictExamTimer ? now + EXAM_SPEC.durationMs : null, reusedB: c.reusedB, shortage: c.shortage, result: null, usedMs: 0 };
  await store.saveExam(e);
  exam = e;
  location.hash = '#exam/run';
}

/* ---------- 出題 ---------- */
async function renderRun(root, params) {
  if (!exam || exam.status !== 'running') exam = await store.runningExam();
  if (!exam) { location.replace('#exam'); return; }
  stopTimer();
  flushSpent();
  if (params.i !== undefined) exam.idx = Math.max(0, Math.min(exam.qids.length - 1, Number(params.i) || 0));
  lastTick = lastTick || Date.now();
  document.removeEventListener('visibilitychange', onVisibility); document.addEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', onPageHide); window.addEventListener('pagehide', onPageHide);
  if (remainingMs() <= 0) { await submit(root); return; }
  if (params.view === 'list') return renderList(root);
  const qid = exam.qids[exam.idx];
  const q = await content.getQuestion(qid);
  const g = exam.groups[qid];
  const chosen = exam.answers[qid];
  const figs = (pos) => (q.figures || []).filter((f) => f.position === pos).map((f) => `<div class="figure"><img src="${content.figureUrl(f.src)}" alt="${esc(f.alt)}" loading="lazy"></div>`).join('');
  const expanded = sessionStorage.getItem('sg-study.caseExpanded');
  const last = exam.idx === exam.qids.length - 1;
  root.innerHTML = `
    <div class="topbar"><a class="back" href="#exam" id="back" aria-label="中断">‹</a><div class="title">模擬試験</div><div class="timer" id="timer">${fmtClock(remainingMs())}</div></div>
    <div class="q-head"><span>問 ${exam.idx + 1} / ${exam.qids.length} ・ ${esc(GROUP_NAMES[g] || '')}</span>
      <button class="btn btn-small ${exam.flags[qid] ? 'flagged' : 'btn-ghost'}" id="flag" type="button">${exam.flags[qid] ? '🚩 見直し' : '⚐ 見直し'}</button></div>
    ${q.flags.outdated ? `<div class="outdated">注意: ${esc(q.flags.note || '制度変更により現在の扱いが異なる可能性があります')}</div>` : ''}
    ${q.kind === 'B' ? `<div class="case-wrap ${expanded ? 'expanded' : ''}" id="case"><div class="case">${q.caseHtml}${figs('case')}</div></div><button class="btn btn-small btn-ghost" id="case-toggle" type="button">${expanded ? '本文を折りたたむ' : '本文を全部表示'}</button><div class="q-label">設問</div>` : ''}
    <div class="q-stem">${q.stemHtml}${figs('stem')}</div>
    <div class="choices" id="choices">${q.choices.map((c) => `<button class="choice ${chosen === c.key ? 'selected' : ''}" type="button" data-key="${c.key}"><span class="k">${c.key}</span><span>${c.html}</span></button>`).join('')}</div>
    <div class="bottom-bar"><div class="row nav3">
      <a class="btn ${exam.idx === 0 ? 'disabled' : ''}" href="#exam/run?i=${exam.idx - 1}">‹ 前へ</a>
      <a class="btn btn-ghost" href="#exam/run?view=list">一覧</a>
      ${last ? '<button class="btn btn-primary" id="submit" type="button">提出</button>' : `<a class="btn btn-primary" href="#exam/run?i=${exam.idx + 1}">次へ ›</a>`}
    </div></div>`;
  shownAt = Date.now();
  startTimer(root);
  root.querySelector('#back').onclick = (e) => { if (exam.strict && !confirm('厳格モードでは中断しても時計は止まりません。メニューに戻りますか？')) e.preventDefault(); };
  root.querySelector('#flag').onclick = (e) => { exam.flags[qid] = !exam.flags[qid]; e.target.textContent = exam.flags[qid] ? '🚩 見直し' : '⚐ 見直し'; e.target.classList.toggle('flagged', exam.flags[qid]); e.target.classList.toggle('btn-ghost', !exam.flags[qid]); store.saveExam(exam); };
  const toggle = root.querySelector('#case-toggle');
  if (toggle) toggle.onclick = () => { const c = root.querySelector('#case'); c.classList.toggle('expanded'); const on = c.classList.contains('expanded'); toggle.textContent = on ? '本文を折りたたむ' : '本文を全部表示'; try { on ? sessionStorage.setItem('sg-study.caseExpanded', '1') : sessionStorage.removeItem('sg-study.caseExpanded'); } catch { /* ignore */ } };
  root.querySelector('#choices').addEventListener('click', (e) => {
    const btn = e.target.closest('.choice'); if (!btn) return;
    const same = exam.answers[qid] === btn.dataset.key;
    if (same) delete exam.answers[qid]; else exam.answers[qid] = btn.dataset.key;
    root.querySelectorAll('.choice').forEach((b) => b.classList.toggle('selected', !same && b === btn));
    store.saveExam(exam);
  });
  const sb = root.querySelector('#submit');
  if (sb) sb.onclick = () => confirmSubmit(root);
}

function startTimer(root) {
  stopTimer();
  timer = setInterval(async () => {
    if (!exam || exam.status !== 'running') { stopTimer(); return; }
    if (!document.hidden) flushTime();
    const ms = remainingMs();
    const el = root.querySelector('#timer');
    if (el) { el.textContent = fmtClock(ms); el.classList.toggle('warn', ms < 10 * 60 * 1000); }
    if (++persistCount % PERSIST_EVERY === 0) store.saveExam(exam).catch(() => {});
    if (ms <= 0) { stopTimer(); toast('時間切れです。提出します', 3000); await submit(root); }
  }, 1000);
}

function renderList(root) {
  const n = exam.qids.length;
  const answered = exam.qids.filter((q) => exam.answers[q]).length;
  const flagged = exam.qids.filter((q) => exam.flags[q]).length;
  root.innerHTML = `
    <div class="topbar"><a class="back" href="#exam/run?i=${exam.idx}" aria-label="戻る">‹</a><div class="title">解答状況</div><div class="timer" id="timer">${fmtClock(remainingMs())}</div></div>
    <div class="muted" style="margin-bottom:8px">回答済み ${answered} / ${n} ・ 見直し ${flagged} ・ 未回答 ${n - answered}</div>
    <div class="exam-grid">${exam.qids.map((q, i) => `<a class="exam-cell ${exam.answers[q] ? 'done' : ''} ${exam.flags[q] ? 'flag' : ''} ${i === exam.idx ? 'cur' : ''}" href="#exam/run?i=${i}">${i + 1}</a>`).join('')}</div>
    <div class="muted" style="margin:8px 0">1〜${exam.qids.filter((q) => exam.groups[q] !== 'B').length} 科目A ・ 以降 科目B。塗りつぶしは回答済み、赤枠は見直しフラグ。</div>
    <div class="bottom-bar"><button class="btn btn-primary" id="submit" type="button">提出して採点する</button></div>`;
  startTimer(root);
  root.querySelector('#submit').onclick = () => confirmSubmit(root);
}

function confirmSubmit(root) {
  const left = exam.qids.filter((q) => !exam.answers[q]).length;
  if (!confirm(left ? `未回答が ${left} 問あります（不正解として採点）。提出しますか？` : '提出して採点します。よろしいですか？')) return;
  submit(root);
}

async function submit(root) {
  if (submitting || !exam || exam.status !== 'running') return;
  submitting = true;
  stopTimer();
  flushSpent(); flushTime();
  try {
    root.innerHTML = '<div class="loading">採点中…</div>';
    const items = [];
    const records = [];
    for (const qid of exam.qids) {
      const q = await content.getQuestion(qid);
      const chosen = exam.answers[qid];
      const correct = !!chosen && q.answer.includes(chosen);
      items.push({ qid, group: exam.groups[qid], sub: q.tags?.sub, correct, answered: !!chosen });
      records.push({ qid, chosen: chosen ? [chosen] : [], correct, elapsedMs: exam.spent[qid] || 0, mode: 'exam', sessionId: exam.id });
    }
    const result = scoreExam(items);
    const now = Date.now();
    exam.status = 'done'; exam.endTs = now; exam.result = result;
    exam.usedMs = exam.strict ? Math.min(now - exam.startTs, exam.durationMs) : exam.durationMs - exam.remainingMs;
    exam.items = items;
    await store.recordAttempts(records);
    await store.saveExam(exam);
    const id = exam.id;
    exam = null; lastTick = 0; shownAt = 0;
    checkBadges(true).catch(() => {});
    location.replace(`#exam/result?id=${id}`);
  } finally { submitting = false; }
}

/* ---------- 結果 ---------- */
async function renderResult(root, params) {
  const e = await store.getExam(params.id);
  if (!e || !e.result) { location.replace('#exam'); return; }
  const r = e.result;
  const ok = r.scaled >= 600;
  const order = ['security', 'legal', 'T', 'M', 'S', 'B'];
  const wrong = e.items.filter((x) => !x.correct).map((x) => x.qid);
  const all = await store.listExams();
  const done = all.filter((x) => x.status === 'done' && x.result);
  const prev = done.filter((x) => x.endTs < e.endTs).pop();
  root.innerHTML = `
    <div class="topbar"><a class="back" href="#exam" aria-label="戻る">‹</a><div class="title">模試の結果</div></div>
    <div class="card" style="text-align:center">
      <div class="summary-big" style="color:${ok ? 'var(--ok)' : 'var(--text)'}">${r.scaled} <span class="muted" style="font-size:1rem">/ 1000</span></div>
      <div class="${ok ? 'verdict ok' : 'verdict ng'}" style="font-size:1rem">${ok ? '合格ライン（600）到達' : `合格ラインまで あと ${600 - r.scaled} 点`}</div>
      ${prev ? `<div class="muted">前回 ${prev.result.scaled} 点（${r.scaled - prev.result.scaled >= 0 ? '+' : ''}${r.scaled - prev.result.scaled}）</div>` : ''}
      <div class="muted" style="margin-top:6px">科目A ${r.correctA} / ${r.nA} ・ 科目B ${r.correctB} / ${r.nB} ・ 未回答 ${r.unanswered} ・ 所要 ${fmtMin(e.usedMs)}</div>
      <div class="muted" style="font-size:.8rem">換算は 1000 × (0.8 × 科目A 正答率 + 0.2 × 科目B 正答率) の目安。本番は IRT 採点です。</div>
    </div>
    <div class="card"><div class="card-title">分野別</div>${order.filter((g) => r.perGroup[g]).map((g) => { const x = r.perGroup[g]; return `<div style="padding:4px 0"><div class="row" style="justify-content:space-between"><span>${esc(GROUP_NAMES[g])}</span><span class="muted">${x.c} / ${x.n}（${pct(x.c / x.n)}）</span></div>${bar(x.c / x.n, x.c / x.n >= 0.8 ? 'ok' : x.c / x.n < 0.6 ? 'ng' : '')}</div>`; }).join('')}</div>
    ${wrong.length ? `<a class="btn" href="#quiz/run?mode=ids&ids=${wrong.join(',')}&count=${wrong.length}&label=${encodeURIComponent('模試で間違えた問題')}">間違えた ${wrong.length} 問を演習する</a>` : ''}
    <h2>全問の見直し</h2>
    <div class="exam-grid">${e.qids.map((q, i) => { const it = e.items[i]; return `<a class="exam-cell ${it.correct ? 'ok' : it.answered ? 'ng' : 'none'} ${e.flags?.[q] ? 'flag' : ''}" href="#exam/review?id=${e.id}&i=${i}">${i + 1}</a>`; }).join('')}</div>
    <div class="muted" style="margin:8px 0">緑 正解 ・ 赤 不正解 ・ 灰 未回答。タップで解説を表示。</div>
    <a class="btn btn-primary" href="#exam">模試メニューへ</a>
    <a class="btn btn-ghost" href="#home">ホームへ</a>`;
}

/* ---------- レビュー ---------- */
async function renderReview(root, params) {
  const e = await store.getExam(params.id);
  if (!e || !e.result) { location.replace('#exam'); return; }
  const i = Math.max(0, Math.min(e.qids.length - 1, Number(params.i) || 0));
  const qid = e.qids[i];
  const q = await content.getQuestion(qid);
  const chosen = e.answers[qid];
  const correct = !!chosen && q.answer.includes(chosen);
  const st = store.states.get(qid);
  const figs = (pos) => (q.figures || []).filter((f) => f.position === pos).map((f) => `<div class="figure"><img src="${content.figureUrl(f.src)}" alt="${esc(f.alt)}" loading="lazy"></div>`).join('');
  root.innerHTML = `
    <div class="topbar"><a class="back" href="#exam/result?id=${e.id}" aria-label="結果へ">‹</a><div class="title">見直し 問 ${i + 1} / ${e.qids.length}</div></div>
    <div class="q-head"><span>${esc(GROUP_NAMES[e.groups[qid]] || '')} ・ ${esc(content.subName(q.tags.sub))}</span><span class="${correct ? 'verdict ok' : 'verdict ng'}" style="font-size:.95rem">${correct ? '正解' : chosen ? '不正解' : '未回答'}</span></div>
    ${q.kind === 'B' ? `<div class="case-wrap expanded"><div class="case">${q.caseHtml}${figs('case')}</div></div><div class="q-label">設問</div>` : ''}
    <div class="q-stem">${q.stemHtml}${figs('stem')}</div>
    <div class="choices">${q.choices.map((c) => `<div class="choice ${q.answer.includes(c.key) ? 'correct' : c.key === chosen ? 'wrong' : ''}"><span class="k">${c.key}</span><span>${c.html}</span></div>`).join('')}</div>
    <div class="result">
      <div class="verdict ${correct ? 'ok' : 'ng'}">正解: ${q.answer.join('，')}${chosen ? ` ・ あなたの回答: ${chosen}` : ''}</div>
      <div class="explanation">${q.explanationHtml || '<p class="muted">解説は準備中です。</p>'}</div>
      ${textbookLinks(qid)}
      <div class="citation">出典: ${esc(q.source.citation)}${q.source.modified ? `（原文の一部を変更: ${esc(q.source.modifiedNote)}）` : ''}</div>
      <div class="row" style="margin-top:10px"><button class="btn btn-small" id="bm" type="button">${st?.bookmarked ? '★ ブックマーク済み' : '☆ ブックマーク'}</button>
        <a class="btn btn-small btn-ghost" href="${esc(q.source.url)}" target="_blank" rel="noopener">原文 PDF</a></div>
    </div>
    <div class="bottom-bar"><div class="row nav3">
      <a class="btn ${i === 0 ? 'disabled' : ''}" href="#exam/review?id=${e.id}&i=${i - 1}">‹ 前へ</a>
      <a class="btn btn-ghost" href="#exam/result?id=${e.id}">結果</a>
      <a class="btn ${i === e.qids.length - 1 ? 'disabled' : ''}" href="#exam/review?id=${e.id}&i=${i + 1}">次へ ›</a>
    </div></div>`;
  root.querySelector('#bm').onclick = async (ev) => { const on = await store.toggleBookmark(qid); ev.target.textContent = on ? '★ ブックマーク済み' : '☆ ブックマーク'; toast(on ? 'ブックマークしました' : '解除しました'); };
}
