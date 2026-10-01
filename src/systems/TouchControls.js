/**
 * On-screen controls for phones and tablets.
 *
 * Built from DOM elements laid over the canvas rather than Phaser objects: the
 * canvas is letterboxed and scaled, while thumbs need targets sized in real
 * screen pixels, and DOM pointer events give clean multi-touch for free.
 *
 *   left thumb  - a D-pad. One zone, eight directions, so the thumb can roll
 *                 from LEFT to RIGHT (or into a diagonal) without lifting.
 *   right thumb - JUMP, plus a RUN toggle so running never needs a second
 *                 finger held down.
 *   top right   - pause.
 *
 * GameScene reads `state` every frame and drains one-shot presses through
 * `consume()`, mirroring Phaser's Keyboard.JustDown.
 */

const DEAD_ZONE = 0.22;      // fraction of the pad radius that registers nothing
const DIAGONAL = 0.42;       // minor axis must exceed this share of the major one

const state = {
  left: false, right: false, up: false, down: false,
  jump: false,
  run: false                 // toggled, not held
};
const latch = { jump: false, up: false, down: false };

let root = null;
let pad = null;
const arrows = {};
let jumpBtn = null;
let runBtn = null;
let visible = false;
let touchMode = false;
let padPointer = null;
const jumpPointers = new Set();
let onPause = null;

function detectTouch() {
  const mm = (q) => window.matchMedia && window.matchMedia(q).matches;
  return mm('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && !mm('(pointer: fine)'));
}

/** Keep receiving a finger's moves after it slides off the element it began on. */
function capture(target, e) {
  try { target.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
}

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  parent.appendChild(e);
  return e;
}

/* ---------------------------------------------------------------- D-pad */

function setDir(nx, ny) {
  const wasUp = state.up;
  const wasDown = state.down;
  let l = false, r = false, u = false, d = false;
  const ax = Math.abs(nx), ay = Math.abs(ny);
  if (Math.max(ax, ay) > DEAD_ZONE) {
    if (ax >= ay) {
      r = nx > 0; l = nx < 0;
      if (ay > ax * DIAGONAL && ay > DEAD_ZONE) { d = ny > 0; u = ny < 0; }
    } else {
      d = ny > 0; u = ny < 0;
      if (ax > ay * DIAGONAL && ax > DEAD_ZONE) { r = nx > 0; l = nx < 0; }
    }
  }
  state.left = l; state.right = r; state.up = u; state.down = d;
  if (u && !wasUp) latch.up = true;
  if (d && !wasDown) latch.down = true;
  for (const k in arrows) arrows[k].classList.toggle('on', state[k]);
}

function padFromEvent(e) {
  const rect = pad.getBoundingClientRect();
  const r = rect.width / 2;
  setDir((e.clientX - rect.left - r) / r, (e.clientY - rect.top - r) / r);
}

function padDown(e) {
  e.preventDefault();
  if (padPointer !== null) return;
  padPointer = e.pointerId;
  capture(pad, e);
  padFromEvent(e);
}

function padMove(e) {
  if (e.pointerId !== padPointer) return;
  e.preventDefault();
  padFromEvent(e);
}

function padUp(e) {
  if (e.pointerId !== padPointer) return;
  padPointer = null;
  setDir(0, 0);
}

/* --------------------------------------------------------------- buttons */

function jumpDown(e) {
  e.preventDefault();
  capture(jumpBtn, e);
  if (jumpPointers.size === 0) latch.jump = true;
  jumpPointers.add(e.pointerId);
  state.jump = true;
  jumpBtn.classList.add('on');
}

function jumpUp(e) {
  jumpPointers.delete(e.pointerId);
  if (jumpPointers.size === 0) {
    state.jump = false;
    jumpBtn.classList.remove('on');
  }
}

function setRun(on) {
  state.run = on;
  if (runBtn) runBtn.classList.toggle('on', on);
}

/* ----------------------------------------------------------------- build */

function build() {
  root = el('div', 'tc', document.body);
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  pad = el('div', 'tc-pad', root);
  arrows.up = el('div', 'tc-arrow tc-up', pad, '<i></i>');
  arrows.down = el('div', 'tc-arrow tc-down', pad, '<i></i>');
  arrows.left = el('div', 'tc-arrow tc-left', pad, '<i></i>');
  arrows.right = el('div', 'tc-arrow tc-right', pad, '<i></i>');
  el('div', 'tc-hub', pad);
  pad.addEventListener('pointerdown', padDown);
  pad.addEventListener('pointermove', padMove);
  pad.addEventListener('pointerup', padUp);
  pad.addEventListener('pointercancel', padUp);
  pad.addEventListener('lostpointercapture', padUp);

  jumpBtn = el('div', 'tc-btn tc-jump', root, '<span>JUMP</span>');
  jumpBtn.addEventListener('pointerdown', jumpDown);
  jumpBtn.addEventListener('pointerup', jumpUp);
  jumpBtn.addEventListener('pointercancel', jumpUp);
  jumpBtn.addEventListener('lostpointercapture', jumpUp);

  runBtn = el('div', 'tc-btn tc-run', root, '<span>RUN</span>');
  runBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); setRun(!state.run); });

  const pause = el('div', 'tc-btn tc-pause', root, '<span>II</span>');
  pause.addEventListener('pointerdown', (e) => { e.preventDefault(); if (onPause) onPause(); });

  apply();
}

function releaseAll() {
  padPointer = null;
  jumpPointers.clear();
  setDir(0, 0);
  state.jump = false;
  if (jumpBtn) jumpBtn.classList.remove('on');
  latch.jump = latch.up = latch.down = false;
}

function apply() {
  if (!root) return;
  const on = visible && touchMode;
  root.classList.toggle('show', on);
  if (!on) releaseAll();
}

function setTouchMode(on) {
  if (on === touchMode) return;
  touchMode = on;
  document.documentElement.classList.toggle('touch', on);
  apply();
}

/* ------------------------------------------------------------ fullscreen */

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export function enterFullscreen() {
  const d = document.documentElement;
  const req = d.requestFullscreen || d.webkitRequestFullscreen;
  if (!req || isFullscreen()) return;
  const lock = () => {
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
  };
  try {
    const p = req.call(d, { navigationUI: 'hide' });
    if (p && p.then) p.then(lock).catch(() => {}); else lock();
  } catch (e) { /* not allowed here - the browser bar simply stays */ }
}

export function exitFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (exit && isFullscreen()) exit.call(document);
}

/* -------------------------------------------------------------- the API */

const Touch = {
  state,

  /** Call once at startup. */
  init() {
    if (root) return;
    build();
    setTouchMode(detectTouch());

    // Any touch switches to touch mode; a physical key press switches back.
    window.addEventListener('touchstart', () => setTouchMode(true), { passive: true });
    window.addEventListener('keydown', () => setTouchMode(false));

    // The first tap goes fullscreen + landscape where the browser allows it.
    let tried = false;
    window.addEventListener('touchend', () => {
      if (tried) return;
      tried = true;
      enterFullscreen();
    }, { passive: true });
  },

  get active() { return touchMode; },

  /** Show or hide the in-game controls; they only ever appear in touch mode. */
  show(on, pauseHandler) {
    visible = on;
    if (pauseHandler !== undefined) onPause = pauseHandler;
    apply();
  },

  /** One-shot press since the last call: 'jump' | 'up' | 'down'. */
  consume(name) {
    const v = latch[name];
    latch[name] = false;
    return v;
  }
};

/** Rewrites keyboard wording in tutorial signs for touch players. */
const TOUCH_WORDS = [
  ['A / D  -  MOVE\nSHIFT  -  RUN', 'ARROWS  -  MOVE\nRUN BUTTON  -  RUN'],
  ['SPACE  -  JUMP', 'TAP JUMP'],
  ['W  -  PULL UP', 'UP  -  PULL UP'],
  ['S  -  DROP THROUGH', 'DOWN  -  DROP THROUGH'],
  ['HOLD SHIFT FOR', 'TURN ON RUN FOR'],
  ['THEN W TO PULL UP', 'THEN UP TO PULL UP'],
  ['PRESS INTO A WALL', 'HOLD TOWARD A WALL'],
  ['PUSH INTO THE WALL', 'HOLD TOWARD THE WALL']
];

export function touchText(text) {
  if (!touchMode) return text;
  let out = text;
  for (const [k, v] of TOUCH_WORDS) out = out.split(k).join(v);
  return out;
}

export default Touch;
