/**
 * Global tuning values. Everything that affects "game feel" lives here so it can
 * be adjusted in one place without hunting through the controller.
 */

export const GAME = {
  TITLE: 'CROWNFALL',
  WIDTH: 480,
  HEIGHT: 270,
  TILE: 16,
  SAVE_KEY: 'crownfall.save.v1',
  // progress written under the game's previous name, migrated once on load
  LEGACY_SAVE_KEY: 'silent-palace.save.v1'
};

export const PHYS = {
  GRAVITY: 900,
  MAX_FALL: 430,

  WALK_SPEED: 68,
  RUN_SPEED: 138,
  CROUCH_SPEED: 34,

  ACCEL_GROUND: 900,
  ACCEL_AIR: 520,
  FRICTION_GROUND: 1150,
  FRICTION_AIR: 160,
  TURN_BOOST: 1.9,          // extra accel when reversing direction

  JUMP_VELOCITY: -252,
  JUMP_CUT: 0.42,           // velocity multiplier when jump released early
  COYOTE_TIME: 0.10,
  JUMP_BUFFER: 0.13,

  WALL_SLIDE_SPEED: 62,
  WALL_JUMP_X: 172,
  WALL_JUMP_Y: -238,
  WALL_JUMP_LOCK: 0.19,     // seconds of reduced horizontal control
  WALL_STICK: 0.09,         // grace period to still wall-jump after leaving a wall

  LEDGE_COOLDOWN: 0.28,     // after dropping from a ledge, ignore grabs
  LEDGE_HANG_OFFSET: 3,     // body.top sits this far below the ledge surface
  CLIMB_TIME: 430,          // ms
  VAULT_TIME: 260,          // ms
  VAULT_MIN_SPEED: 96,

  LAND_SOFT: 170,           // impact speed that begins a landing recovery
  LAND_HARD: 330,           // impact speed for the heavy landing
  LAND_LOCK_SOFT: 0.07,
  LAND_LOCK_HARD: 0.20,

  BODY_W: 10,
  BODY_H: 20,
  BODY_CROUCH_H: 13
};

export const PALETTES = {
  // Level 1 - warm morning sandstone
  sand: {
    sky: ['#2b1f3d', '#6a3f52', '#c47b5a', '#eab778'],
    far: '#7c5468',
    mid: '#5a3b50',
    stoneLight: '#e6c08a',
    stone: '#c99b62',
    stoneDark: '#9a6f45',
    stoneShadow: '#6e4c31',
    accent: '#3f8f8a',
    accent2: '#c2452f',
    gold: '#e8bc5a',
    ambient: 0xffe2b8,
    ambientAlpha: 0.0,
    dust: 0xe8cfa6
  },
  // Level 2 - cold dusk ruins
  ruin: {
    sky: ['#0d0f21', '#1d2140', '#3a3358', '#6b5074'],
    far: '#2a2a48',
    mid: '#1d1d33',
    stoneLight: '#8f93ad',
    stone: '#6b6f8a',
    stoneDark: '#4a4d66',
    stoneShadow: '#2f3145',
    accent: '#3c7d86',
    accent2: '#9b3b52',
    gold: '#b79a5c',
    ambient: 0x2a3a66,
    ambientAlpha: 0.22,
    dust: 0xa8adc4
  },
  // Level 3 - night fortress lit by torches
  fortress: {
    sky: ['#100a18', '#231430', '#4a2340', '#8a3f45'],
    far: '#37203c',
    mid: '#22142a',
    stoneLight: '#d8c2a4',
    stone: '#ab8e73',
    stoneDark: '#7b6250',
    stoneShadow: '#4c3b31',
    accent: '#2f7f9c',
    accent2: '#c03a34',
    gold: '#f0cf72',
    ambient: 0x3a1830,
    ambientAlpha: 0.26,
    dust: 0xd7c3a4
  }
};
