import { GAME } from '../config.js';

const DEFAULTS = {
  unlocked: 1,
  completed: [],
  best: {},
  settings: { music: true, sfx: true, shake: true, hints: true }
};

function read() {
  try {
    // Fall back to the save written under the game's previous name so existing
    // progress survives the rename; it is rewritten under the new key on the
    // next write.
    const raw = localStorage.getItem(GAME.SAVE_KEY)
      || (GAME.LEGACY_SAVE_KEY && localStorage.getItem(GAME.LEGACY_SAVE_KEY));
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return {
      unlocked: parsed.unlocked || 1,
      completed: parsed.completed || [],
      best: parsed.best || {},
      settings: Object.assign({}, DEFAULTS.settings, parsed.settings || {})
    };
  } catch (e) {
    // private browsing, disabled storage, corrupt blob - play without a save
    return structuredClone(DEFAULTS);
  }
}

function write(state) {
  try { localStorage.setItem(GAME.SAVE_KEY, JSON.stringify(state)); } catch (e) { /* non-fatal */ }
}

const Save = {
  state: read(),

  get settings() { return this.state.settings; },

  setSetting(key, value) {
    this.state.settings[key] = value;
    write(this.state);
  },

  unlocked(index) { return index <= this.state.unlocked; },

  complete(index, levelKey, timeMs) {
    if (!this.state.completed.includes(levelKey)) this.state.completed.push(levelKey);
    const prev = this.state.best[levelKey];
    if (!prev || timeMs < prev) this.state.best[levelKey] = timeMs;
    if (index + 1 > this.state.unlocked) this.state.unlocked = Math.min(3, index + 1);
    write(this.state);
  },

  best(levelKey) { return this.state.best[levelKey] || null; },

  allComplete() { return this.state.completed.length >= 3; },

  totalBest() {
    const keys = ['level1', 'level2', 'level3'];
    if (!keys.every((k) => this.state.best[k])) return null;
    return keys.reduce((s, k) => s + this.state.best[k], 0);
  },

  reset() {
    this.state = structuredClone(DEFAULTS);
    write(this.state);
  }
};

export function formatTime(ms) {
  if (ms === null || ms === undefined) return '--:--.-';
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const d = Math.floor((total % 1000) / 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${d}`;
}

export default Save;
