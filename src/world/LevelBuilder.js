import { T, TOP_VARIANT, SOLID_TILES } from '../gfx/ArtFactory.js';
import { GAME } from '../config.js';

const TS = GAME.TILE;
const SOLID_SET = new Set(SOLID_TILES);

/**
 * Levels are authored as code against this builder rather than as huge ASCII
 * blobs: it keeps each level file short, makes every jump distance explicit,
 * and lets us assert things like "this platform is reachable" in one place.
 *
 * Everything is in TILE coordinates. y grows downward; `row` is the top surface
 * of a floor, so `ground(4, 26, 10)` puts walkable stone at y = 26 * 16.
 */
export default class LevelBuilder {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.grid = new Int16Array(width * height).fill(-1);
    this.decorBack = [];   // behind the tile layer
    this.decorFront = [];  // in front of the tile layer
    this.torches = [];
    this.checkpoints = [];
    this.movers = [];
    this.fallers = [];
    this.hints = [];
    this.spawn = { x: 3, y: 10 };
    this.exit = { x: 10, y: 10 };
  }

  /* ------------------------------------------------------------ geometry */

  idx(x, y) { return y * this.width + x; }

  inside(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  set(x, y, tile) {
    if (!this.inside(x, y)) return this;
    this.grid[this.idx(x, y)] = tile;
    return this;
  }

  get(x, y) {
    if (!this.inside(x, y)) return -1;
    return this.grid[this.idx(x, y)];
  }

  /** Solid rectangle. */
  box(x, y, w, h, tile = T.BLOCK) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, tile);
    return this;
  }

  /** Walkable surface at row `y`, filled downward to the bottom of the map. */
  ground(x, y, w, tile = T.BLOCK) {
    return this.box(x, y, w, this.height - y, tile);
  }

  /** A floating slab: solid, `h` tiles thick (default 2). */
  ledge(x, y, w, h = 2, tile = T.BLOCK) {
    return this.box(x, y, w, h, tile);
  }

  /** One-way platform the player can jump up through and drop down from. */
  plat(x, y, w) {
    for (let i = 0; i < w; i++) this.set(x + i, y, T.PLATFORM);
    return this;
  }

  /** Staircase of `n` steps. dir +1 climbs to the right, -1 to the left. */
  stairs(x, y, n, dir = 1, tile = T.STAIR) {
    for (let i = 0; i < n; i++) {
      const sx = x + i * dir;
      const sy = y - i;
      this.box(sx, sy, 1, this.height - sy, tile);
    }
    return this;
  }

  /**
   * Write a non-colliding decoration, but never over existing collision
   * geometry - a column dropped across a floor would otherwise replace solid
   * tiles with pass-through ones and open a hole the player falls into.
   */
  decorTile(x, y, tile) {
    const cur = this.get(x, y);
    if (cur >= 0 && SOLID_SET.has(cur)) return this;
    return this.set(x, y, tile);
  }

  /** Purely architectural column from `y` down `h` tiles, with a capital. */
  column(x, y, h) {
    this.decorTile(x, y, T.COLUMN_CAP);
    for (let j = 1; j < h; j++) this.decorTile(x, y + j, T.COLUMN);
    return this;
  }

  /** Decorative frieze band. */
  trim(x, y, w) {
    for (let i = 0; i < w; i++) this.decorTile(x + i, y, T.TRIM);
    return this;
  }

  /* --------------------------------------------------------------- decor */

  /** Background prop. x/y in TILES, offsets in pixels. */
  back(tex, x, y, opt = {}) {
    this.decorBack.push(Object.assign({ tex, x: x * TS, y: y * TS, originX: 0.5, originY: 1, alpha: 1, scrollFactor: 1, tint: null, flip: false }, opt));
    return this;
  }

  front(tex, x, y, opt = {}) {
    this.decorFront.push(Object.assign({ tex, x: x * TS, y: y * TS, originX: 0.5, originY: 1, alpha: 1, scrollFactor: 1, tint: null, flip: false }, opt));
    return this;
  }

  arch(x, y) { return this.back('arch', x, y, { originY: 1 }); }
  window(x, y) { return this.back('window', x, y); }
  banner(x, y) { return this.back('banner', x, y, { originY: 0 }); }
  curtain(x, y) { return this.back('curtain', x, y, { originY: 0 }); }
  cloth(x, y) { return this.back('cloth', x, y, { originY: 0 }); }
  rug(x, y) { return this.front('rug', x, y); }
  rubble(x, y) { return this.front('rubblepile', x, y); }

  torch(x, y) {
    this.torches.push({ x: x * TS + TS / 2, y: y * TS });
    return this;
  }

  /** On-screen coaching text that fades in when the player gets close. */
  hint(x, y, text) {
    this.hints.push({ x: x * TS, y: y * TS, text });
    return this;
  }

  /* ------------------------------------------------------------ entities */

  checkpoint(x, y) {
    this.checkpoints.push({ x: x * TS + TS / 2, y: y * TS + TS });
    return this;
  }

  /**
   * Moving platform. `to` is the far end in tiles; the slab eases between the
   * two points forever. `w` is width in tiles (visual slab is 48px = 3 tiles).
   */
  mover(x, y, toX, toY, speed = 34, w = 3) {
    this.movers.push({ x: x * TS, y: y * TS, toX: toX * TS, toY: toY * TS, speed, w });
    return this;
  }

  /** Crumbling slab: shakes on contact, drops, then respawns. */
  faller(x, y, w = 3) {
    this.fallers.push({ x: x * TS, y: y * TS, w });
    return this;
  }

  at(x, y) { this.spawn = { x, y }; return this; }
  door(x, y) { this.exit = { x, y }; return this; }

  /* ------------------------------------------------------------ finalize */

  /**
   * Swaps every sky-exposed solid tile for its "capped" variant and produces the
   * collision grid the player controller queries for ledges and walls.
   *  0 = air, 1 = full solid, 2 = one-way platform
   */
  finalize() {
    const solidSet = new Set(SOLID_TILES);
    const collision = new Uint8Array(this.width * this.height);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.get(x, y);
        if (t < 0) continue;
        if (t === T.PLATFORM) { collision[this.idx(x, y)] = 2; continue; }
        if (!solidSet.has(t)) continue;
        collision[this.idx(x, y)] = 1;
        const above = this.get(x, y - 1);
        const exposed = above < 0 || above === T.PLATFORM;
        if (exposed && TOP_VARIANT[t] !== undefined) this.set(x, y, TOP_VARIANT[t]);
      }
    }

    // Phaser's tilemap data wants a plain 2D array of indices (-1 = empty).
    const data = [];
    for (let y = 0; y < this.height; y++) {
      const row = new Array(this.width);
      for (let x = 0; x < this.width; x++) row[x] = this.get(x, y);
      data.push(row);
    }

    return {
      width: this.width,
      height: this.height,
      pixelWidth: this.width * TS,
      pixelHeight: this.height * TS,
      data,
      collision,
      decorBack: this.decorBack,
      decorFront: this.decorFront,
      torches: this.torches,
      checkpoints: this.checkpoints,
      movers: this.movers,
      fallers: this.fallers,
      hints: this.hints,
      spawn: { x: this.spawn.x * TS + TS / 2, y: this.spawn.y * TS + TS },
      exit: { x: this.exit.x * TS + TS / 2, y: this.exit.y * TS + TS }
    };
  }
}

export function buildLevel(def) {
  const b = new LevelBuilder(def.width, def.height);
  def.build(b, T);
  const world = b.finalize();
  world.key = def.key;
  world.name = def.name;
  world.subtitle = def.subtitle;
  world.palette = def.palette;
  world.deathY = def.deathY * TS;
  world.teaches = def.teaches || [];
  return world;
}
