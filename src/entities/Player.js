import Phaser from 'phaser';
import { PHYS, GAME } from '../config.js';
import { HERO_KEY, FRAME_W, FRAME_H } from '../gfx/HeroFactory.js';

const TS = GAME.TILE;

// Body geometry, derived once. Because the offsets are chosen so that the body
// bottom always lands on the same sprite row, crouching never shifts the feet.
const OFF_X = (FRAME_W - PHYS.BODY_W) / 2;                 // 7
const OFF_Y_STAND = FRAME_H - 1 - PHYS.BODY_H;             // 11
const OFF_Y_CROUCH = FRAME_H - 1 - PHYS.BODY_CROUCH_H;     // 18
// sprite-space <-> body-space shortcuts (origin is 0.5 / 0.5)
const DX_CENTER = 0;                                       // body.center.x === sprite.x
const DY_BOTTOM = -FRAME_H / 2 + OFF_Y_STAND + PHYS.BODY_H; // body.bottom === sprite.y + 15

function approach(cur, target, maxDelta) {
  if (cur < target) return Math.min(cur + maxDelta, target);
  if (cur > target) return Math.max(cur - maxDelta, target);
  return target;
}

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, HERO_KEY, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(60);
    this.body.setSize(PHYS.BODY_W, PHYS.BODY_H, false);
    this.body.setOffset(OFF_X, OFF_Y_STAND);
    this.body.setMaxVelocity(400, PHYS.MAX_FALL);
    this.body.setAllowGravity(true);
    this.body.setGravityY(PHYS.GRAVITY);
    this.body.setCollideWorldBounds(true);

    this.mode = 'normal';         // normal | hang | climb | vault | dead
    this.facing = 1;
    this.crouching = false;
    this.sliding = false;
    this.jumping = false;
    this.wasGrounded = true;
    this.grounded = true;
    this.wallDir = 0;
    this.lastWallDir = 0;
    this.fallSpeed = 0;
    this.airTime = 0;
    this.ledge = null;
    this.stepTimer = 0;
    this.slideDustTimer = 0;
    this.ridingPlatform = null;

    this.t = {
      coyote: 0, buffer: 0, lock: 0, ledgeCd: 0,
      landLock: 0, wallStick: 0, dropThru: 0, vaultCd: 0, hangGrace: 0
    };

    this.play('hero-idle');
  }

  /* ------------------------------------------------------------ queries */

  solidTile(tx, ty) { return this.scene.solidAt(tx, ty); }

  solidAtWorld(wx, wy) {
    return this.scene.solidAt(Math.floor(wx / TS), Math.floor(wy / TS)) === 1;
  }

  /** -1 = wall on the left, 1 = wall on the right, 0 = free. */
  detectWall() {
    const b = this.body;
    const yA = b.top + 4;
    const yB = b.bottom - 4;
    if (this.solidAtWorld(b.right + 2, yA) && this.solidAtWorld(b.right + 2, yB)) return 1;
    if (this.solidAtWorld(b.left - 2, yA) && this.solidAtWorld(b.left - 2, yB)) return -1;
    return 0;
  }

  standingOnOneWay() {
    const b = this.body;
    const y = Math.floor((b.bottom + 2) / TS);
    const x1 = Math.floor((b.left + 1) / TS);
    const x2 = Math.floor((b.right - 1) / TS);
    return this.solidTile(x1, y) === 2 || this.solidTile(x2, y) === 2;
  }

  /** Enough clear space above to stand up out of a crouch? */
  canStand() {
    const b = this.body;
    const headY = b.bottom - PHYS.BODY_H - 1;
    return !this.solidAtWorld(b.left + 1, headY) && !this.solidAtWorld(b.right - 1, headY);
  }

  /* ------------------------------------------------------- main update */

  tick(time, delta) {
    if (this.mode === 'dead') return;
    const dt = Math.min(delta, 34) / 1000;
    const b = this.body;
    const I = this.scene.inputState;
    const t = this.t;

    for (const k in t) t[k] = Math.max(0, t[k] - dt);
    if (t.dropThru <= 0) b.checkCollision.down = true;

    // Riding a moving slab counts as being on the ground: the collider reports
    // it through `touching`, but the manual carry can lift the body clear of the
    // platform for a frame, which would otherwise eat the player's coyote time.
    const grounded = (b.blocked.down || b.touching.down || !!this.ridingPlatform)
      && this.mode === 'normal';
    this.grounded = grounded;

    if (grounded) { t.coyote = PHYS.COYOTE_TIME; this.airTime = 0; }
    else this.airTime += dt;

    if (I.jumpJustDown) t.buffer = PHYS.JUMP_BUFFER;

    // track the worst downward speed of this fall for the landing reaction
    if (!grounded && b.velocity.y > this.fallSpeed) this.fallSpeed = b.velocity.y;
    if (grounded && !this.wasGrounded) this.handleLanding();

    switch (this.mode) {
      case 'hang': this.tickHang(dt, I); break;
      case 'climb':
      case 'vault': break;                   // driven by their tweens
      default: this.tickNormal(dt, I, grounded, time);
    }

    this.wasGrounded = grounded;
    this.updateAnimation();
  }

  tickNormal(dt, I, grounded, time) {
    const b = this.body;
    const t = this.t;
    const dir = (I.right ? 1 : 0) - (I.left ? 1 : 0);

    /* ---- crouch ---- */
    const wantCrouch = grounded && I.down;
    if (wantCrouch && !this.crouching) this.setCrouch(true);
    else if (!wantCrouch && this.crouching && this.canStand()) this.setCrouch(false);

    /* ---- wall contact ---- */
    this.wallDir = this.detectWall();
    if (this.wallDir !== 0) { t.wallStick = PHYS.WALL_STICK; this.lastWallDir = this.wallDir; }

    /* ---- horizontal movement ---- */
    const maxSpeed = this.crouching ? PHYS.CROUCH_SPEED
      : (I.run ? PHYS.RUN_SPEED : PHYS.WALK_SPEED);
    let target, rate;

    if (t.landLock > 0 && grounded) {
      target = 0;
      rate = PHYS.FRICTION_GROUND * 0.7;
    } else if (t.lock > 0) {
      // just wall-jumped: keep the launch arc, allow a nudge but never let the
      // nudge push the player faster than the launch itself
      target = Phaser.Math.Clamp(b.velocity.x + dir * 70, -PHYS.WALL_JUMP_X, PHYS.WALL_JUMP_X);
      rate = 190;
    } else if (dir !== 0) {
      target = dir * maxSpeed;
      const over = Math.abs(b.velocity.x) > maxSpeed && Math.sign(b.velocity.x) === dir;
      if (over) rate = grounded ? 460 : 130;               // bleed extra momentum gently
      else {
        const turning = b.velocity.x !== 0 && Math.sign(b.velocity.x) !== dir;
        rate = (grounded ? PHYS.ACCEL_GROUND : PHYS.ACCEL_AIR) * (turning ? PHYS.TURN_BOOST : 1);
      }
    } else {
      target = 0;
      rate = grounded ? PHYS.FRICTION_GROUND : PHYS.FRICTION_AIR;
    }
    b.velocity.x = approach(b.velocity.x, target, rate * dt);

    if (dir !== 0 && t.lock <= 0 && t.landLock <= 0) this.facing = dir;
    this.setFlipX(this.facing < 0);

    /* ---- wall slide ---- */
    this.sliding = !grounded && b.velocity.y > 0 && this.wallDir !== 0 && dir === this.wallDir
      && !this.crouching;
    if (this.sliding) {
      b.velocity.y = Math.min(b.velocity.y, PHYS.WALL_SLIDE_SPEED);
      this.facing = this.wallDir;
      this.setFlipX(this.facing < 0);
      this.fallSpeed = Math.min(this.fallSpeed, PHYS.WALL_SLIDE_SPEED);
      this.slideDustTimer -= dt;
      if (this.slideDustTimer <= 0) {
        this.slideDustTimer = 0.09;
        this.scene.fx.wallDust(
          this.wallDir > 0 ? b.right : b.left,
          b.center.y + Phaser.Math.Between(-6, 6), -this.wallDir
        );
        this.scene.audio.play('slide');
      }
    }

    /* ---- fast fall / tuck ---- */
    if (!grounded && I.down && b.velocity.y > 0 && !this.sliding) {
      b.velocity.y = Math.min(PHYS.MAX_FALL, b.velocity.y + 520 * dt);
    }

    /* ---- jumping ---- */
    if (t.buffer > 0) {
      if (grounded && I.down && this.standingOnOneWay()) {
        t.dropThru = 0.24;
        b.checkCollision.down = false;
        b.velocity.y = 50;
        t.buffer = 0;
        this.scene.audio.play('slide');
      } else if (t.coyote > 0) {
        this.doJump();
      } else if (!grounded && (this.wallDir !== 0 || t.wallStick > 0)) {
        this.doWallJump(this.wallDir || this.lastWallDir);
      }
    }

    /* ---- variable jump height ---- */
    if (this.jumping) {
      if (!I.jumpDown && b.velocity.y < 0) {
        b.velocity.y *= PHYS.JUMP_CUT;
        this.jumping = false;
      } else if (b.velocity.y >= 0) this.jumping = false;
    }

    /* ---- vault / step up over a waist-high obstacle ----
       Running into it plays the full vault; walking into it just steps up, so
       stairs and kerbs never feel like walls. */
    if (grounded && t.vaultCd <= 0 && !this.crouching && dir !== 0 && dir === this.facing) {
      const fast = Math.abs(b.velocity.x) > PHYS.VAULT_MIN_SPEED;
      const pressed = dir > 0 ? b.blocked.right : b.blocked.left;
      if (fast || pressed) {
        const v = this.probeVault(this.facing);
        if (v) {
          if (fast) { this.startVault(v); return; }
          this.stepUp(v);
        }
      }
    }

    /* ---- ledge grab ---- */
    if (!grounded && this.mode === 'normal' && t.ledgeCd <= 0 && !I.down
        && b.velocity.y > -60) {
      let g = this.probeLedge(this.facing);
      if (!g && dir !== 0 && dir !== this.facing) g = this.probeLedge(dir);
      if (g) { this.grabLedge(g); return; }
    }

    /* ---- footsteps + running dust ---- */
    if (grounded && Math.abs(b.velocity.x) > 12 && t.landLock <= 0) {
      const interval = Phaser.Math.Clamp(3800 / Math.abs(b.velocity.x), 180, 460);
      this.stepTimer -= dt * 1000;
      if (this.stepTimer <= 0) {
        this.stepTimer = interval;
        this.scene.audio.play('step');
        if (Math.abs(b.velocity.x) > PHYS.WALK_SPEED + 10) {
          this.scene.fx.runDust(b.center.x - this.facing * 4, b.bottom, -this.facing);
        }
      }
    }
  }

  /* --------------------------------------------------------- abilities */

  doJump() {
    const b = this.body;
    if (this.crouching && !this.canStand()) return;
    this.setCrouch(false);
    b.velocity.y = PHYS.JUMP_VELOCITY;
    this.jumping = true;
    this.t.buffer = 0;
    this.t.coyote = 0;
    this.t.landLock = 0;
    this.fallSpeed = 0;
    this.scene.audio.play('jump');
    this.scene.fx.jumpDust(b.center.x, b.bottom);
    this.play('hero-jump', true);
  }

  doWallJump(side) {
    if (!side) return;
    const b = this.body;
    b.velocity.x = -side * PHYS.WALL_JUMP_X;
    b.velocity.y = PHYS.WALL_JUMP_Y;
    this.jumping = true;
    this.facing = -side;
    this.setFlipX(this.facing < 0);
    this.t.buffer = 0;
    this.t.lock = PHYS.WALL_JUMP_LOCK;
    this.t.wallStick = 0;
    this.t.ledgeCd = 0.06;
    this.fallSpeed = 0;
    this.sliding = false;
    this.scene.audio.play('walljump');
    this.scene.fx.wallDust(side > 0 ? b.right : b.left, b.center.y + 4, -side, 8);
    this.play('hero-jump', true);
  }

  /**
   * Is there a grabbable lip beside the player's hands?
   * The hand row must be empty, the row directly below it solid, and the row
   * above clear enough to climb into - that is what keeps grabs from firing
   * halfway up a flat wall.
   */
  probeLedge(d) {
    const b = this.body;
    const px = d > 0 ? b.right + 3 : b.left - 3;
    const tx = Math.floor(px / TS);

    // must be genuinely adjacent, not a diagonal snag
    const edgeTile = d > 0 ? Math.floor((b.right - 1) / TS) : Math.floor(b.left / TS);
    if (Math.abs(tx - edgeTile) > 1) return null;

    // Scan the column beside the hands for a lip inside the reach band. Scanning
    // rather than testing a single row means a fast fall cannot skip past a
    // valid ledge between two frames.
    const handY = b.top;
    const lo = handY - 6;
    const hi = handY + 13;
    for (let ty = Math.floor(lo / TS); ty <= Math.floor(hi / TS); ty++) {
      const surface = ty * TS;
      if (surface < lo || surface > hi) continue;
      if (this.solidTile(tx, ty) !== 1) continue;           // nothing to hold
      if (this.solidTile(tx, ty - 1) === 1) continue;       // not the top of the wall
      if (this.solidTile(tx, ty - 2) === 1) continue;       // no headroom to climb into
      if (this.solidTile(tx - d, ty) === 1) continue;       // body would be inside stone
      if (this.solidTile(tx - d, ty + 1) === 1) continue;
      return { tx, ty, ledgeY: surface, dir: d };
    }
    return null;
  }

  grabLedge(g) {
    const b = this.body;
    this.setCrouch(false);
    this.ledge = g;
    this.mode = 'hang';
    this.facing = g.dir;
    this.setFlipX(this.facing < 0);

    const dy = (g.ledgeY + PHYS.LEDGE_HANG_OFFSET) - b.top;
    const dx = g.dir > 0 ? (g.tx * TS) - b.right : ((g.tx + 1) * TS) - b.left;

    b.reset(this.x + dx, this.y + dy);
    b.setAllowGravity(false);
    b.setVelocity(0, 0);
    this.jumping = false;
    this.sliding = false;
    this.fallSpeed = 0;
    this.t.hangGrace = 0.12;
    this.scene.audio.play('grab');
    this.scene.fx.wallDust(g.dir > 0 ? b.right : b.left, g.ledgeY + 2, -g.dir, 5);
    this.play('hero-hang', true);
  }

  tickHang(dt, I) {
    const dir = (I.right ? 1 : 0) - (I.left ? 1 : 0);
    if (this.t.hangGrace > 0) return;

    if (I.down || I.downJustDown) { this.releaseLedge(); return; }
    if (I.jumpJustDown && dir === -this.ledge.dir) {
      // push off backwards, like a wall jump from the lip
      this.releaseLedge();
      this.body.velocity.x = dir * PHYS.WALL_JUMP_X * 0.9;
      this.body.velocity.y = PHYS.WALL_JUMP_Y;
      this.jumping = true;
      this.facing = dir;
      this.t.lock = PHYS.WALL_JUMP_LOCK;
      this.scene.audio.play('walljump');
      return;
    }
    if (I.up || I.interactJustDown || I.jumpJustDown) { this.startClimb(); return; }
    if (dir === -this.ledge.dir) { this.releaseLedge(); }
  }

  releaseLedge() {
    this.mode = 'normal';
    this.body.setAllowGravity(true);
    this.body.velocity.y = 30;
    this.t.ledgeCd = PHYS.LEDGE_COOLDOWN;
    this.ledge = null;
  }

  startClimb() {
    const g = this.ledge;
    const b = this.body;
    this.mode = 'climb';
    b.setAllowGravity(false);
    b.setVelocity(0, 0);
    b.enable = false;

    const x0 = this.x, y0 = this.y;
    const x1 = g.tx * TS + TS / 2 + DX_CENTER;
    const y1 = g.ledgeY - DY_BOTTOM;

    this.play('hero-climb', true);
    this.scene.audio.play('climb');

    const proxy = { t: 0 };
    this.climbTween = this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: PHYS.CLIMB_TIME,
      ease: 'Linear',
      onUpdate: () => {
        const p = proxy.t;
        const vy = Phaser.Math.Easing.Sine.Out(Phaser.Math.Clamp(p / 0.66, 0, 1));
        const vx = Phaser.Math.Easing.Sine.InOut(Phaser.Math.Clamp((p - 0.42) / 0.58, 0, 1));
        this.setPosition(x0 + (x1 - x0) * vx, y0 + (y1 - y0) * vy);
      },
      onComplete: () => {
        b.enable = true;
        b.reset(x1, y1);
        b.setAllowGravity(true);
        b.setGravityY(PHYS.GRAVITY);
        this.mode = 'normal';
        this.ledge = null;
        this.t.ledgeCd = 0.18;
        this.fallSpeed = 0;
        this.scene.fx.landDust(x1, y1 + DY_BOTTOM, 4);
      }
    });
  }

  /** A single waist-high block in front of a running player. */
  probeVault(d) {
    const b = this.body;
    const px = d > 0 ? b.right + 4 : b.left - 4;
    const tx = Math.floor(px / TS);
    const tyFeet = Math.floor((b.bottom - 4) / TS);

    if (this.solidTile(tx, tyFeet) !== 1) return null;
    if (this.solidTile(tx, tyFeet - 1) === 1) return null;
    if (this.solidTile(tx, tyFeet - 2) === 1) return null;
    const edgeTile = d > 0 ? Math.floor((b.right - 1) / TS) : Math.floor(b.left / TS);
    if (Math.abs(tx - edgeTile) > 1) return null;

    return { tx, topY: tyFeet * TS, dir: d };
  }

  startVault(v) {
    const b = this.body;
    this.mode = 'vault';
    b.setAllowGravity(false);
    b.setVelocity(0, 0);
    b.enable = false;

    const x0 = this.x, y0 = this.y;
    const x1 = v.tx * TS + TS / 2 + v.dir * 2;
    const y1 = v.topY - DY_BOTTOM;
    const speedKeep = this.facing * Math.min(PHYS.RUN_SPEED, 130);

    this.play('hero-vault', true);
    this.scene.audio.play('vault');
    this.scene.fx.wallDust(v.dir > 0 ? b.right : b.left, v.topY + 3, -v.dir, 5);

    const proxy = { t: 0 };
    this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: PHYS.VAULT_TIME,
      ease: 'Linear',
      onUpdate: () => {
        const p = proxy.t;
        const arc = -Math.sin(p * Math.PI) * 9;
        this.setPosition(x0 + (x1 - x0) * p, y0 + (y1 - y0) * Phaser.Math.Easing.Sine.Out(p) + arc);
      },
      onComplete: () => {
        b.enable = true;
        b.reset(x1, y1);
        b.setAllowGravity(true);
        b.setGravityY(PHYS.GRAVITY);
        b.velocity.x = speedKeep;          // carry the run through the vault
        this.mode = 'normal';
        this.t.vaultCd = 0.25;
        this.t.ledgeCd = 0.2;
        this.fallSpeed = 0;
        this.scene.fx.landDust(x1, y1 + DY_BOTTOM, 3);
      }
    });
  }

  /** Instant, animation-free version of the vault for slow contact (stairs). */
  stepUp(v) {
    const b = this.body;
    const keep = b.velocity.x;
    b.reset(v.tx * TS + TS / 2, v.topY - DY_BOTTOM);
    b.setAllowGravity(true);
    b.setGravityY(PHYS.GRAVITY);
    b.velocity.x = Math.abs(keep) > 20 ? keep : v.dir * 30;
    this.t.vaultCd = 0.1;
    this.t.ledgeCd = 0.2;
    this.fallSpeed = 0;
    this.scene.fx.runDust(b.center.x, b.bottom, -v.dir);
    this.scene.audio.play('step');
  }

  handleLanding() {
    const impact = this.fallSpeed;
    this.fallSpeed = 0;
    this.jumping = false;
    if (impact < PHYS.LAND_SOFT) return;

    const hard = impact >= PHYS.LAND_HARD;
    this.t.landLock = hard ? PHYS.LAND_LOCK_HARD : PHYS.LAND_LOCK_SOFT;
    this.scene.audio.play('land', { hard });
    this.scene.fx.landDust(this.body.center.x, this.body.bottom, hard ? 10 : 5);
    if (hard) this.scene.shake(0.0035, 110);
    this.play('hero-land', true);
  }

  setCrouch(on) {
    if (on === this.crouching) return;
    const b = this.body;
    this.crouching = on;
    if (on) {
      b.setSize(PHYS.BODY_W, PHYS.BODY_CROUCH_H, false);
      b.setOffset(OFF_X, OFF_Y_CROUCH);
    } else {
      b.setSize(PHYS.BODY_W, PHYS.BODY_H, false);
      b.setOffset(OFF_X, OFF_Y_STAND);
    }
  }

  /* -------------------------------------------------------- animation */

  updateAnimation() {
    if (this.mode === 'climb' || this.mode === 'vault' || this.mode === 'dead') return;
    const b = this.body;
    const key = this.anims.currentAnim && this.anims.currentAnim.key;

    if (this.mode === 'hang') {
      if (key !== 'hero-hang') this.play('hero-hang', true);
      return;
    }

    if (!this.grounded) {
      if (this.sliding) {
        if (key !== 'hero-wallslide') this.play('hero-wallslide', true);
      } else if (this.scene.inputState.down && b.velocity.y > 60) {
        if (key !== 'hero-tuck') this.play('hero-tuck', true);
      } else if (b.velocity.y < -30) {
        if (key !== 'hero-jump') this.play('hero-jump', true);
      } else if (b.velocity.y > 90 && this.nearGrabbableWall()) {
        if (key !== 'hero-reach') this.play('hero-reach', true);
      } else if (key !== 'hero-fall') {
        this.play('hero-fall', true);
      }
      return;
    }

    // grounded
    if (this.t.landLock > 0) {
      if (key !== 'hero-land') this.play('hero-land', true);
      return;
    }
    if (this.crouching) {
      if (key !== 'hero-crouch') this.play('hero-crouch', true);
      return;
    }

    const spd = Math.abs(b.velocity.x);
    const I = this.scene.inputState;
    const dir = (I.right ? 1 : 0) - (I.left ? 1 : 0);
    if (dir !== 0 && Math.sign(b.velocity.x) === -dir && spd > 60) {
      if (key !== 'hero-skid') this.play('hero-skid', true);
      return;
    }
    if (spd < 7) {
      if (key !== 'hero-idle') this.play('hero-idle', true);
    } else if (spd > PHYS.WALK_SPEED + 12) {
      if (key !== 'hero-run') this.play('hero-run', true);
      this.anims.msPerFrame = 1000 / (10 + (spd / PHYS.RUN_SPEED) * 9);
    } else {
      if (key !== 'hero-walk') this.play('hero-walk', true);
      this.anims.msPerFrame = 1000 / (5 + (spd / PHYS.WALK_SPEED) * 7);
    }
  }

  nearGrabbableWall() {
    const b = this.body;
    return this.solidAtWorld(b.right + 3, b.top + 6) || this.solidAtWorld(b.left - 3, b.top + 6);
  }

  /* ------------------------------------------------------------ states */

  kill() {
    if (this.mode === 'dead') return;
    this.mode = 'dead';
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.body.enable = false;
    this.play('hero-tuck', true);
  }

  respawn(x, y) {
    if (this.climbTween) this.climbTween.stop();
    this.scene.tweens.killTweensOf(this);
    this.mode = 'normal';
    this.ledge = null;
    this.crouching = false;
    this.sliding = false;
    this.jumping = false;
    this.fallSpeed = 0;
    this.facing = 1;
    this.setFlipX(false);
    this.setAlpha(1);
    for (const k in this.t) this.t[k] = 0;
    this.body.enable = true;
    this.body.setSize(PHYS.BODY_W, PHYS.BODY_H, false);
    this.body.setOffset(OFF_X, OFF_Y_STAND);
    this.body.checkCollision.down = true;
    this.body.reset(x, y);
    this.body.setAllowGravity(true);
    this.body.setGravityY(PHYS.GRAVITY);
    this.play('hero-idle', true);
  }
}
