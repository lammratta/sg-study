import { content } from '../content.js';
import { store, settings } from '../store.js';
import { esc, toast } from '../ui/components.js';
import { applyTheme } from '../app.js';

export async function render(root) {
  const s = settings.get();
  let persisted = null, usage = null;
  try { persisted = await navigator.storage?.persisted?.(); const est = await navigator.storage?.estimate?.(); usage = est?.usage; } catch { /* ignore */ }
  root.innerHTML = `
    <h1>設定</h1>
    <div class="card">
      <label class="field"><span>試験日</span><input type="date" id="examDate" value="${esc(s.examDate || '')}"></label>
      <label class="field"><span>1 日の目標（問）</span><input type="number" id="dailyGoal" min="1" max="200" value="${s.dailyGoal}" style="width:90px"></label>
      <label class="field"><span>テーマ</span><select id="theme"><option value="system" ${s.theme === 'system' ? 'selected' : ''}>端末に合わせる</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>ライト</option><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>ダーク</option></select></label>
      <label class="field"><span>制度変更で古くなった問題も出題する</span><input type="checkbox" id="includeOutdated" ${s.includeOutdated ? 'checked' : ''}></label>
    </div>
    <h2>バックアップ</h2>
    <div class="card">
      <div class="muted" style="margin-bottom:8px">学習記録はこの端末の中にだけあります。JSON ファイルに書き出して「ファイル」や iCloud Drive に保存してください。${s.lastBackupTs ? `最終保存: ${new Date(s.lastBackupTs).toLocaleString('ja-JP')}` : 'まだ保存していません。'}</div>
      <button class="btn btn-primary" id="export" type="button">バックアップを書き出す</button>
      <button class="btn" id="import" type="button">バックアップから復元</button>
      <input type="file" id="file" accept=".json,application/json" class="hidden">
    </div>
    <h2>コンテンツ</h2>
    <div class="card">
      <div>問題 ${content.index.counts.questionsA + content.index.counts.questionsB} 問（科目A ${content.index.counts.questionsA} ・ 科目B ${content.index.counts.questionsB}）・ コンテンツ版 v${content.index.contentVersion}</div>
      <div class="muted">${persisted === true ? '永続ストレージ: 許可済み' : persisted === false ? '永続ストレージ: 未許可（ホーム画面に追加すると許可されやすくなります）' : ''}${usage ? ` ・ 使用量 ${(usage / 1024 / 1024).toFixed(1)} MB` : ''}</div>
      <button class="btn btn-small" id="reload" type="button" style="margin-top:8px">更新を確認</button>
    </div>
    <h2>データ</h2>
    <div class="card">
      <button class="btn" id="rebuild" type="button">集計を再計算</button>
      <button class="btn btn-danger" id="reset" type="button">学習記録をすべて削除</button>
    </div>
    <h2>出典・ライセンス</h2>
    <div class="card muted" style="font-size:.85rem">
      問題は独立行政法人情報処理推進機構（IPA）が公開している情報セキュリティマネジメント試験の公開問題・サンプル問題を、出典を明記して使用しています（IPA は著作権を放棄していません。教育目的の利用）。解説と教科書は本アプリの自作で、IPA の見解ではありません。個人の学習用です。
    </div>`;
  const save = (patch) => { settings.set(patch); };
  root.querySelector('#examDate').onchange = (e) => save({ examDate: e.target.value });
  root.querySelector('#dailyGoal').onchange = (e) => save({ dailyGoal: Math.max(1, Number(e.target.value) || 10) });
  root.querySelector('#theme').onchange = (e) => { save({ theme: e.target.value }); applyTheme(); };
  root.querySelector('#includeOutdated').onchange = (e) => save({ includeOutdated: e.target.checked });
  root.querySelector('#export').onclick = async () => {
    const data = await store.exportJson();
    const name = `sg-study-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: name });
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
      settings.set({ lastBackupTs: Date.now() });
      toast('バックアップを書き出しました');
      render(root);
    } catch (e) { if (e.name !== 'AbortError') toast('書き出しに失敗: ' + e.message); }
  };
  root.querySelector('#import').onclick = () => root.querySelector('#file').click();
  root.querySelector('#file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const n = (data.stores?.attempts || []).length;
      const mode = confirm(`${n} 件の回答記録があります。\n「OK」= 今の記録と結合（マージ）\n「キャンセル」= 今の記録を消して置き換え`) ? 'merge' : (confirm('今の学習記録をすべて消して、ファイルの内容で置き換えます。よろしいですか？') ? 'replace' : null);
      if (!mode) return;
      const added = await store.importJson(data, mode);
      toast(mode === 'merge' ? `${added} 件を追加しました` : '復元しました');
      applyTheme();
      render(root);
    } catch (err) { toast('復元に失敗: ' + err.message, 4000); }
    e.target.value = '';
  };
  root.querySelector('#reload').onclick = async () => { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); toast('確認しました。更新があれば上部に表示されます'); };
  root.querySelector('#rebuild').onclick = async () => { await store.rebuild(); toast('再計算しました'); };
  root.querySelector('#reset').onclick = async () => { if (!confirm('学習記録をすべて削除します。元に戻せません。よろしいですか？')) return; await store.resetAll(); sessionStorage.clear(); toast('削除しました'); };
}
