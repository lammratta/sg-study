// public/content/*.json の読込と、メモリ上のキャッシュ。
const base = new URL('./content/', document.baseURI).href;
const cache = new Map();

async function fetchJson(rel, opts = {}) {
  const res = await fetch(base + rel, opts);
  if (!res.ok) throw new Error(`${rel}: ${res.status}`);
  return res.json();
}

export const content = {
  index: null,      // content/index.json
  syllabus: null,
  questions: [],    // questions/index.json（軽量な一覧）
  topics: [],       // textbook/index.json
  byId: new Map(),  // id -> 一覧エントリ
  subs: new Map(),  // subId -> {id, name, category, field, kind, middle}
  skills: new Map(),

  async load() {
    this.index = await fetchJson('index.json', { cache: 'no-cache' }).catch(() => fetchJson('index.json'));
    [this.syllabus, this.questions, this.topics] = await Promise.all([fetchJson('syllabus.json'), fetchJson('questions/index.json'), fetchJson('textbook/index.json').catch(() => [])]);
    this.byId = new Map(this.questions.map((q) => [q.id, q]));
    this.subs = new Map();
    for (const c of this.syllabus.categories) for (const s of c.subs) this.subs.set(s.id, { ...s, category: c.id, field: c.field, kind: c.kind, middle: c.middle, major: c.major });
    this.skills = new Map(this.syllabus.skills.map((s) => [s.id, s]));
    return this;
  },

  async getSet(setId) {
    if (!cache.has(setId)) cache.set(setId, fetchJson(`questions/${setId}.json`));
    return cache.get(setId);
  },

  async getQuestion(id) {
    const entry = this.byId.get(id);
    if (!entry) throw new Error(`unknown question ${id}`);
    const set = await this.getSet(entry.setId);
    return set.questions.find((q) => q.id === id);
  },

  async getTopic(id) {
    if (!cache.has(`t:${id}`)) cache.set(`t:${id}`, fetchJson(`textbook/${id}.json`));
    return cache.get(`t:${id}`);
  },

  subName(subId) { return this.subs.get(subId)?.name || '未分類'; },
  figureUrl(src) { return base + src; },
};
