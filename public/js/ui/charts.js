import { esc } from './components.js';

export function ring(ratio, label) {
  const r = 34, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, ratio || 0));
  return `<svg class="ring" viewBox="0 0 84 84" role="img" aria-label="${esc(label)}">
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--heat0)" stroke-width="8"/>
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 42 42)"/>
    <text x="42" y="48" text-anchor="middle">${esc(label)}</text></svg>`;
}

export function bar(ratio, cls = '') {
  return `<div class="bar ${cls}"><span style="width:${Math.round(Math.max(0, Math.min(1, ratio || 0)) * 100)}%"></span></div>`;
}

export function heatmapHtml(cells, goal = 10) {
  const level = (n) => (n === 0 ? 0 : n < goal / 2 ? 1 : n < goal ? 2 : n < goal * 2 ? 3 : 4);
  // 先頭の週の曜日を揃えるため、最初の日の曜日分だけ空セルを置く
  const first = cells[0] ? new Date(cells[0].day).getDay() : 0;
  const pad = Array.from({ length: first }, () => '<i style="visibility:hidden"></i>').join('');
  return `<div class="heatmap">${pad}${cells.map((c) => `<i class="l${level(c.answered)}" title="${c.day}: ${c.answered} 問"></i>`).join('')}</div>`;
}
