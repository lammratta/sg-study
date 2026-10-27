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

/** 折れ線（スコア推移）。values: 数値配列（古い順） */
export function lineChart(values, { goal = 600, max = 1000, min = 0 } = {}) {
  const W = 320, H = 140, L = 34, R = 10, T = 12, B = 22;
  const n = values.length;
  const x = (i) => (n === 1 ? (W - L - R) / 2 + L : L + (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (1 - (Math.max(min, Math.min(max, v)) - min) / (max - min)) * (H - T - B);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg class="linechart" viewBox="0 0 ${W} ${H}" role="img" aria-label="スコア推移">
    ${[min, goal, max].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === goal ? 'var(--ok)' : 'var(--line)'}" stroke-dasharray="${v === goal ? '4 3' : '0'}"/><text x="${L - 4}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
    ${n > 1 ? `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>` : ''}
    ${values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${v >= goal ? 'var(--ok)' : 'var(--accent)'}"/><text x="${x(i)}" y="${y(v) - 8}" text-anchor="middle" class="v">${v}</text><text x="${x(i)}" y="${H - 6}" text-anchor="middle">${i + 1} 回</text>`).join('')}
  </svg>`;
}
