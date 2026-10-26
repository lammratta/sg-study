import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, textToHtml } from '../scripts/lib/html.mjs';

test('escapeHtml はタグと引用符をエスケープする', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('textToHtml は段落と箇条書きを作る', () => {
  const html = textToHtml('問題文\n・項目1\n・項目2\n続き');
  assert.equal(html, '<p>問題文</p><ul><li>項目1</li><li>項目2</li></ul><p>続き</p>');
});

test('textToHtml は空行を無視する', () => {
  assert.equal(textToHtml('\n\nA\n\n'), '<p>A</p>');
});
