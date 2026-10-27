// IndexedDB の薄いラッパー。学習記録はすべてここを通す。
const DB_NAME = 'sg-study';
const DB_VERSION = 1;
let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const attempts = db.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true });
      attempts.createIndex('qid', 'qid');
      attempts.createIndex('day', 'day');
      db.createObjectStore('questionState', { keyPath: 'qid' });
      db.createObjectStore('sessions', { keyPath: 'id' });
      db.createObjectStore('dailyStats', { keyPath: 'day' });
      db.createObjectStore('meta', { keyPath: 'key' });
      db.createObjectStore('topicState', { keyPath: 'topicId' });
      db.createObjectStore('exams', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const reqp = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function get(store, key) {
  const db = await openDb();
  return reqp(db.transaction(store).objectStore(store).get(key));
}
export async function getAll(store) {
  const db = await openDb();
  return reqp(db.transaction(store).objectStore(store).getAll());
}
export async function put(store, value) {
  const db = await openDb();
  return reqp(db.transaction(store, 'readwrite').objectStore(store).put(value));
}
export async function add(store, value) {
  const db = await openDb();
  return reqp(db.transaction(store, 'readwrite').objectStore(store).add(value));
}
/** 複数ストアへの書込みを 1 トランザクションで行う。ops: [{store, value}] */
export async function putMany(ops) {
  const db = await openDb();
  const stores = [...new Set(ops.map((o) => o.store))];
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, 'readwrite');
    for (const o of ops) t.objectStore(o.store).put(o.value);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
export async function clearAll() {
  const db = await openDb();
  const names = [...db.objectStoreNames];
  return new Promise((resolve, reject) => {
    const t = db.transaction(names, 'readwrite');
    for (const n of names) t.objectStore(n).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export async function dump() {
  const db = await openDb();
  const out = {};
  for (const n of [...db.objectStoreNames]) out[n] = await reqp(db.transaction(n).objectStore(n).getAll());
  return out;
}
