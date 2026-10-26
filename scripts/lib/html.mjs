// 配信用 HTML を組み立てる小さなヘルパー（ランタイムには含めない）。
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 改行区切りのテキストを <p> / <ul> に変換する。「・」で始まる連続行は箇条書きにする。 */
export function textToHtml(text) {
  const lines = String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const out = [];
  let items = [];
  const flush = () => {
    if (items.length) {
      out.push('<ul>' + items.map((li) => `<li>${escapeHtml(li)}</li>`).join('') + '</ul>');
      items = [];
    }
  };
  for (const line of lines) {
    if (line.startsWith('・')) {
      items.push(line.slice(1).trim());
    } else {
      flush();
      out.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  flush();
  return out.join('');
}
