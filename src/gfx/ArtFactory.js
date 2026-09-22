import { PALETTES } from '../config.js';

/**
 * Every pixel in the game is generated here at boot: the tile sets, the
 * architectural decor, the parallax layers and the particle dots.
 *
 * Nothing is loaded from disk, which keeps the bundle tiny and the game
 * instant-start. Each generator writes to a well-known texture key, so a real
 * hand-drawn PNG can be dropped into BootScene's loader under the same key and
 * it will be used instead - see README "Replacing the placeholder art".
 */

/* ------------------------------------------------------------ tiny helpers */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl(((n >> 16) & 255) + amt);
  const g = cl(((n >> 8) & 255) + amt);
  const b = cl((n & 255) + amt);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/**
 * Draw on a detached canvas, then hand it to the texture manager on refresh().
 *
 * Phaser's CanvasTexture returns its canvas to the shared pool on remove(),
 * which resizes it to 1x1 - so anything drawn into a managed canvas and then
 * re-registered (e.g. as a sprite sheet) comes back blank. Owning the element
 * ourselves avoids that entirely.
 */
/** Blend two hex colours; t = 0 keeps `a`, t = 1 gives `b`. */
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round((((pa >> sh) & 255) * (1 - t)) + (((pb >> sh) & 255) * t));
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

function canvas(scene, key, w, h) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const ctx = el.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const tex = {
    width: w,
    height: h,
    element: el,
    getSourceImage: () => el,
    getContext: () => ctx,
    refresh() {
      if (scene.textures.exists(key)) scene.textures.remove(key);
      scene.textures.addCanvas(key, el);
    }
  };
  return { tex, ctx, el };
}

/** Same, but registered as a sprite sheet of fixed-size frames. */
function publishSheet(scene, key, el, frameWidth, frameHeight) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addSpriteSheet(key, el, { frameWidth, frameHeight });
}

function fill(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

function speckle(ctx, x, y, w, h, rng, colors, density) {
  for (let i = 0; i < w * h * density; i++) {
    const px = x + Math.floor(rng() * w);
    const py = y + Math.floor(rng() * h);
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    ctx.fillRect(px, py, 1, 1);
  }
}

/* ------------------------------------------------------------- the tileset */

export const T = {
  BLOCK: 0, BLOCK_TOP: 1,
  BRICK: 2, BRICK_TOP: 3,
  RUBBLE: 4, RUBBLE_TOP: 5,
  CRACK: 6, CRACK_TOP: 7,
  COLUMN: 8, COLUMN_CAP: 9,
  ROOF: 10, ROOF_TOP: 11,
  PLATFORM: 12,
  STAIR: 13,
  DEEP: 14,
  TRIM: 15
};
export const TILE_COUNT = 16;
/**
 * Tiles that block from every side. PLATFORM is one-way and handled separately;
 * COLUMN / COLUMN_CAP / TRIM are purely architectural so they can be dropped
 * anywhere - including across a walkway - without trapping the player.
 */
export const SOLID_TILES = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 13, 14];
export const DECOR_TILES = [8, 9, 15];
/** Map a solid tile to its "exposed to sky" variant. */
export const TOP_VARIANT = { 0: 1, 2: 3, 4: 5, 6: 7, 10: 11 };

function drawTopCap(ctx, ox, oy, p) {
  fill(ctx, ox, oy, 16, 1, p.stoneLight);
  fill(ctx, ox, oy + 1, 16, 1, shade(p.stoneLight, -18));
  fill(ctx, ox, oy + 2, 16, 1, shade(p.stone, 14));
}

function tileBlock(ctx, ox, oy, p, rng, top) {
  fill(ctx, ox, oy, 16, 16, p.stone);
  // two courses of masonry with a staggered seam
  fill(ctx, ox, oy + 7, 16, 1, p.stoneShadow);
  fill(ctx, ox, oy + 8, 16, 1, shade(p.stoneDark, 8));
  fill(ctx, ox + 8, oy, 1, 7, p.stoneShadow);
  fill(ctx, ox + 3, oy + 9, 1, 7, p.stoneShadow);
  fill(ctx, ox + 12, oy + 9, 1, 7, p.stoneShadow);
  // soft top-left lighting on each stone
  fill(ctx, ox, oy, 8, 1, shade(p.stone, 16));
  fill(ctx, ox + 9, oy, 7, 1, shade(p.stone, 16));
  fill(ctx, ox, oy + 9, 3, 1, shade(p.stone, 12));
  fill(ctx, ox + 4, oy + 9, 8, 1, shade(p.stone, 12));
  fill(ctx, ox + 13, oy + 9, 3, 1, shade(p.stone, 12));
  speckle(ctx, ox, oy, 16, 16, rng, [p.stoneDark, shade(p.stone, 10), p.stoneShadow], 0.16);
  if (top) drawTopCap(ctx, ox, oy, p);
}

function tileBrick(ctx, ox, oy, p, rng, top) {
  fill(ctx, ox, oy, 16, 16, p.stoneDark);
  for (let row = 0; row < 4; row++) {
    const y = oy + row * 4;
    fill(ctx, ox, y, 16, 3, row % 2 ? shade(p.stoneDark, 10) : p.stoneDark);
    fill(ctx, ox, y + 3, 16, 1, p.stoneShadow);
    const off = row % 2 ? 0 : 8;
    fill(ctx, ox + off, y, 1, 3, p.stoneShadow);
    fill(ctx, ox + ((off + 8) % 16), y, 1, 3, p.stoneShadow);
    fill(ctx, ox, y, 16, 1, shade(p.stoneDark, 14));
  }
  speckle(ctx, ox, oy, 16, 16, rng, [p.stoneShadow, shade(p.stoneDark, 16)], 0.12);
  if (top) drawTopCap(ctx, ox, oy, p);
}

function tileRubble(ctx, ox, oy, p, rng, top) {
  fill(ctx, ox, oy, 16, 16, p.stoneDark);
  for (let i = 0; i < 9; i++) {
    const w = 3 + Math.floor(rng() * 5);
    const h = 3 + Math.floor(rng() * 4);
    const x = ox + Math.floor(rng() * (16 - w));
    const y = oy + Math.floor(rng() * (16 - h));
    fill(ctx, x, y, w, h, rng() > 0.5 ? p.stone : p.stoneShadow);
    fill(ctx, x, y, w, 1, shade(p.stone, 18));
  }
  speckle(ctx, ox, oy, 16, 16, rng, [p.stoneShadow, p.stoneLight], 0.1);
  if (top) drawTopCap(ctx, ox, oy, p);
}

function tileCrack(ctx, ox, oy, p, rng, top) {
  tileBlock(ctx, ox, oy, p, rng, false);
  // a jagged fracture running down the face
  let x = ox + 4 + Math.floor(rng() * 6);
  ctx.fillStyle = p.stoneShadow;
  for (let y = oy; y < oy + 16; y++) {
    ctx.fillRect(x, y, 1, 1);
    if (rng() > 0.55) ctx.fillRect(x + 1, y, 1, 1);
    x += rng() > 0.5 ? 1 : -1;
    x = Math.max(ox + 1, Math.min(ox + 14, x));
  }
  fill(ctx, ox + 11, oy + 3, 3, 1, p.stoneShadow);
  fill(ctx, ox + 2, oy + 11, 3, 1, p.stoneShadow);
  if (top) drawTopCap(ctx, ox, oy, p);
}

function tileColumn(ctx, ox, oy, p, rng, cap) {
  fill(ctx, ox, oy, 16, 16, 'rgba(0,0,0,0)');
  fill(ctx, ox + 2, oy, 12, 16, p.stone);
  fill(ctx, ox + 2, oy, 2, 16, shade(p.stone, 20));
  fill(ctx, ox + 11, oy, 3, 16, p.stoneDark);
  for (let i = 0; i < 4; i++) fill(ctx, ox + 5 + i * 2, oy, 1, 16, shade(p.stone, -10));
  speckle(ctx, ox + 2, oy, 12, 16, rng, [p.stoneDark, p.stoneLight], 0.08);
  if (cap) {
    fill(ctx, ox, oy, 16, 4, p.stoneLight);
    fill(ctx, ox, oy + 4, 16, 1, p.stoneShadow);
    fill(ctx, ox + 1, oy + 1, 14, 1, shade(p.stoneLight, 18));
    fill(ctx, ox + 3, oy + 5, 10, 2, p.stone);
  }
}

/**
 * Roofs only show glazed tile where they meet the sky; the mass underneath is
 * plain rendered stone. Painting the whole block in the accent colour made a
 * four-tile-thick roof read as a solid slab of blue.
 */
function tileRoof(ctx, ox, oy, p, rng, top) {
  if (!top) {
    fill(ctx, ox, oy, 16, 16, shade(p.stoneDark, -10));
    for (let row = 0; row < 3; row++) {
      const y = oy + row * 6;
      fill(ctx, ox, y, 16, 1, shade(p.stoneDark, 6));
      fill(ctx, ox, y + 5, 16, 1, shade(p.stoneShadow, -6));
    }
    speckle(ctx, ox, oy, 16, 16, rng, [p.stoneShadow, shade(p.stoneDark, 10)], 0.14);
    return;
  }

  const glaze = mix(p.accent, p.stoneDark, 0.45);
  fill(ctx, ox, oy, 16, 16, shade(p.stoneDark, -10));
  for (let row = 0; row < 3; row++) {
    const y = oy + 4 + row * 4;
    for (let c = 0; c < 4; c++) {
      const x = ox + c * 4 + (row % 2 ? 2 : 0);
      const c2 = rng() > 0.72 ? shade(glaze, -14) : glaze;
      fill(ctx, x, y, 4, 4, c2);
      fill(ctx, x, y, 4, 1, shade(c2, 16));
      fill(ctx, x + 3, y, 1, 4, shade(c2, -24));
    }
  }
  // ridge cap
  fill(ctx, ox, oy, 16, 2, shade(p.gold, -26));
  fill(ctx, ox, oy, 16, 1, p.gold);
  fill(ctx, ox, oy + 2, 16, 2, shade(glaze, 20));
  speckle(ctx, ox, oy + 4, 16, 12, rng, [shade(glaze, -28)], 0.1);
}

function tilePlatform(ctx, ox, oy, p, rng) {
  fill(ctx, ox, oy, 16, 5, p.stoneLight);
  fill(ctx, ox, oy, 16, 1, shade(p.stoneLight, 22));
  fill(ctx, ox, oy + 4, 16, 1, p.stoneShadow);
  fill(ctx, ox + 1, oy + 5, 14, 1, shade(p.stoneDark, -10));
  for (let i = 0; i < 3; i++) fill(ctx, ox + 3 + i * 5, oy + 5, 2, 2, p.stoneShadow);
  speckle(ctx, ox, oy, 16, 4, rng, [p.stone, shade(p.stoneLight, 14)], 0.2);
}

function tileStair(ctx, ox, oy, p, rng) {
  fill(ctx, ox, oy, 16, 16, p.stone);
  fill(ctx, ox, oy, 16, 3, p.stoneLight);
  fill(ctx, ox, oy + 3, 16, 1, p.stoneShadow);
  fill(ctx, ox, oy + 8, 16, 3, shade(p.stone, 12));
  fill(ctx, ox, oy + 11, 16, 1, p.stoneShadow);
  speckle(ctx, ox, oy, 16, 16, rng, [p.stoneDark, p.stoneLight], 0.1);
}

function tileDeep(ctx, ox, oy, p, rng) {
  fill(ctx, ox, oy, 16, 16, p.stoneShadow);
  speckle(ctx, ox, oy, 16, 16, rng, [shade(p.stoneShadow, -10), shade(p.stoneShadow, 10)], 0.2);
}

function tileTrim(ctx, ox, oy, p, rng) {
  fill(ctx, ox, oy, 16, 16, p.stoneDark);
  fill(ctx, ox, oy + 4, 16, 8, p.accent);
  // interlocking diamond band - a generic geometric motif
  ctx.fillStyle = p.gold;
  for (let i = 0; i < 2; i++) {
    const cx = ox + 4 + i * 8;
    for (let d = 0; d < 4; d++) {
      ctx.fillRect(cx - d, oy + 8 - d, 1, 1);
      ctx.fillRect(cx + d, oy + 8 - d, 1, 1);
      ctx.fillRect(cx - d, oy + 8 + d, 1, 1);
      ctx.fillRect(cx + d, oy + 8 + d, 1, 1);
    }
  }
  fill(ctx, ox, oy + 3, 16, 1, p.gold);
  fill(ctx, ox, oy + 12, 16, 1, p.gold);
  speckle(ctx, ox, oy, 16, 3, rng, [p.stoneShadow], 0.2);
  speckle(ctx, ox, oy + 13, 16, 3, rng, [p.stoneShadow], 0.2);
}

export function createTileset(scene, palKey) {
  const key = 'tiles-' + palKey;
  if (scene.textures.exists(key)) return key;
  const p = PALETTES[palKey];
  const rng = mulberry32(0x5eed + palKey.length * 977);
  const { tex, ctx } = canvas(scene, key, TILE_COUNT * 16, 16);

  tileBlock(ctx, T.BLOCK * 16, 0, p, rng, false);
  tileBlock(ctx, T.BLOCK_TOP * 16, 0, p, rng, true);
  tileBrick(ctx, T.BRICK * 16, 0, p, rng, false);
  tileBrick(ctx, T.BRICK_TOP * 16, 0, p, rng, true);
  tileRubble(ctx, T.RUBBLE * 16, 0, p, rng, false);
  tileRubble(ctx, T.RUBBLE_TOP * 16, 0, p, rng, true);
  tileCrack(ctx, T.CRACK * 16, 0, p, rng, false);
  tileCrack(ctx, T.CRACK_TOP * 16, 0, p, rng, true);
  tileColumn(ctx, T.COLUMN * 16, 0, p, rng, false);
  tileColumn(ctx, T.COLUMN_CAP * 16, 0, p, rng, true);
  tileRoof(ctx, T.ROOF * 16, 0, p, rng, false);
  tileRoof(ctx, T.ROOF_TOP * 16, 0, p, rng, true);
  tilePlatform(ctx, T.PLATFORM * 16, 0, p, rng);
  tileStair(ctx, T.STAIR * 16, 0, p, rng);
  tileDeep(ctx, T.DEEP * 16, 0, p, rng);
  tileTrim(ctx, T.TRIM * 16, 0, p, rng);

  tex.refresh();
  return key;
}

/* ------------------------------------------------------------------ decor */

function decorArch(scene, palKey, p, rng) {
  const { tex, ctx } = canvas(scene, `arch-${palKey}`, 64, 56);
  const voidTop = '#100b14';
  const voidLow = shade(p.stoneShadow, -46);

  // The opening: near-black at the crown, a touch warmer at the floor so it
  // reads as depth rather than a painted shape.
  const arc = (cy, r, drawRow) => {
    for (let y = 0; y <= r; y++) {
      const w = Math.round(Math.sqrt(Math.max(0, 1 - (y / r) ** 2)) * r);
      drawRow(cy - y, w);
    }
  };
  fill(ctx, 32 - 22, 22, 44, 34, voidTop);
  arc(22, 22, (yy, w) => fill(ctx, 32 - w, yy, w * 2, 1, voidTop));
  for (let y = 40; y < 56; y++) {
    fill(ctx, 10, y, 44, 1, y > 50 ? voidLow : shade(voidTop, (y - 40) * 2));
  }

  // Stone frame around the opening.
  arc(24, 24, (yy, w) => {
    fill(ctx, 32 - w, yy, 3, 1, p.stone);
    fill(ctx, 32 + w - 3, yy, 3, 1, p.stoneDark);
    if (yy < 6) fill(ctx, 32 - w + 3, yy, (w - 3) * 2, 1, p.stoneDark);
  });
  fill(ctx, 5, 24, 5, 32, p.stone);
  fill(ctx, 54, 24, 5, 32, p.stoneDark);
  fill(ctx, 5, 24, 2, 32, shade(p.stone, 18));
  fill(ctx, 57, 24, 2, 32, p.stoneShadow);
  // keystone
  fill(ctx, 29, 0, 6, 5, p.gold);
  fill(ctx, 30, 1, 4, 3, shade(p.gold, 30));
  speckle(ctx, 5, 24, 5, 32, rng, [p.stoneShadow, shade(p.stone, 14)], 0.12);
  speckle(ctx, 54, 24, 5, 32, rng, [p.stoneShadow, shade(p.stone, 14)], 0.12);
  tex.refresh();
}

function decorWindow(scene, palKey, p, rng) {
  const { tex, ctx } = canvas(scene, `window-${palKey}`, 24, 34);
  fill(ctx, 0, 6, 24, 28, p.stoneDark);
  fill(ctx, 3, 8, 18, 24, '#140e18');
  for (let y = 0; y < 9; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, 1 - (y / 9) ** 2)) * 9);
    fill(ctx, 12 - w, 8 - y, w * 2, 1, '#140e18');
    fill(ctx, 12 - w - 2, 8 - y, 2, 1, p.stoneDark);
    fill(ctx, 12 + w, 8 - y, 2, 1, p.stoneDark);
  }
  // lattice
  ctx.fillStyle = p.gold;
  for (let x = 5; x < 20; x += 4) ctx.fillRect(x, 0, 1, 32);
  for (let y = 2; y < 32; y += 4) ctx.fillRect(3, y, 18, 1);
  fill(ctx, 0, 30, 24, 4, p.stone);
  fill(ctx, 0, 30, 24, 1, p.stoneLight);
  speckle(ctx, 0, 0, 24, 34, rng, [p.stoneShadow], 0.04);
  tex.refresh();
}

function decorBanner(scene, palKey, p, rng) {
  const { tex, ctx } = canvas(scene, `banner-${palKey}`, 14, 48);
  fill(ctx, 1, 0, 12, 3, p.stoneDark);
  fill(ctx, 2, 3, 10, 40, p.accent2);
  fill(ctx, 2, 3, 3, 40, shade(p.accent2, 24));
  fill(ctx, 10, 3, 2, 40, shade(p.accent2, -28));
  // fringed hem
  for (let x = 2; x < 12; x += 2) fill(ctx, x, 43, 1, 3, p.gold);
  fill(ctx, 2, 41, 10, 2, p.gold);
  // emblem: a stylised sun-disc, original motif
  ctx.fillStyle = p.gold;
  for (let a = 0; a < 8; a++) {
    const r = a * Math.PI / 4;
    ctx.fillRect(7 + Math.round(Math.sin(r) * 3), 16 + Math.round(Math.cos(r) * 3), 1, 1);
  }
  fill(ctx, 6, 15, 3, 3, p.gold);
  fill(ctx, 5, 26, 5, 1, p.gold);
  speckle(ctx, 2, 3, 10, 40, rng, [shade(p.accent2, -18)], 0.06);
  tex.refresh();
}

function decorCurtain(scene, palKey, p, rng) {
  const { tex, ctx } = canvas(scene, `curtain-${palKey}`, 28, 72);
  fill(ctx, 0, 0, 28, 3, p.stoneDark);
  for (let x = 0; x < 28; x++) {
    const fold = Math.sin(x * 0.9) * 0.5 + 0.5;
    const c = fold > 0.66 ? shade(p.accent, 26) : fold > 0.33 ? p.accent : shade(p.accent, -30);
    const h = 60 + Math.round(Math.sin(x * 0.35) * 8);
    fill(ctx, x, 3, 1, h, c);
  }
  fill(ctx, 0, 3, 28, 1, shade(p.accent, 34));
  for (let x = 2; x < 28; x += 6) fill(ctx, x, 30, 2, 1, p.gold);
  speckle(ctx, 0, 3, 28, 64, rng, [shade(p.accent, -34)], 0.05);
  tex.refresh();
}

function decorCloth(scene, palKey, p, rng) {
  const { tex, ctx } = canvas(scene, `cloth-${palKey}`, 12, 40);
  for (let y = 0; y < 38; y++) {
    const w = 8 - Math.round(y / 12);
    const x = 2 + Math.round(Math.sin(y * 0.22) * 1.5);
    fill(ctx, x, y, w, 1, y % 5 === 0 ? shade(p.accent2, -22) : p.accent2);
    fill(ctx, x, y, 2, 1, shade(p.accent2, 20));
  }
  // torn hem
  for (let x = 0; x < 12; x++) if (rng() > 0.5) fill(ctx, x, 37, 1, 2, p.accent2);
  speckle(ctx, 0, 0, 12, 40, rng, [shade(p.accent2, -30)], 0.06);
  tex.refresh();
}

function decorRug(scene, palKey, p, rng) {
  const { tex, ctx } = canvas(scene, `rug-${palKey}`, 64, 7);
  fill(ctx, 2, 1, 60, 5, p.accent2);
  fill(ctx, 2, 1, 60, 1, shade(p.accent2, 26));
  fill(ctx, 0, 2, 2, 3, p.gold);
  fill(ctx, 62, 2, 2, 3, p.gold);
  ctx.fillStyle = p.gold;
  for (let x = 6; x < 58; x += 6) {
    ctx.fillRect(x, 3, 1, 1);
    ctx.fillRect(x - 1, 2, 3, 1);
    ctx.fillRect(x - 1, 4, 3, 1);
  }
  speckle(ctx, 2, 1, 60, 5, rng, [shade(p.accent2, -26)], 0.08);
  tex.refresh();
}

function decorRubblePile(scene, palKey, p, rng) {
  const { tex, ctx } = canvas(scene, `rubblepile-${palKey}`, 40, 14);
  for (let i = 0; i < 16; i++) {
    const w = 3 + Math.floor(rng() * 6);
    const h = 2 + Math.floor(rng() * 5);
    const x = Math.floor(rng() * (40 - w));
    const y = 14 - h - Math.floor(rng() * 5);
    fill(ctx, x, y, w, h, rng() > 0.5 ? p.stone : p.stoneDark);
    fill(ctx, x, y, w, 1, p.stoneLight);
  }
  tex.refresh();
}

function decorTorch(scene, palKey, p) {
  // 3 flame frames side by side, 12x24 each
  const { tex, ctx } = canvas(scene, `torch-${palKey}`, 36, 24);
  const rng = mulberry32(99);
  for (let f = 0; f < 3; f++) {
    const ox = f * 12;
    // bracket + shaft
    fill(ctx, ox + 4, 12, 4, 11, '#4a3322');
    fill(ctx, ox + 4, 12, 1, 11, '#6b4a30');
    fill(ctx, ox + 3, 11, 6, 2, '#2f2318');
    // flame
    const h = [8, 10, 9][f];
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const w = Math.max(1, Math.round((1 - t) * 4 + (f === 1 ? 1 : 0)));
      const wob = Math.round(Math.sin((y + f * 2) * 0.9) * 1.2);
      const c = t < 0.28 ? '#fff0b8' : t < 0.6 ? '#f7b23c' : '#d9541f';
      fill(ctx, ox + 6 - w + wob, 12 - y, w * 2, 1, c);
    }
    fill(ctx, ox + 5, 11, 2, 2, '#fff6d0');
    speckle(ctx, ox, 0, 12, 24, rng, ['#f7b23c'], 0.01);
  }
  publishSheet(scene, `torch-${palKey}`, tex.element, 12, 24);
}

function decorDoor(scene, palKey, p, rng) {
  const { tex, ctx } = canvas(scene, `door-${palKey}`, 48, 72);
  // outer frame
  fill(ctx, 0, 14, 48, 58, p.stone);
  for (let y = 0; y < 16; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, 1 - (y / 16) ** 2)) * 24);
    fill(ctx, 24 - w, 15 - y, w * 2, 1, p.stone);
  }
  // inner opening
  fill(ctx, 7, 18, 34, 54, '#120d18');
  for (let y = 0; y < 13; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, 1 - (y / 13) ** 2)) * 17);
    fill(ctx, 24 - w, 18 - y, w * 2, 1, '#120d18');
  }
  // gold trim + keystone
  ctx.fillStyle = p.gold;
  for (let y = 0; y < 14; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, 1 - (y / 14) ** 2)) * 18);
    ctx.fillRect(24 - w, 18 - y, 1, 1);
    ctx.fillRect(24 + w - 1, 18 - y, 1, 1);
  }
  fill(ctx, 5, 18, 2, 54, p.gold);
  fill(ctx, 41, 18, 2, 54, p.gold);
  fill(ctx, 21, 1, 6, 6, p.gold);
  fill(ctx, 0, 12, 48, 3, p.stoneLight);
  fill(ctx, 0, 68, 48, 4, p.stoneDark);
  speckle(ctx, 0, 12, 48, 60, rng, [p.stoneShadow, p.stoneLight], 0.04);
  tex.refresh();
}

function decorCheckpoint(scene, palKey, p) {
  // 2 frames: dormant, lit
  const { tex, ctx } = canvas(scene, `brazier-${palKey}`, 40, 28);
  for (let f = 0; f < 2; f++) {
    const ox = f * 20;
    fill(ctx, ox + 8, 20, 4, 8, p.stoneDark);
    fill(ctx, ox + 5, 26, 10, 2, p.stone);
    fill(ctx, ox + 4, 14, 12, 6, p.stone);
    fill(ctx, ox + 4, 14, 12, 1, p.stoneLight);
    fill(ctx, ox + 4, 19, 12, 1, p.stoneShadow);
    if (f === 1) {
      fill(ctx, ox + 6, 12, 8, 3, '#d9541f');
      for (let y = 0; y < 10; y++) {
        const t = y / 10;
        const w = Math.max(1, Math.round((1 - t) * 4));
        const c = t < 0.3 ? '#fff0b8' : t < 0.65 ? '#f7b23c' : '#d9541f';
        fill(ctx, ox + 10 - w, 13 - y, w * 2, 1, c);
      }
    } else {
      fill(ctx, ox + 6, 13, 8, 2, '#3a3038');
    }
  }
  publishSheet(scene, `brazier-${palKey}`, tex.element, 20, 28);
}

function decorPlatforms(scene, palKey, p, rng) {
  // Moving platform: a carved slab with chain eyelets
  {
    const { tex, ctx } = canvas(scene, `mover-${palKey}`, 48, 14);
    fill(ctx, 0, 2, 48, 9, p.stone);
    fill(ctx, 0, 2, 48, 1, p.stoneLight);
    fill(ctx, 0, 10, 48, 2, p.stoneShadow);
    fill(ctx, 0, 0, 48, 2, p.stoneDark);
    for (let x = 4; x < 46; x += 8) fill(ctx, x, 4, 4, 1, p.gold);
    fill(ctx, 2, 0, 3, 3, p.gold);
    fill(ctx, 43, 0, 3, 3, p.gold);
    speckle(ctx, 0, 2, 48, 9, rng, [p.stoneDark, p.stoneLight], 0.1);
    tex.refresh();
  }
  // Falling platform: cracked, obviously fragile
  {
    const { tex, ctx } = canvas(scene, `faller-${palKey}`, 48, 12);
    fill(ctx, 0, 0, 48, 10, p.stoneDark);
    fill(ctx, 0, 0, 48, 1, p.stoneLight);
    fill(ctx, 0, 9, 48, 2, shade(p.stoneShadow, -12));
    ctx.fillStyle = p.stoneShadow;
    for (let i = 0; i < 4; i++) {
      let x = 6 + i * 11;
      for (let y = 1; y < 9; y++) { ctx.fillRect(x, y, 1, 1); x += rng() > 0.5 ? 1 : -1; }
    }
    speckle(ctx, 0, 0, 48, 10, rng, [p.stoneShadow, p.stone], 0.14);
    tex.refresh();
  }
}

/* ------------------------------------------------------------- parallax */

function bgSky(scene, palKey, p) {
  const { tex, ctx } = canvas(scene, `sky-${palKey}`, 480, 270);
  const g = ctx.createLinearGradient(0, 0, 0, 270);
  g.addColorStop(0, p.sky[0]);
  g.addColorStop(0.42, p.sky[1]);
  g.addColorStop(0.74, p.sky[2]);
  g.addColorStop(1, p.sky[3]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 480, 270);

  const rng = mulberry32(palKey.length * 4001 + 7);
  if (palKey !== 'sand') {
    ctx.fillStyle = 'rgba(255,255,235,0.75)';
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(rng() * 480), y = Math.floor(rng() * 150);
      ctx.globalAlpha = 0.25 + rng() * 0.7;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
    // a pale moon
    ctx.fillStyle = 'rgba(240,235,210,0.9)';
    for (let y = -11; y <= 11; y++) {
      const w = Math.round(Math.sqrt(Math.max(0, 121 - y * y)));
      ctx.fillRect(392 - w, 46 + y, w * 2, 1);
    }
    ctx.fillStyle = p.sky[0];
    for (let y = -11; y <= 11; y++) {
      const w = Math.round(Math.sqrt(Math.max(0, 121 - y * y)));
      ctx.fillRect(386 - w, 42 + y, w * 2, 1);
    }
  } else {
    // low morning sun with soft banding
    for (let r = 26; r > 0; r -= 2) {
      ctx.fillStyle = `rgba(255,232,180,${0.05 + (26 - r) * 0.012})`;
      for (let y = -r; y <= r; y++) {
        const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
        ctx.fillRect(360 - w, 150 + y, w * 2, 1);
      }
    }
  }
  tex.refresh();
}

function bgFar(scene, palKey, p) {
  // Distant mountains + a hazy skyline of domes and towers.
  const { tex, ctx } = canvas(scene, `far-${palKey}`, 512, 180);
  const rng = mulberry32(palKey.length * 613 + 31);
  ctx.fillStyle = p.far;
  let y = 96;
  for (let x = 0; x < 512; x++) {
    y += (rng() - 0.5) * 6;
    y += (110 - y) * 0.04;
    y = Math.max(52, Math.min(126, y));
    ctx.fillRect(x, Math.round(y), 1, 180 - Math.round(y));
  }
  // silhouetted skyline
  ctx.fillStyle = shade(p.far, -16);
  for (let i = 0; i < 9; i++) {
    const bx = Math.floor(rng() * 500);
    const bw = 18 + Math.floor(rng() * 34);
    const bh = 26 + Math.floor(rng() * 44);
    const by = 150 - bh;
    ctx.fillRect(bx, by, bw, bh);
    // dome
    const cx = bx + (bw >> 1);
    const r = Math.max(5, bw >> 2);
    for (let dy = 0; dy <= r; dy++) {
      const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
      ctx.fillRect(cx - w, by - dy, w * 2, 1);
    }
    ctx.fillRect(cx, by - r - 5, 1, 5);
    // flanking towers
    if (rng() > 0.45) {
      ctx.fillRect(bx - 5, by + 6, 5, bh - 6);
      ctx.fillRect(bx + bw, by + 10, 5, bh - 10);
    }
  }
  ctx.fillStyle = shade(p.far, 22);
  for (let x = 0; x < 512; x += 2) ctx.fillRect(x, 148, 2, 1);
  tex.refresh();
}

function bgMid(scene, palKey, p) {
  // Nearer palace wall: arcade of arches, windows and hanging cloth.
  const { tex, ctx } = canvas(scene, `mid-${palKey}`, 512, 220);
  const rng = mulberry32(palKey.length * 271 + 5);
  ctx.fillStyle = p.mid;
  ctx.fillRect(0, 44, 512, 176);
  fill(ctx, 0, 44, 512, 3, shade(p.mid, 26));

  for (let i = 0; i < 8; i++) {
    const x = i * 64;
    // pier
    fill(ctx, x, 44, 10, 176, shade(p.mid, 16));
    fill(ctx, x, 44, 3, 176, shade(p.mid, 30));
    // arch void
    const cx = x + 36, top = 86, r = 22;
    ctx.fillStyle = shade(p.mid, -26);
    ctx.fillRect(cx - r, top, r * 2, 134);
    for (let dy = 0; dy <= r; dy++) {
      const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
      ctx.fillRect(cx - w, top - dy, w * 2, 1);
    }
    // rail
    fill(ctx, cx - r, 170, r * 2, 4, shade(p.mid, 20));
    for (let b = 0; b < 7; b++) fill(ctx, cx - r + 2 + b * 6, 174, 2, 14, shade(p.mid, 12));
    if (rng() > 0.5) {
      // hanging banner deep in the arcade
      fill(ctx, cx - 3, top + 6, 6, 34, shade(p.accent2, -50));
      fill(ctx, cx - 1, top + 20, 2, 2, shade(p.gold, -40));
    }
  }
  // roofline
  fill(ctx, 0, 40, 512, 5, shade(p.mid, 34));
  for (let x = 0; x < 512; x += 16) fill(ctx, x, 34, 8, 6, shade(p.mid, 24));
  tex.refresh();
}

/* --------------------------------------------------------- misc textures */

function particleTextures(scene) {
  if (!scene.textures.exists('p-dot')) {
    const { tex, ctx } = canvas(scene, 'p-dot', 2, 2);
    fill(ctx, 0, 0, 2, 2, '#ffffff');
    tex.refresh();
  }
  if (!scene.textures.exists('p-puff')) {
    const { tex, ctx } = canvas(scene, 'p-puff', 5, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(1, 0, 3, 5);
    ctx.fillRect(0, 1, 5, 3);
    tex.refresh();
  }
  if (!scene.textures.exists('p-pixel')) {
    const { tex, ctx } = canvas(scene, 'p-pixel', 1, 1);
    fill(ctx, 0, 0, 1, 1, '#ffffff');
    tex.refresh();
  }
}

/** A soft top-to-bottom darkening used to make pits read as bottomless. */
function chasmTexture(scene) {
  if (scene.textures.exists('chasm')) return;
  const { tex, ctx } = canvas(scene, 'chasm', 8, 128);
  for (let y = 0; y < 128; y++) {
    const t = y / 127;
    ctx.fillStyle = `rgba(9,7,14,${Math.min(1, t * 2.1)})`;
    ctx.fillRect(0, y, 8, 1);
  }
  tex.refresh();
}

function uiTextures(scene) {
  if (!scene.textures.exists('ui-glow')) {
    const { tex, ctx } = canvas(scene, 'ui-glow', 64, 64);
    for (let r = 32; r > 0; r--) {
      ctx.fillStyle = `rgba(255,220,150,${(1 - r / 32) ** 2 * 0.09})`;
      for (let y = -r; y <= r; y++) {
        const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
        ctx.fillRect(32 - w, 32 + y, w * 2, 1);
      }
    }
    tex.refresh();
  }
  if (!scene.textures.exists('ui-crest')) {
    // Title crest: an original sun-and-arch emblem
    const { tex, ctx } = canvas(scene, 'ui-crest', 64, 40);
    ctx.fillStyle = '#e8bc5a';
    for (let y = 0; y < 18; y++) {
      const w = Math.round(Math.sqrt(Math.max(0, 1 - (y / 18) ** 2)) * 20);
      ctx.fillRect(32 - w, 26 - y, 1, 1);
      ctx.fillRect(32 + w - 1, 26 - y, 1, 1);
    }
    ctx.fillRect(12, 26, 1, 12);
    ctx.fillRect(51, 26, 1, 12);
    ctx.fillRect(10, 37, 44, 2);
    for (let a = 0; a < 12; a++) {
      const r = a * Math.PI / 6;
      ctx.fillRect(32 + Math.round(Math.sin(r) * 9), 18 + Math.round(Math.cos(r) * 9), 2, 2);
    }
    ctx.fillStyle = '#f6e0a4';
    ctx.fillRect(29, 15, 6, 6);
    tex.refresh();
  }
}

/* ------------------------------------------------------------------ entry */

export function generateAll(scene, onStep) {
  const keys = Object.keys(PALETTES);
  particleTextures(scene);
  uiTextures(scene);
  chasmTexture(scene);
  onStep && onStep();

  keys.forEach((palKey) => {
    const p = PALETTES[palKey];
    const rng = mulberry32(palKey.length * 1237 + 17);
    createTileset(scene, palKey);
    decorArch(scene, palKey, p, rng);
    decorWindow(scene, palKey, p, rng);
    decorBanner(scene, palKey, p, rng);
    decorCurtain(scene, palKey, p, rng);
    decorCloth(scene, palKey, p, rng);
    decorRug(scene, palKey, p, rng);
    decorRubblePile(scene, palKey, p, rng);
    decorTorch(scene, palKey, p);
    decorDoor(scene, palKey, p, rng);
    decorCheckpoint(scene, palKey, p);
    decorPlatforms(scene, palKey, p, rng);
    bgSky(scene, palKey, p);
    bgFar(scene, palKey, p);
    bgMid(scene, palKey, p);
    onStep && onStep();
  });
}
