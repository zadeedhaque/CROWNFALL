/**
 * Builds the protagonist's sprite sheet at runtime.
 *
 * Rashan is drawn from a small skeletal rig (hip, shoulder, head, two arms, two
 * legs) so every frame is an authored pose rather than a hand-placed bitmap.
 * That keeps the sheet tiny in source, gives us real in-betweens, and means a
 * hand-drawn PNG can replace it later by simply loading a texture with the same
 * key + frame layout (24x32, 12 per row, indices below).
 */

export const HERO_KEY = 'hero';
export const FRAME_W = 24;
export const FRAME_H = 32;
const PER_ROW = 12;

// Original palette - a desert-born royal in light travelling clothes.
const C = {
  skin: '#d8a06a',
  skinShade: '#b47f4e',
  hair: '#2a1a12',
  wrap: '#c8452f',      // head wrap / sash accent
  wrapDark: '#8e2b1e',
  tunic: '#2f7f8c',     // teal tunic
  tunicDark: '#1d5a66',
  tunicLight: '#48a3ad',
  sash: '#e2b24c',      // gold sash
  trouser: '#e6dcc2',
  trouserDark: '#bdb096',
  boot: '#6d4526',
  bootDark: '#4a2e18',
  outline: '#241820'
};

/* ------------------------------------------------------------------ helpers */

function dot(ctx, x, y, w) {
  const lo = -Math.floor((w - 1) / 2);
  const hi = Math.ceil((w - 1) / 2);
  const rx = Math.round(x), ry = Math.round(y);
  for (let j = lo; j <= hi; j++) {
    for (let i = lo; i <= hi; i++) {
      ctx.fillRect(rx + i, ry + j, 1, 1);
    }
  }
}

/** Draw a limb segment. Angle 0 points straight down, positive rotates forward (+x). */
function seg(ctx, x, y, ang, len, w, color) {
  const r = ang * Math.PI / 180;
  const dx = Math.sin(r), dy = Math.cos(r);
  ctx.fillStyle = color;
  const steps = Math.max(2, Math.ceil(len * 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    dot(ctx, x + dx * len * t, y + dy * len * t, w);
  }
  return { x: x + dx * len, y: y + dy * len };
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/* -------------------------------------------------------------- pose tables */

// One stride of a walk, sampled at 8 phases: [thighAngle, kneeBend]
// kneeBend is always <= 0 because a knee only folds backwards.
const WALK = [
  [24, -4], [12, -2], [0, -2], [-14, -6],
  [-24, -20], [-12, -46], [4, -40], [20, -18]
];
const RUN = [
  [36, -6], [16, -4], [-2, -8], [-22, -16],
  [-36, -36], [-14, -74], [12, -66], [30, -28]
];

function cycle(table, i) { return table[((i % 8) + 8) % 8]; }

/**
 * A pose describes the whole rig for one frame.
 *  lean     - shoulder x offset (forward lean)
 *  hipY     - hip vertical offset (crouching / bobbing)
 *  headX/Y  - head offset on top of the neck
 *  legA/legB- [thigh, knee] for the near and far leg
 *  armA/armB- [shoulder, elbow] for the near and far arm
 *  cloth    - angle of the trailing head-wrap cloth
 */
function pose(o) {
  return Object.assign({
    lean: 0, hipY: 0, headX: 0, headY: 0,
    legA: [4, -4], legB: [-4, -6],
    armA: [6, -8], armB: [-6, -10],
    cloth: -150, squash: 0
  }, o);
}

function locomotion(table, i, leanAmount, armAmp) {
  const a = cycle(table, i);
  const b = cycle(table, i + 4);
  const t = (i / 8) * Math.PI * 2;
  const sw = Math.cos(t);
  return pose({
    lean: leanAmount,
    hipY: Math.abs(Math.sin(t * 2)) * -1,
    legA: a, legB: b,
    armA: [-armAmp * sw, -14 - 10 * Math.abs(sw)],
    armB: [armAmp * sw, -14 - 10 * Math.abs(sw)],
    cloth: -150 - leanAmount * 2
  });
}

function buildPoses() {
  const P = [];

  // 0-3 idle (slow breathing, weight on the back foot)
  const idleBob = [0, -1, 0, 0];
  for (let i = 0; i < 4; i++) {
    P.push(pose({
      hipY: idleBob[i],
      headY: i === 1 ? -1 : 0,
      legA: [5, -3], legB: [-6, -8],
      armA: [7, -9 - i], armB: [-5, -12 - i],
      cloth: -152 + i * 4
    }));
  }

  // 4-11 run
  for (let i = 0; i < 8; i++) P.push(locomotion(RUN, i, 3, 34));
  // 12-19 walk
  for (let i = 0; i < 8; i++) P.push(locomotion(WALK, i, 1, 18));

  // 20-21 jump rise
  P.push(pose({ lean: 1, legA: [34, -56], legB: [-16, -48], armA: [-62, -18], armB: [-44, -24], cloth: -120 }));
  P.push(pose({ lean: 1, legA: [26, -22], legB: [-26, -32], armA: [-40, -14], armB: [-28, -18], cloth: -128 }));
  // 22-23 fall
  P.push(pose({ lean: 0, legA: [18, -30], legB: [-22, -42], armA: [56, -22], armB: [-52, -26], cloth: -100 }));
  P.push(pose({ lean: 0, hipY: -1, legA: [22, -24], legB: [-18, -48], armA: [62, -18], armB: [-46, -30], cloth: -96 }));
  // 24-25 landing recovery
  P.push(pose({ lean: 5, hipY: 6, legA: [16, -74], legB: [-14, -70], armA: [46, -30], armB: [30, -36], cloth: -80, squash: 1 }));
  P.push(pose({ lean: 3, hipY: 3, legA: [10, -44], legB: [-10, -42], armA: [28, -22], armB: [16, -26], cloth: -110 }));
  // 26-27 crouch
  P.push(pose({ lean: 4, hipY: 8, legA: [18, -86], legB: [-16, -82], armA: [22, -40], armB: [8, -46], cloth: -70 }));
  P.push(pose({ lean: 4, hipY: 7, legA: [18, -84], legB: [-16, -80], armA: [20, -38], armB: [6, -44], cloth: -74 }));
  // 28-29 ledge hang
  P.push(pose({ lean: 2, hipY: 2, headY: 1, legA: [8, -18], legB: [-9, -26], armA: [172, -4], armB: [166, -8], cloth: -60 }));
  P.push(pose({ lean: 2, hipY: 3, headY: 1, legA: [12, -26], legB: [-6, -18], armA: [172, -4], armB: [166, -8], cloth: -66 }));

  // 30-35 ledge climb (pull-up -> knee over -> stand)
  P.push(pose({ lean: 2, hipY: 2, legA: [10, -22], legB: [-8, -28], armA: [168, -34], armB: [162, -40], cloth: -60 }));
  P.push(pose({ lean: 6, hipY: 1, legA: [28, -70], legB: [4, -52], armA: [150, -74], armB: [146, -80], cloth: -56 }));
  P.push(pose({ lean: 10, hipY: 0, legA: [52, -96], legB: [16, -70], armA: [122, -96], armB: [118, -100], cloth: -50 }));
  P.push(pose({ lean: 12, hipY: 4, legA: [66, -92], legB: [22, -76], armA: [64, -30], armB: [54, -36], cloth: -60 }));
  P.push(pose({ lean: 8, hipY: 6, legA: [40, -66], legB: [4, -40], armA: [34, -16], armB: [24, -22], cloth: -80 }));
  P.push(pose({ lean: 3, hipY: 3, legA: [16, -34], legB: [-10, -22], armA: [16, -12], armB: [6, -16], cloth: -120 }));

  // 36-37 wall slide (back to the wall, one hand trailing on the stone)
  P.push(pose({ lean: -2, hipY: 2, legA: [22, -44], legB: [-12, -54], armA: [158, -12], armB: [34, -22], cloth: -40 }));
  P.push(pose({ lean: -2, hipY: 3, legA: [18, -50], legB: [-16, -48], armA: [162, -10], armB: [28, -26], cloth: -46 }));

  // 38-41 vault
  P.push(pose({ lean: 8, hipY: 2, legA: [32, -44], legB: [-18, -62], armA: [56, -10], armB: [20, -30], cloth: -70 }));
  P.push(pose({ lean: 12, hipY: -1, legA: [62, -100], legB: [44, -92], armA: [24, -6], armB: [-10, -20], cloth: -50 }));
  P.push(pose({ lean: 8, hipY: -2, legA: [72, -46], legB: [52, -64], armA: [-18, -12], armB: [-40, -18], cloth: -60 }));
  P.push(pose({ lean: 4, hipY: 2, legA: [26, -32], legB: [-16, -44], armA: [-10, -16], armB: [-34, -20], cloth: -96 }));

  // 42 skid / turn
  P.push(pose({ lean: -6, hipY: 3, legA: [38, -14], legB: [-28, -30], armA: [-44, -20], armB: [52, -24], cloth: -168 }));
  // 43 airborne reach (arms up, hunting for a ledge)
  P.push(pose({ lean: 3, hipY: 1, legA: [16, -34], legB: [-12, -44], armA: [164, -10], armB: [156, -16], cloth: -70 }));
  // 44 tucked drop
  P.push(pose({ lean: 6, hipY: 4, legA: [40, -80], legB: [10, -72], armA: [30, -50], armB: [12, -56], cloth: -60 }));

  return P;
}

/* ----------------------------------------------------------------- drawing */

function drawHero(ctx, ox, oy, p) {
  const hipX = ox + 12;
  const hipY = oy + 20 + p.hipY;
  const shX = hipX + p.lean;
  const shY = hipY - 9 + (p.squash ? 1 : 0);
  const headX = shX + p.headX + Math.round(p.lean * 0.4);
  const headY = shY - 5 + p.headY;

  // --- far side limbs first so they sit behind the torso
  const hipBx = hipX - 1, shBx = shX - 1;
  const kneeB = seg(ctx, hipBx, hipY, p.legB[0], 6, 3, C.trouserDark);
  const footB = seg(ctx, kneeB.x, kneeB.y, p.legB[0] + p.legB[1], 5, 3, C.trouserDark);
  seg(ctx, footB.x, footB.y - 1, p.legB[0] + p.legB[1], 2, 3, C.bootDark);

  const elbowB = seg(ctx, shBx, shY, p.armB[0], 5, 3, C.tunicDark);
  const handB = seg(ctx, elbowB.x, elbowB.y, p.armB[0] + p.armB[1], 5, 2, C.skinShade);

  // --- trailing head cloth
  {
    const r = p.cloth * Math.PI / 180;
    let cx = headX, cy = headY + 1;
    ctx.fillStyle = C.wrapDark;
    for (let i = 1; i <= 8; i++) {
      cx += Math.sin(r) * 1.1;
      cy += Math.cos(r) * 1.1 + i * 0.16;
      dot(ctx, cx, cy, i > 5 ? 1 : 2);
    }
  }

  // --- torso: a slightly tapered tunic from shoulders to hips
  {
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = shX + (hipX - shX) * t;
      const y = shY + (hipY - shY) * t;
      const w = 7 - Math.round(t * 1.5);
      rect(ctx, x - (w >> 1), y, w, 1, i < 5 ? C.tunic : C.tunicDark);
    }
    // collar highlight + gold sash across the chest
    rect(ctx, shX - 3, shY - 1, 7, 1, C.tunicLight);
    ctx.fillStyle = C.sash;
    for (let i = 0; i < 6; i++) dot(ctx, shX - 3 + i, shY + 3 + i * 0.7, 1);
    rect(ctx, hipX - 4, hipY - 1, 8, 2, C.sash);
  }

  // --- near side limbs in front of the torso
  const kneeA = seg(ctx, hipX + 1, hipY, p.legA[0], 6, 3, C.trouser);
  const footA = seg(ctx, kneeA.x, kneeA.y, p.legA[0] + p.legA[1], 5, 3, C.trouser);
  seg(ctx, footA.x, footA.y - 1, p.legA[0] + p.legA[1], 2, 3, C.boot);

  const elbowA = seg(ctx, shX + 1, shY, p.armA[0], 5, 3, C.tunic);
  seg(ctx, elbowA.x, elbowA.y, p.armA[0] + p.armA[1], 5, 2, C.skin);

  // --- head: face, hair, wrapped headband
  rect(ctx, headX - 3, headY - 3, 6, 6, C.skin);
  rect(ctx, headX - 3, headY + 1, 6, 2, C.skinShade);
  rect(ctx, headX - 3, headY - 4, 7, 2, C.hair);
  rect(ctx, headX - 4, headY - 3, 2, 3, C.hair);
  rect(ctx, headX - 4, headY - 2, 8, 2, C.wrap);
  rect(ctx, headX - 4, headY - 2, 8, 1, C.wrapDark);
  // eye
  rect(ctx, headX + 1, headY, 1, 1, C.outline);

  // keep the far hand visible when arms are overhead (hanging / climbing)
  if (p.armB[0] > 120) { ctx.fillStyle = C.skinShade; dot(ctx, handB.x, handB.y, 2); }
}

/* ------------------------------------------------------------------ public */

export const HERO_FRAMES = {
  idle: [0, 1, 2, 3],
  run: [4, 5, 6, 7, 8, 9, 10, 11],
  walk: [12, 13, 14, 15, 16, 17, 18, 19],
  jump: [20, 21],
  fall: [22, 23],
  land: [24, 25],
  crouch: [26, 27],
  hang: [28, 29],
  climb: [30, 31, 32, 33, 34, 35],
  wallslide: [36, 37],
  vault: [38, 39, 40, 41],
  skid: [42],
  reach: [43],
  tuck: [44]
};

export function createHeroTexture(scene) {
  if (scene.textures.exists(HERO_KEY)) return;
  const poses = buildPoses();
  const rows = Math.ceil(poses.length / PER_ROW);

  // A canvas we own, registered straight as a sprite sheet. (Drawing into a
  // Phaser CanvasTexture and re-adding it loses the pixels - the canvas goes
  // back to the pool at 1x1 on remove.)
  const el = document.createElement('canvas');
  el.width = PER_ROW * FRAME_W;
  el.height = rows * FRAME_H;
  const ctx = el.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  poses.forEach((p, i) => {
    const ox = (i % PER_ROW) * FRAME_W;
    const oy = Math.floor(i / PER_ROW) * FRAME_H;
    drawHero(ctx, ox, oy, p);
  });

  scene.textures.addSpriteSheet(HERO_KEY, el, { frameWidth: FRAME_W, frameHeight: FRAME_H });
}

export function createHeroAnimations(scene) {
  const A = scene.anims;
  const mk = (key, frames, rate, repeat = -1) => {
    if (A.exists(key)) return;
    A.create({
      key,
      frames: frames.map((f) => ({ key: HERO_KEY, frame: f })),
      frameRate: rate,
      repeat
    });
  };

  mk('hero-idle', HERO_FRAMES.idle, 5);
  mk('hero-walk', HERO_FRAMES.walk, 11);
  mk('hero-run', HERO_FRAMES.run, 16);
  mk('hero-jump', HERO_FRAMES.jump, 9, 0);
  mk('hero-fall', HERO_FRAMES.fall, 7);
  mk('hero-land', HERO_FRAMES.land, 14, 0);
  mk('hero-crouch', HERO_FRAMES.crouch, 3);
  mk('hero-hang', HERO_FRAMES.hang, 2);
  mk('hero-climb', HERO_FRAMES.climb, 14, 0);
  mk('hero-wallslide', HERO_FRAMES.wallslide, 6);
  mk('hero-vault', HERO_FRAMES.vault, 15, 0);
  mk('hero-skid', HERO_FRAMES.skid, 1);
  mk('hero-reach', HERO_FRAMES.reach, 1);
  mk('hero-tuck', HERO_FRAMES.tuck, 1);
}
