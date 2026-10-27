export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
let toastTimer = null;
export function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}
export function topbar(title, back = '#quiz') {
  return `<div class="topbar"><a class="back" href="${back}" aria-label="戻る">‹</a><div class="title">${esc(title)}</div></div>`;
}
export function pct(n) { return `${Math.round((n || 0) * 100)}%`; }
export function fmtMin(ms) { const m = Math.round((ms || 0) / 60000); return m < 60 ? `${m} 分` : `${Math.floor(m / 60)} 時間 ${m % 60} 分`; }
