// 学習記録のドメインロジック。attempts を正として questionState / dailyStats を同時更新する。
import * as db from './db.js';
import { nextSrs } from './core/srs.js';
import { dayKey } from './core/stats.js';

const SETTINGS_KEY = 'sg-study.settings';
const DEFAULTS = { examDate: '2026-11-29', dailyGoal: 10, theme: 'system', includeOutdated: true, sessionSize: 10, lastBackupTs: 0, backupCount: 0 };

export const settings = {
  get() { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { ...DEFAULTS }; } },
  set(patch) { const next = { ...this.get(), ...patch }; try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ } return next; },
};

export const store = {
  states: new Map(),
  daily: new Map(),
  topics: new Map(),

  async load() {
    const [states, daily, topics] = await Promise.all([db.getAll('questionState'), db.getAll('dailyStats'), db.getAll('topicState')]);
    this.states = new Map(states.map((s) => [s.qid, s]));
    this.daily = new Map(daily.map((d) => [d.day, d]));
    this.topics = new Map(topics.map((t) => [t.topicId, t]));
    return this;
  },

  /** 回答を記録する。elapsedMs は 5 分で頭打ち */
  async recordAttempt({ qid, chosen, correct, elapsedMs, mode, sessionId }) {
    const now = Date.now();
    const day = dayKey(new Date(now));
    const elapsed = Math.min(Math.max(elapsedMs || 0, 0), 5 * 60 * 1000);
    const prev = this.states.get(qid) || { qid, attempts: 0, correct: 0, wrong: 0, streak: 0, lastTs: 0, lastCorrect: null, srs: null, bookmarked: false, note: '' };
    const state = {
      ...prev,
      attempts: prev.attempts + 1,
      correct: prev.correct + (correct ? 1 : 0),
      wrong: prev.wrong + (correct ? 0 : 1),
      streak: correct ? prev.streak + 1 : 0,
      lastTs: now,
      lastCorrect: correct,
      srs: mode === 'exam' ? prev.srs : nextSrs(prev.srs, correct, now),
    };
    const d = this.daily.get(day) || { day, answered: 0, correct: 0, studyMs: 0, topicsRead: 0, sessions: 0 };
    const dailyNext = { ...d, answered: d.answered + 1, correct: d.correct + (correct ? 1 : 0), studyMs: d.studyMs + elapsed };
    const attempt = { qid, ts: now, day, mode, chosen, correct, elapsedMs: elapsed, sessionId };
    await db.add('attempts', attempt);
    await db.putMany([{ store: 'questionState', value: state }, { store: 'dailyStats', value: dailyNext }]);
    this.states.set(qid, state);
    this.daily.set(day, dailyNext);
    return state;
  },

  /** 教科書の理解度（0 未学習 / 1 学習中 / 2 理解した）。その日初めての記録なら topicsRead を増やす */
  async rateTopic(topicId, rating) {
    const now = Date.now();
    const day = dayKey(new Date(now));
    const prev = this.topics.get(topicId) || { topicId, rating: 0, lastTs: 0, readCount: 0, lastReadDay: '' };
    const t = { ...prev, rating, lastTs: now, readCount: prev.readCount + 1, lastReadDay: day };
    const ops = [{ store: 'topicState', value: t }];
    if (prev.lastReadDay !== day) {
      const d = this.daily.get(day) || { day, answered: 0, correct: 0, studyMs: 0, topicsRead: 0, sessions: 0 };
      const dn = { ...d, topicsRead: (d.topicsRead || 0) + 1 };
      ops.push({ store: 'dailyStats', value: dn });
      this.daily.set(day, dn);
    }
    await db.putMany(ops);
    this.topics.set(topicId, t);
    return t;
  },

  async toggleBookmark(qid) {
    const prev = this.states.get(qid) || { qid, attempts: 0, correct: 0, wrong: 0, streak: 0, lastTs: 0, lastCorrect: null, srs: null, bookmarked: false, note: '' };
    const state = { ...prev, bookmarked: !prev.bookmarked };
    await db.put('questionState', state);
    this.states.set(qid, state);
    return state.bookmarked;
  },

  async saveSession(session) { await db.put('sessions', session); },

  async exportJson() {
    const stores = await db.dump();
    return { app: 'sg-study', schemaVersion: 1, exportedAt: new Date().toISOString(), settings: settings.get(), stores };
  },

  /** 復元。mode: 'replace' | 'merge' */
  async importJson(data, mode) {
    if (!data || data.app !== 'sg-study' || !data.stores) throw new Error('sg-study のバックアップファイルではありません');
    if (mode === 'replace') await db.clearAll();
    const existing = mode === 'merge' ? await db.getAll('attempts') : [];
    const seen = new Set(existing.map((a) => `${a.qid}|${a.ts}`));
    let added = 0;
    for (const a of data.stores.attempts || []) {
      const key = `${a.qid}|${a.ts}`;
      if (seen.has(key)) continue;
      const { id, ...rest } = a;
      await db.add('attempts', rest);
      seen.add(key);
      added += 1;
    }
    for (const s of data.stores.sessions || []) await db.put('sessions', s);
    for (const t of data.stores.topicState || []) await db.put('topicState', t);
    for (const e of data.stores.exams || []) await db.put('exams', e);
    await this.rebuild();
    if (data.settings) settings.set({ ...data.settings, lastBackupTs: settings.get().lastBackupTs });
    return added;
  },

  /** attempts から questionState と dailyStats を作り直す */
  async rebuild() {
    const attempts = (await db.getAll('attempts')).sort((a, b) => a.ts - b.ts);
    const old = new Map((await db.getAll('questionState')).map((s) => [s.qid, s]));
    const states = new Map();
    const daily = new Map();
    for (const a of attempts) {
      const prev = states.get(a.qid) || { qid: a.qid, attempts: 0, correct: 0, wrong: 0, streak: 0, lastTs: 0, lastCorrect: null, srs: null, bookmarked: old.get(a.qid)?.bookmarked || false, note: old.get(a.qid)?.note || '' };
      states.set(a.qid, { ...prev, attempts: prev.attempts + 1, correct: prev.correct + (a.correct ? 1 : 0), wrong: prev.wrong + (a.correct ? 0 : 1), streak: a.correct ? prev.streak + 1 : 0, lastTs: a.ts, lastCorrect: a.correct, srs: a.mode === 'exam' ? prev.srs : nextSrs(prev.srs, a.correct, a.ts) });
      const d = daily.get(a.day) || { day: a.day, answered: 0, correct: 0, studyMs: 0, topicsRead: 0, sessions: 0 };
      daily.set(a.day, { ...d, answered: d.answered + 1, correct: d.correct + (a.correct ? 1 : 0), studyMs: d.studyMs + (a.elapsedMs || 0) });
    }
    for (const [qid, s] of old) if (!states.has(qid) && (s.bookmarked || s.note)) states.set(qid, { ...s, attempts: 0, correct: 0, wrong: 0, streak: 0, lastTs: 0, lastCorrect: null, srs: null });
    const ops = [...states.values()].map((v) => ({ store: 'questionState', value: v })).concat([...daily.values()].map((v) => ({ store: 'dailyStats', value: v })));
    if (ops.length) await db.putMany(ops);
    for (const [k, v] of this.daily) if (!daily.has(k) && v.topicsRead) daily.set(k, { ...v, answered: 0, correct: 0, studyMs: 0 }); else if (daily.has(k)) daily.get(k).topicsRead = v.topicsRead || 0;
    if (daily.size) await db.putMany([...daily.values()].map((v) => ({ store: 'dailyStats', value: v })));
    this.states = states;
    this.daily = daily;
  },

  async resetAll() { await db.clearAll(); this.states = new Map(); this.daily = new Map(); this.topics = new Map(); },
};
