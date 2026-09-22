import Phaser from 'phaser';

/**
 * Moving and crumbling platforms.
 *
 * Both are immovable Arcade bodies so the player's collision resolution stays
 * simple and predictable. Riders are carried manually from the platform's
 * per-step delta, which is far more reliable than hoping friction does it.
 */

export class MovingPlatform extends Phaser.Physics.Arcade.Image {
  constructor(scene, def, texKey) {
    super(scene, def.x, def.y, texKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0, 0).setDepth(50);

    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.setSize(this.width, 11);
    this.body.setOffset(0, 2);
    // We drive the slab by hand. With `moves` left on, Arcade's postUpdate would
    // re-apply the same delta to the image and the platform would travel at
    // double speed while riders only received one delta's worth.
    this.body.moves = false;

    this.a = new Phaser.Math.Vector2(def.x, def.y);
    this.b = new Phaser.Math.Vector2(def.toX, def.toY);
    this.speed = def.speed;
    this.dirToB = true;
    this.prevX = def.x;
    this.prevY = def.y;
    this.dx = 0;
    this.dy = 0;

    const len = Phaser.Math.Distance.BetweenPoints(this.a, this.b) || 1;
    this.unit = new Phaser.Math.Vector2((this.b.x - this.a.x) / len, (this.b.y - this.a.y) / len);
    this.len = len;
    this.travelled = 0;
    // pause briefly at each end so the timing reads clearly
    this.hold = 0;
  }

  step(dt) {
    this.prevX = this.x;
    this.prevY = this.y;

    if (this.hold > 0) {
      this.hold -= dt;
      this.body.setVelocity(0, 0);
    } else {
      const move = this.speed * dt;
      this.travelled += this.dirToB ? move : -move;
      if (this.travelled >= this.len) { this.travelled = this.len; this.dirToB = false; this.hold = 0.45; }
      else if (this.travelled <= 0) { this.travelled = 0; this.dirToB = true; this.hold = 0.45; }
      const nx = this.a.x + this.unit.x * this.travelled;
      const ny = this.a.y + this.unit.y * this.travelled;
      // positioned by hand rather than by velocity, so the body follows the image
      this.setPosition(nx, ny);
      this.body.updateFromGameObject();
    }

    this.dx = this.x - this.prevX;
    this.dy = this.y - this.prevY;
  }

  /**
   * Is this body riding me? Resting on a moving body sets `touching.down`
   * rather than `blocked.down`, so proximity plus a non-rising velocity is the
   * reliable test.
   */
  carries(body) {
    return Math.abs(body.bottom - this.body.top) <= 6
      && body.right > this.body.left + 1
      && body.left < this.body.right - 1
      && body.velocity.y >= -20;
  }
}

export class FallingPlatform extends Phaser.Physics.Arcade.Image {
  constructor(scene, def, texKey) {
    super(scene, def.x, def.y, texKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0, 0).setDepth(50);

    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.setSize(this.width, 10);
    this.body.setOffset(0, 0);

    this.homeX = def.x;
    this.homeY = def.y;
    this.state2 = 'idle';     // idle | shaking | falling | gone
    this.timer = 0;
  }

  touched() {
    if (this.state2 !== 'idle') return;
    this.state2 = 'shaking';
    // long enough to read as a warning and to still jump off from a standstill
    this.timer = 0.55;
    this.scene.audio.play('crumble');
    this.scene.fx.rubble(this.x + this.width / 2, this.y + 10, 4);
  }

  step(dt) {
    switch (this.state2) {
      case 'shaking':
        this.timer -= dt;
        // Only the image shakes; the body is re-read from it next frame anyway,
        // and leaving the body alone keeps postUpdate from compounding the jitter.
        this.setPosition(this.homeX + Phaser.Math.Between(-1, 1), this.homeY + Phaser.Math.Between(-1, 1));
        if (this.timer <= 0) {
          this.state2 = 'falling';
          this.timer = 2.4;
          this.body.setImmovable(false);
          this.body.setAllowGravity(true);
          this.body.setGravityY(620);
          this.body.checkCollision.none = true;
          this.scene.fx.rubble(this.x + this.width / 2, this.y + 10, 10);
        }
        break;
      case 'falling':
        this.timer -= dt;
        this.setAlpha(Math.max(0, this.timer / 1.6));
        if (this.timer <= 0) this.reset();
        break;
      default:
        break;
    }
  }

  reset() {
    this.state2 = 'idle';
    this.setAlpha(1);
    this.body.setAllowGravity(false);
    this.body.setVelocity(0, 0);
    this.body.setImmovable(true);
    this.body.checkCollision.none = false;
    this.body.reset(this.homeX, this.homeY);
    this.setPosition(this.homeX, this.homeY);
    this.body.updateFromGameObject();
  }
}
