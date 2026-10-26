import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('content-src/questions');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

test('問題ファイルが存在する', () => {
  assert.ok(files.length > 0);
});

for (const f of files) {
  test(`${f}: 解答が選択肢に含まれ、id が一意`, () => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const ids = new Set();
    for (const q of data.questions) {
      assert.ok(!ids.has(q.id), `${q.id} が重複`);
      ids.add(q.id);
      const keys = new Set(q.choices.map((c) => c.key));
      assert.ok(q.answer.length > 0, `${q.id}: answer が空`);
      for (const a of q.answer) assert.ok(keys.has(a), `${q.id}: answer ${a} が選択肢にない`);
      if (q.kind === 'A') assert.equal(q.choices.length, 4, `${q.id}: 科目A の選択肢数`);
      assert.ok(q.source.citation.startsWith('情報セキュリティマネジメント試験'), `${q.id}: 出典`);
    }
  });
}
