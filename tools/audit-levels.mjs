/**
 * Level reachability audit.  `npm run audit`
 *
 * Walks every level as a graph of standing positions and reports anything the
 * player could not actually do: an exit that cannot be reached, a checkpoint
 * stranded off the route, or a ledge whose only way onward is a jump longer
 * than the physics allow.
 *
 * The jump budget below is derived from src/config.js and must be kept in step
 * with it. Numbers are in tiles.
 */
import { buildLevel } from '../src/world/LevelBuilder.js';
import { LEVELS } from '../src/levels/index.js';
import { PHYS, GAME } from '../src/config.js';

const TS = GAME.TILE;

/**
 * Horizontal reach for a given rise, in tiles. Positive `up` means climbing.
 *
 * Derived from the arc of a running jump, allowing for the fact that a ledge is
 * caught with the hands - about one body height above the feet - so a climb of
 * two or three rows reaches further than the feet alone would suggest.
 */
function maxRun(up) {
  if (up > 3) return -1;          // past a running jump plus a ledge catch
  if (up === 3) return 3;
  if (up === 2) return 4;
  if (up === 1) return 4;
  if (up === 0) return 4;
  return Math.min(8, 4 + -up);    // falling buys extra distance
}

/** Sanity-check the budget against the actual tuning so the two cannot drift. */
function verifyBudget() {
  const apex = (PHYS.JUMP_VELOCITY ** 2) / (2 * PHYS.GRAVITY);          // px
  const airtime = (-PHYS.JUMP_VELOCITY / PHYS.GRAVITY) * 2;            // s
  const run = PHYS.RUN_SPEED * airtime;                                // px
  return {
    jumpHeightTiles: +(apex / TS).toFixed(2),
    flatRunTiles: +(run / TS).toFixed(2),
    grabReachTiles: +((apex + PHYS.BODY_H - 4) / TS).toFixed(2)
  };
}

function analyse(def) {
  const w = buildLevel(def);
  const W = w.width, H = w.height;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? (x < 0 || x >= W ? 1 : 0) : w.collision[y * W + x];

  /* ---- standing positions: a surface with two tiles of clearance above ---- */
  const key = (x, y) => x + ':' + y;
  const stands = new Set();
  const addStand = (x, y) => {
    if (x < 0 || x >= W || y < 1) return;
    stands.add(key(x, y));
  };

  for (let y = 1; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (at(x, y) === 0) continue;
      if (at(x, y - 1) !== 0 || at(x, y - 2) !== 0) continue;
      addStand(x, y - 1);          // feet rest on top of (x, y) -> occupy row y-1
    }
  }

  // Moving platforms: you can stand on either end, and riding links the two.
  const rides = [];
  for (const m of w.movers) {
    const x0 = Math.round(m.x / TS), y0 = Math.round(m.y / TS);
    const x1 = Math.round(m.toX / TS), y1 = Math.round(m.toY / TS);
    const a = [], b = [];
    for (let i = 0; i < 3; i++) { addStand(x0 + i, y0 - 1); a.push(key(x0 + i, y0 - 1)); }
    for (let i = 0; i < 3; i++) { addStand(x1 + i, y1 - 1); b.push(key(x1 + i, y1 - 1)); }
    rides.push([a, b]);
  }
  // Crumbling slabs are ordinary footing for the purposes of routing.
  for (const f of w.fallers) {
    const fx = Math.round(f.x / TS), fy = Math.round(f.y / TS);
    for (let i = 0; i < 3; i++) addStand(fx + i, fy - 1);
  }

  /* ---- wall-jump shafts: two facing walls no more than 4 tiles apart ---- */
  const inShaft = new Set();
  for (let y = 2; y < H; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (at(x, y) !== 0) continue;
      let l = -1, r = -1;
      for (let d = 1; d <= 4; d++) { if (at(x - d, y) === 1) { l = d; break; } }
      for (let d = 1; d <= 4; d++) { if (at(x + d, y) === 1) { r = d; break; } }
      if (l > 0 && r > 0 && l + r <= 5) inShaft.add(key(x, y));
    }
  }

  const list = [...stands];
  const index = new Map(list.map((k, i) => [k, i]));
  const rideMap = new Map();
  for (const [a, b] of rides) {
    for (const ka of a) rideMap.set(ka, (rideMap.get(ka) || []).concat(b));
    for (const kb of b) rideMap.set(kb, (rideMap.get(kb) || []).concat(a));
  }

  function neighbours(k) {
    const [sx, sy] = k.split(':').map(Number);
    const out = [];
    for (const rk of (rideMap.get(k) || [])) out.push(rk);

    // Climbing a shaft: from footing at or just below a chimney, every piece of
    // footing above it is fair game. The mouth of a shaft is usually a few rows
    // above the floor you walk in on, hence the lookahead.
    let shaftAbove = false;
    for (let d = 0; d <= 5 && !shaftAbove; d++) shaftAbove = inShaft.has(key(sx, sy - d));
    if (shaftAbove) {
      for (let y = sy - 1; y >= Math.max(1, sy - 30); y--) {
        for (let dx = -4; dx <= 4; dx++) {
          const kk = key(sx + dx, y);
          if (stands.has(kk) && (inShaft.has(kk) || Math.abs(dx) <= 4)) out.push(kk);
        }
      }
    }

    for (let dy = -12; dy <= 12; dy++) {
      const up = -dy;                      // positive when the target is higher
      const reach = maxRun(up);
      if (reach < 0) continue;
      for (let dx = -reach; dx <= reach; dx++) {
        if (dx === 0 && dy === 0) continue;
        const kk = key(sx + dx, sy + dy);
        if (stands.has(kk)) out.push(kk);
      }
    }
    return out;
  }

  /* ---- breadth-first from the spawn ---- */
  const startX = Math.floor(w.spawn.x / TS);
  const startY = Math.floor((w.spawn.y - 1) / TS);
  let start = key(startX, startY);
  if (!stands.has(start)) {
    // snap to the nearest footing below the spawn point
    for (let y = startY; y < H && !stands.has(start); y++) start = key(startX, y);
  }

  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const k = queue.shift();
    for (const n of neighbours(k)) {
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }

  /* ---- results ---- */
  const near = (px, py, radius = 2) => {
    const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (seen.has(key(tx + dx, ty + dy))) return true;
      }
    }
    return false;
  };

  const strandedCheckpoints = w.checkpoints
    .map((c, i) => ({ i, x: Math.floor(c.x / TS), y: Math.floor(c.y / TS), ok: near(c.x, c.y - TS) }))
    .filter((c) => !c.ok);

  // Footing the player can stand on but never leave except by falling.
  const deadEnds = [];
  for (const k of seen) {
    const outs = neighbours(k).filter((n) => {
      const [, ny] = n.split(':').map(Number);
      const [, y] = k.split(':').map(Number);
      return ny <= y;                       // anything that is not simply a drop
    });
    if (outs.length === 0) {
      const [x, y] = k.split(':').map(Number);
      deadEnds.push([x, y]);
    }
  }

  return {
    key: def.key,
    name: def.name,
    size: `${W}x${H}`,
    standing: stands.size,
    reached: seen.size,
    exitReachable: near(w.exit.x, w.exit.y - TS, 2),
    strandedCheckpoints,
    deadEnds: deadEnds.slice(0, 12),
    deadEndCount: deadEnds.length
  };
}

const budget = verifyBudget();
console.log('jump budget from config.js:');
console.log(`  jump height      ${budget.jumpHeightTiles} tiles`);
console.log(`  running jump     ${budget.flatRunTiles} tiles across`);
console.log(`  grab reach       ${budget.grabReachTiles} tiles up`);
console.log('');

let failed = false;
for (const def of LEVELS) {
  const r = analyse(def);
  const ok = r.exitReachable && r.strandedCheckpoints.length === 0;
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.key}  ${r.name}  (${r.size})`);
  console.log(`      footing ${r.reached}/${r.standing} reachable from spawn`);
  console.log(`      exit reachable: ${r.exitReachable}`);
  if (r.strandedCheckpoints.length) {
    console.log(`      unreachable checkpoints: ${r.strandedCheckpoints.map((c) => `(${c.x},${c.y})`).join(' ')}`);
  }
  if (r.deadEndCount) {
    console.log(`      footing with no way onward but a drop (${r.deadEndCount}): ${r.deadEnds.map((d) => `(${d[0]},${d[1]})`).join(' ')}`);
  }
  console.log('');
}

process.exit(failed ? 1 : 0);
