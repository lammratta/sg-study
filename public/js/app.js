// 起動・ルーティング・タブ・Service Worker 更新。
import { content } from './content.js';
import { store, settings } from './store.js';
import { toast } from './ui/components.js';
import * as home from './screens/home.js';
import * as textbook from './screens/textbook.js';
import * as quiz from './screens/quiz.js';
import * as progress from './screens/progress.js';
import * as settingsScreen from './screens/settings.js';
import * as exam from './screens/exam.js';

const screens = { home, textbook, quiz, progress, settings: settingsScreen, exam };
const tabOf = { exam: 'quiz' };
const root = document.getElementById('screen');
let current = null;

export function applyTheme() {
  const t = settings.get().theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

function parseHash() {
  const raw = (location.hash || '#home').slice(1);
  const [pathPart, query = ''] = raw.split('?');
  const [name, ...rest] = pathPart.split('/');
  return { name: screens[name] ? name : 'home', sub: rest.join('/'), params: Object.fromEntries(new URLSearchParams(query)) };
}

async function route() {
  const { name, sub, params } = parseHash();
  if (current?.destroy) current.destroy();
  current = screens[name];
  document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === (tabOf[name] || name)));
  document.body.classList.toggle('fullscreen', !!(current.fullscreen && current.fullscreen(sub, params)));
  window.scrollTo(0, 0);
  try {
    await current.render(root, { sub, params });
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="card"><div class="card-title">エラー</div><div class="muted">${e.message}</div><a class="btn" href="#home">ホームへ</a></div>`;
  }
}

async function registerSw() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    const banner = document.getElementById('update-banner');
    const show = (worker) => {
      banner.classList.remove('hidden');
      document.getElementById('update-btn').onclick = () => { worker.postMessage({ type: 'SKIP_WAITING' }); banner.classList.add('hidden'); };
    };
    if (reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) show(w); });
    });
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (refreshing) return; refreshing = true; location.reload(); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  } catch (e) { console.warn('sw', e); }
}

async function init() {
  applyTheme();
  try { if (navigator.storage?.persist) navigator.storage.persist().catch(() => {}); } catch { /* ignore */ }
  try {
    await Promise.all([content.load(), store.load()]);
  } catch (e) {
    root.innerHTML = `<div class="card"><div class="card-title">コンテンツを読み込めませんでした</div><div class="muted">${e.message}。通信できる場所で一度開いてください。</div></div>`;
    return;
  }
  window.addEventListener('hashchange', route);
  await route();
  registerSw();
  if (!navigator.standalone && !matchMedia('(display-mode: standalone)').matches && !localStorage.getItem('sg-study.a2hs')) {
    localStorage.setItem('sg-study.a2hs', '1');
    setTimeout(() => toast('Safari の共有メニューから「ホーム画面に追加」できます', 5000), 1500);
  }
}
init();
