import Phaser from 'phaser';

/**
 * Particle budget for the whole game.
 *
 * Six emitters are created once and reused via emitParticleAt - Phaser pools
 * the particles internally, so nothing is allocated during play. Ambient motes
 * and torch sparks are throttled and culled to the camera view so a level full
 * of torches still costs almost nothing.
 */
export default class Fx {
  constructor(scene, palette) {
    this.scene = scene;
    this.pal = palette;

    const dust = palette.dust;
    const grit = parseInt(palette.stoneDark.slice(1), 16);

    this.land = scene.add.particles(0, 0, 'p-puff', {
      lifespan: { min: 260, max: 520 },
      speed: { min: 18, max: 70 },
      angle: { min: 190, max: 350 },
      gravityY: 70,
      scale: { start: 1, end: 0.2 },
      alpha: { start: 0.65, end: 0 },
      tint: dust,
      emitting: false,
      quantity: 1
    }).setDepth(58);

    this.run = scene.add.particles(0, 0, 'p-dot', {
      lifespan: { min: 180, max: 330 },
      speed: { min: 10, max: 34 },
      gravityY: 26,
      scale: { start: 1, end: 0.4 },
      alpha: { start: 0.45, end: 0 },
      tint: dust,
      emitting: false,
      quantity: 1
    }).setDepth(58);

    this.wall = scene.add.particles(0, 0, 'p-dot', {
      lifespan: { min: 200, max: 400 },
      speed: { min: 12, max: 48 },
      gravityY: 90,
      scale: { start: 1, end: 0.3 },
      alpha: { start: 0.55, end: 0 },
      tint: dust,
      emitting: false,
      quantity: 1
    }).setDepth(58);

    this.debris = scene.add.particles(0, 0, 'p-dot', {
      lifespan: { min: 500, max: 1100 },
      speed: { min: 20, max: 90 },
      angle: { min: 200, max: 340 },
      gravityY: 400,
      scale: { start: 1.4, end: 0.6 },
      alpha: { start: 0.9, end: 0.2 },
      rotate: { min: 0, max: 360 },
      tint: [grit, dust],
      emitting: false,
      quantity: 1
    }).setDepth(58);

    this.spark = scene.add.particles(0, 0, 'p-pixel', {
      lifespan: { min: 380, max: 820 },
      speedY: { min: -26, max: -9 },
      speedX: { min: -7, max: 7 },
      scale: { start: 1.6, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [0xffd98a, 0xf7952c, 0xffe9bc],
      emitting: false,
      quantity: 1
    }).setDepth(45);

    // Slow ambient motes drifting through the shafts of light.
    this.motes = scene.add.particles(0, 0, 'p-pixel', {
      lifespan: 5200,
      speedX: { min: -9, max: -2 },
      speedY: { min: -5, max: 7 },
      scale: { start: 1, end: 1 },
      alpha: { start: 0.16, end: 0 },
      tint: dust,
      emitting: false
    }).setDepth(44);

    this._moteTimer = 0;
    this._sparkTimer = 0;
    this._torchIdx = 0;
  }

  landDust(x, y, count = 6) {
    this.land.emitParticleAt(x, y - 1, count);
  }

  jumpDust(x, y) {
    this.land.emitParticleAt(x, y - 1, 3);
  }

  runDust(x, y, dirX) {
    const p = this.run.emitParticleAt(x, y - 2, 1);
    if (p) p.velocityX = dirX * Phaser.Math.Between(14, 40);
  }

  wallDust(x, y, dirX, count = 3) {
    for (let i = 0; i < count; i++) {
      const p = this.wall.emitParticleAt(x, y, 1);
      if (p) p.velocityX = dirX * Phaser.Math.Between(16, 55);
    }
  }

  rubble(x, y, count = 8) {
    this.debris.emitParticleAt(x, y, count);
  }

  torchSpark(x, y) {
    this.spark.emitParticleAt(x, y, 1);
  }

  /**
   * Called once per frame. Keeps ambient effects cheap by only emitting a
   * couple of particles per second and only for torches inside the view.
   */
  update(delta, camera, torches) {
    const dt = delta / 1000;

    this._moteTimer -= dt;
    if (this._moteTimer <= 0) {
      this._moteTimer = 0.34;
      const x = camera.scrollX + Phaser.Math.Between(-10, camera.width + 20);
      const y = camera.scrollY + Phaser.Math.Between(0, camera.height);
      this.motes.emitParticleAt(x, y, 1);
    }

    this._sparkTimer -= dt;
    if (this._sparkTimer <= 0 && torches && torches.length) {
      this._sparkTimer = 0.1;
      // round-robin over torches so the cost is constant regardless of count
      for (let n = 0; n < 3 && n < torches.length; n++) {
        this._torchIdx = (this._torchIdx + 1) % torches.length;
        const t = torches[this._torchIdx];
        if (t.x > camera.scrollX - 20 && t.x < camera.scrollX + camera.width + 20
          && t.y > camera.scrollY - 20 && t.y < camera.scrollY + camera.height + 20) {
          this.torchSpark(t.x + Phaser.Math.Between(-1, 1), t.y - 13);
        }
      }
    }
  }
}
