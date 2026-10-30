// 解説の下に出す「教科書: …」のリンク。
import { content } from '../content.js';
import { esc } from './components.js';

export function textbookLinks(qid) {
  const [main, ...also] = content.pagesForQuestion(qid);
  if (!main) return '';
  const a = (t) => `<a href="#textbook/${t.id}">${esc(t.title)}</a>`;
  return `<div class="muted" style="margin-top:8px">教科書: ${a(main)}${also.length ? ` ・ 前提: ${also.map(a).join('、')}` : ''}</div>`;
}
