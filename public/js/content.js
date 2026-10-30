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
  questions: [],    // 公式問題の一覧（演習・模試・集計に使う）
  allQuestions: [], // questions/index.json 全体（オリジナル問題を含む）
  topics: [],       // textbook/index.json
  byId: new Map(),  // id -> 一覧エントリ
  topicById: new Map(), // 教科書ページ id -> 目次エントリ
  subs: new Map(),  // subId -> {id, name, category, field, kind, middle}
  skills: new Map(),

  async load() {
    this.index = await fetchJson('index.json', { cache: 'no-cache' }).catch(() => fetchJson('index.json'));
    [this.syllabus, this.allQuestions, this.topics] = await Promise.all([fetchJson('syllabus.json'), fetchJson('questions/index.json'), fetchJson('textbook/index.json').catch(() => [])]);
    // オリジナル問題は教科書の確認テスト専用。byId には含めて、出題と解説の表示はできるようにする
    this.questions = this.allQuestions.filter((q) => !q.original);
    this.byId = new Map(this.allQuestions.map((q) => [q.id, q]));
    this.topicById = new Map(this.topics.map((t) => [t.id, t]));
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

  /** 問題を解くために読む教科書ページ（主ページ、前提ページの順）。対応表にない問題は同じ小分類の先頭ページ */
  pagesForQuestion(qid) {
    const e = this.byId.get(qid);
    if (!e) return [];
    const ids = e.topic ? [e.topic, ...(e.topicAlso || [])] : this.topics.filter((t) => t.sub === e.sub).slice(0, 1).map((t) => t.id);
    return ids.map((id) => this.topicById.get(id)).filter(Boolean);
  },

  subName(subId) { return this.subs.get(subId)?.name || '未分類'; },
  figureUrl(src) { return base + src; },
};
