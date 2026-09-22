import level1 from './level1.js';
import level2 from './level2.js';
import level3 from './level3.js';

/** Play order. Add a level here and it appears on the select screen. */
export const LEVELS = [level1, level2, level3];

export function levelByKey(key) {
  return LEVELS.find((l) => l.key === key) || LEVELS[0];
}

export function levelIndex(key) {
  const i = LEVELS.findIndex((l) => l.key === key);
  return i < 0 ? 0 : i;
}
