import Phaser from 'phaser';
import { GAME, PALETTES } from '../config.js';
import { T, SOLID_TILES } from '../gfx/ArtFactory.js';
import { label } from '../gfx/PixelFont.js';
import { buildLevel } from '../world/LevelBuilder.js';
import { levelByKey, levelIndex, LEVELS } from '../levels/index.js';
import Player from '../entities/Player.js';
import Fx from '../systems/Fx.js';
import { MovingPlatform, FallingPlatform } from '../systems/Platforms.js';
import { getAudio } from '../audio/AudioManager.js';
import Save, { formatTime } from '../systems/Save.js';
import { INK } from '../systems/UiKit.js';
import Touch, { touchText } from '../systems/TouchControls.js';

const TS = GAME.TILE;

const DEPTH = {
  sky: 0, far: 1, mid: 2,
  decorBack: 10,
  tiles: 20,
  door: 22, checkpoint: 24, torch: 26,
  platforms: 30,
  decorFront: 42,
  player: 60,
  ambient: 80,
  hint: 86,
  hud: 100
};

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.levelKey = (data && data.levelKey) || 'level1';
    this.def = levelByKey(this.levelKey);
    this.index = levelIndex(this.levelKey);
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const pal = this.def.palette;
    this.pal = PALETTES[pal];

    this.world = buildLevel(this.def);
    this.audio = getAudio(this);
    this.audio.unlock();
    if (Save.settings.music) this.audio.startMusic(pal);

    this.elapsed = 0;
    this.deaths = 0;
    this.finished = false;
    this.respawning = false;
    this.lookX = 0;
    this.lookY = 0;

    this.buildBackground(pal, W, H);
    this.buildTilemap(pal);
    this.buildDecor(pal);
    this.buildEntities(pal);

    this.fx = new Fx(this, this.pal);

    /* ------------------------------------------------------------ player */
    this.spawnPoint = { x: this.world.spawn.x, y: this.world.spawn.y - 16 };
    this.checkpointPoint = Object.assign({}, this.spawnPoint);
    this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y);
    this.player.setDepth(DEPTH.player);

    this.physics.world.setBounds(0, -240, this.world.pixelWidth, this.world.pixelHeight + 900);
    this.physics.add.collider(this.player, this.solidLayer);
    this.physics.add.collider(this.player, this.moverGroup);
    this.physics.add.collider(this.player, this.fallerGroup, (p, f) => {
      if (p.body.velocity.y >= -10 && p.body.bottom <= f.body.top + 8) f.touched();
    });

    /* ------------------------------------------------------------ camera */
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.pixelWidth, this.world.pixelHeight);
    cam.startFollow(this.player, true, 0.14, 0.16);
    cam.setDeadzone(28, 22);
    cam.setFollowOffset(0, -14);
    cam.fadeIn(360, 8, 6, 12);
    this.maxScrollY = Math.max(0, this.world.pixelHeight - H);

    this.buildInput();
    this.buildHud(W, H);
    this.buildHints();

    this.showTitleCard(W, H);

    // On-screen controls live only as long as the level is actually in play.
    Touch.show(true, () => this.pauseGame());
    // Scene emitters outlive restarts, so these are removed again on shutdown.
    const hideTouch = () => Touch.show(false);
    const showTouch = () => Touch.show(true);
    this.events.on('pause', hideTouch);
    this.events.on('resume', showTouch);
    this.events.once('shutdown', () => {
      this.events.off('pause', hideTouch);
      this.events.off('resume', showTouch);
      Touch.show(false);
      this.input.keyboard.removeAllKeys(true);
    });
  }

  /* -------------------------------------------------------------- build */

  buildBackground(pal, W, H) {
    const sky = this.add.image(0, 0, `sky-${pal}`).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.sky);
    sky.setDisplaySize(W, H);

    // Anchored so that with the camera at the foot of a level the skyline sits
    // just above the floor line rather than hiding behind it. The `drop` term in
    // updateCamera slides both layers down as the player climbs.
    this.farBase = -16;
    this.midBase = 6;
    this.far = this.add.tileSprite(0, this.farBase, W, 180, `far-${pal}`)
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH.far).setAlpha(0.92);
    this.mid = this.add.tileSprite(0, this.midBase, W, 220, `mid-${pal}`)
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH.mid);
    // The mid layer is a fixed-height strip; this fills everything beneath it so
    // the bright horizon of the sky never shows through a pit.
    this.midFill = this.add.rectangle(0, this.midBase + 219, W, H * 2, this.midInt(pal))
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH.mid);

    // Anything the player can fall into should read as bottomless rather than
    // showing the bright underside of the sky.
    const chasmTop = Math.max(0, this.world.deathY - 240);
    this.add.tileSprite(0, chasmTop, this.world.pixelWidth, this.world.deathY - chasmTop + 80, 'chasm')
      .setOrigin(0).setDepth(DEPTH.mid + 1);

    if (this.pal.ambientAlpha > 0) {
      const g = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.ambient);
      g.fillStyle(this.pal.ambient, this.pal.ambientAlpha);
      g.fillRect(0, 0, W, H);
      g.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
  }

  midInt(pal) {
    return parseInt(PALETTES[pal].mid.slice(1), 16);
  }

  buildTilemap(pal) {
    this.map = this.make.tilemap({
      data: this.world.data,
      tileWidth: TS,
      tileHeight: TS
    });
    const tileset = this.map.addTilesetImage('tiles', `tiles-${pal}`, TS, TS, 0, 0);
    this.solidLayer = this.map.createLayer(0, tileset, 0, 0);
    this.solidLayer.setDepth(DEPTH.tiles);

    this.solidLayer.setCollision(SOLID_TILES, true);
    this.solidLayer.setCollision(T.PLATFORM, true);
    // One-way platforms: land on them, pass through from every other direction.
    this.solidLayer.forEachTile((tile) => {
      if (tile.index === T.PLATFORM) tile.setCollision(false, false, true, false);
    });
  }

  buildDecor(pal) {
    const place = (list, depth) => list.forEach((d) => {
      const img = this.add.image(d.x, d.y, `${d.tex}-${pal}`);
      img.setOrigin(d.originX, d.originY).setDepth(depth).setAlpha(d.alpha);
      if (d.flip) img.setFlipX(true);
      if (d.tint !== null) img.setTint(d.tint);
      // hanging cloth sways
      if (d.tex === 'cloth' || d.tex === 'banner' || d.tex === 'curtain') {
        this.tweens.add({
          targets: img,
          angle: { from: -1.1, to: 1.1 },
          duration: 2200 + Math.random() * 1400,
          yoyo: true, repeat: -1, ease: 'Sine.InOut'
        });
      }
    });
    place(this.world.decorBack, DEPTH.decorBack);
    place(this.world.decorFront, DEPTH.decorFront);

    /* torches */
    const animKey = `flame-${pal}`;
    if (!this.anims.exists(animKey)) {
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(`torch-${pal}`, { start: 0, end: 2 }),
        frameRate: 10,
        repeat: -1
      });
    }
    this.torches = this.world.torches.map((t) => {
      const glow = this.add.image(t.x, t.y - 12, 'ui-glow')
        .setDepth(DEPTH.torch - 1).setAlpha(0.55).setScale(1.15);
      this.tweens.add({
        targets: glow, alpha: { from: 0.42, to: 0.66 }, scale: { from: 1.05, to: 1.25 },
        duration: 420 + Math.random() * 260, yoyo: true, repeat: -1, ease: 'Sine.InOut'
      });
      const s = this.add.sprite(t.x, t.y, `torch-${pal}`, 0).setOrigin(0.5, 1).setDepth(DEPTH.torch);
      s.play({ key: animKey, startFrame: Phaser.Math.Between(0, 2) });
      return t;
    });
  }

  buildEntities(pal) {
    /* checkpoints */
    this.checkpoints = this.world.checkpoints.map((c) => {
      const s = this.add.sprite(c.x, c.y, `brazier-${pal}`, 0).setOrigin(0.5, 1).setDepth(DEPTH.checkpoint);
      const glow = this.add.image(c.x, c.y - 20, 'ui-glow').setDepth(DEPTH.checkpoint - 1).setAlpha(0).setScale(1.3);
      return { x: c.x, y: c.y, sprite: s, glow, active: false };
    });

    /* moving + falling platforms */
    this.moverGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.movers = this.world.movers.map((m) => {
      const p = new MovingPlatform(this, m, `mover-${pal}`);
      p.setDepth(DEPTH.platforms);
      this.moverGroup.add(p);
      p.body.setAllowGravity(false);
      p.body.setImmovable(true);
      return p;
    });

    this.fallerGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.fallers = this.world.fallers.map((f) => {
      const p = new FallingPlatform(this, f, `faller-${pal}`);
      p.setDepth(DEPTH.platforms);
      this.fallerGroup.add(p);
      p.body.setAllowGravity(false);
      p.body.setImmovable(true);
      return p;
    });

    /* the way out */
    const e = this.world.exit;
    this.doorGlow = this.add.image(e.x, e.y - 34, 'ui-glow').setDepth(DEPTH.door - 1).setAlpha(0.5).setScale(1.8);
    this.tweens.add({ targets: this.doorGlow, alpha: 0.85, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.door = this.add.image(e.x, e.y, `door-${pal}`).setOrigin(0.5, 1).setDepth(DEPTH.door);
    this.doorRect = new Phaser.Geom.Rectangle(e.x - 12, e.y - 44, 24, 44);
  }

  buildInput() {
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({
      left: K.A, right: K.D, up: K.W, down: K.S,
      aLeft: K.LEFT, aRight: K.RIGHT, aUp: K.UP, aDown: K.DOWN,
      jump: K.SPACE, run: K.SHIFT, interact: K.E,
      pause: K.ESC, restart: K.R
    });
    this.inputState = {
      left: false, right: false, up: false, down: false, run: false,
      jumpDown: false, jumpJustDown: false, interactJustDown: false, downJustDown: false
    };

    this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
    this.input.keyboard.on('keydown-R', () => this.restartLevel());
  }

  buildHud(W, H) {
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.hud);

    const bar = this.add.graphics();
    bar.fillStyle(0x0b0910, 0.5);
    bar.fillRect(0, 0, W, 13);
    bar.fillStyle(0x3a2f24, 1);
    bar.fillRect(0, 13, W, 1);

    this.hudName = label(this, 6, 3, `${this.index + 1}. ${this.def.name}`, 8, INK.gold);
    this.hudTime = label(this, W - 6, 3, '00:00.0', 8, INK.parchment).setOrigin(1, 0);
    this.hudDeaths = label(this, W / 2, 3, 'FALLS 0', 8, INK.dim).setOrigin(0.5, 0);

    this.hud.add([bar, this.hudName, this.hudTime, this.hudDeaths]);

    this.toast = label(this, W / 2, 24, '', 8, INK.teal).setOrigin(0.5, 0).setAlpha(0);
    this.toast.setScrollFactor(0).setDepth(DEPTH.hud);
  }

  buildHints() {
    this.hints = [];
    if (!Save.settings.hints) return;
    this.world.hints.forEach((h) => {
      const t = label(this, h.x, h.y, touchText(h.text), 8, 0xd8c8a8).setOrigin(0.5, 1).setDepth(DEPTH.hint);
      t.setAlpha(0);
      t.setCenterAlign();
      // keep the sign inside the level so it never spills off the edge of the map
      const half = t.width / 2 + 6;
      t.x = Math.round(Phaser.Math.Clamp(h.x, half, this.world.pixelWidth - half));
      this.hints.push({ t, x: t.x, y: h.y });
    });
  }

  showTitleCard(W, H) {
    const box = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1);
    const name = label(this, W / 2, H / 2 - 14, this.def.name, 16, INK.gold).setOrigin(0.5);
    const sub = label(this, W / 2, H / 2 + 8, this.def.subtitle, 8, INK.parchment).setOrigin(0.5);
    box.add([name, sub]);
    box.setAlpha(0);
    this.tweens.add({
      targets: box, alpha: 1, duration: 500, hold: 1200, yoyo: true,
      onComplete: () => box.destroy()
    });
  }

  /* --------------------------------------------------------- collision */

  /** 0 = air, 1 = solid, 2 = one-way. Queried by the player controller. */
  solidAt(tx, ty) {
    const w = this.world.width;
    if (tx < 0 || tx >= w) return 1;           // the map edge behaves like a wall
    if (ty < 0) return 0;
    if (ty >= this.world.height) return 1;
    return this.world.collision[ty * w + tx];
  }

  shake(intensity, duration) {
    if (!Save.settings.shake) return;
    this.cameras.main.shake(duration, intensity, false);
  }

  /* ------------------------------------------------------------ update */

  update(time, delta) {
    const dt = Math.min(delta, 34) / 1000;
    const K = Phaser.Input.Keyboard;
    const k = this.keys;
    const I = this.inputState;

    const alive = !this.finished && !this.respawning;

    // JustDown has to be polled every frame or the latch survives into the next
    // one, so it is read first and gated afterwards.
    // Touch presses are latched the same way and merged with the keyboard.
    const tp = Touch.state;
    const jJump = K.JustDown(k.jump) | Touch.consume('jump');
    const jUp = K.JustDown(k.up) | K.JustDown(k.aUp) | Touch.consume('up');
    const jInteract = K.JustDown(k.interact);
    const jDown = K.JustDown(k.down) | K.JustDown(k.aDown) | Touch.consume('down');

    I.left = alive && (k.left.isDown || k.aLeft.isDown || tp.left);
    I.right = alive && (k.right.isDown || k.aRight.isDown || tp.right);
    I.up = alive && (k.up.isDown || k.aUp.isDown || tp.up);
    I.down = alive && (k.down.isDown || k.aDown.isDown || tp.down);
    I.run = alive && (k.run.isDown || tp.run);
    I.jumpDown = alive && (k.jump.isDown || tp.jump);
    I.jumpJustDown = alive && jJump;
    I.interactJustDown = alive && (jInteract || jUp);
    I.downJustDown = alive && jDown;

    if (alive) this.elapsed += delta;

    this.player.tick(time, delta);

    /* platforms + riders
       Arcade writes body -> sprite on POST_UPDATE, i.e. after this method runs,
       so the sprite's x/y are still last frame's here. Riders therefore have to
       be nudged on the BODY; touching the sprite would undo the physics step. */
    let riding = null;
    for (let i = 0; i < this.movers.length; i++) {
      const m = this.movers[i];
      m.step(dt);
      if (this.player.mode === 'normal' && m.carries(this.player.body)) {
        this.player.body.position.x += m.dx;
        this.player.body.position.y += m.dy;
        this.player.body.updateCenter();
        riding = m;
      }
    }
    this.player.ridingPlatform = riding;
    for (let i = 0; i < this.fallers.length; i++) this.fallers[i].step(dt);

    this.updateCheckpoints();
    this.updateHints();
    this.updateCamera(delta);

    this.fx.update(delta, this.cameras.main, this.torches);

    this.hudTime.setText(formatTime(this.elapsed));

    /* falling out of the world */
    if (alive && this.player.y > this.world.deathY) this.die();

    /* the way out */
    if (alive && Phaser.Geom.Rectangle.Overlaps(this.player.body, this.doorRect)) this.complete();
  }

  updateCamera(delta) {
    const cam = this.cameras.main;
    const p = this.player;
    const targetX = -p.facing * 26 * Math.min(1, Math.abs(p.body.velocity.x) / 70);
    const targetY = -14 + Phaser.Math.Clamp(p.body.velocity.y * 0.06, -10, 26);
    const rate = Math.min(1, delta / 1000 * 3.2);
    this.lookX = Phaser.Math.Linear(this.lookX, targetX, rate);
    this.lookY = Phaser.Math.Linear(this.lookY, targetY, rate);
    cam.setFollowOffset(this.lookX, this.lookY);

    const drop = this.maxScrollY - cam.scrollY;
    this.far.tilePositionX = cam.scrollX * 0.12;
    this.far.y = Math.round(this.farBase + drop * 0.08);
    this.mid.tilePositionX = cam.scrollX * 0.30;
    this.mid.y = Math.round(this.midBase + drop * 0.20);
    this.midFill.y = this.mid.y + 219;
  }

  updateCheckpoints() {
    const b = this.player.body;
    for (let i = 0; i < this.checkpoints.length; i++) {
      const c = this.checkpoints[i];
      if (c.active) continue;
      if (Math.abs(b.center.x - c.x) < 22 && Math.abs(b.bottom - c.y) < 34) {
        c.active = true;
        c.sprite.setFrame(1);
        this.tweens.add({ targets: c.glow, alpha: 0.7, duration: 400 });
        this.checkpointPoint = { x: c.x, y: c.y - 16 };
        this.audio.play('checkpoint');
        this.fx.rubble(c.x, c.y - 14, 3);
        this.showToast('RESTING PLACE FOUND');
      }
    }
  }

  updateHints() {
    const b = this.player.body;
    for (let i = 0; i < this.hints.length; i++) {
      const h = this.hints[i];
      const d = Phaser.Math.Distance.Between(b.center.x, b.center.y, h.x, h.y);
      const want = d < 86 ? 1 : 0;
      h.t.setAlpha(Phaser.Math.Linear(h.t.alpha, want, 0.08));
    }
  }

  showToast(text) {
    this.toast.setText(String(text).toUpperCase());
    this.tweens.killTweensOf(this.toast);
    this.toast.setAlpha(0);
    this.tweens.add({ targets: this.toast, alpha: 1, duration: 220, hold: 1000, yoyo: true });
  }

  /* ------------------------------------------------------------- flow */

  die() {
    if (this.respawning) return;
    this.respawning = true;
    this.deaths++;
    this.hudDeaths.setText(`FALLS ${this.deaths}`);
    this.audio.play('death');
    this.player.kill();
    this.cameras.main.fadeOut(240, 8, 6, 12);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.fallers.forEach((f) => f.reset());
      this.player.respawn(this.checkpointPoint.x, this.checkpointPoint.y);
      this.lookX = 0; this.lookY = -14;
      this.cameras.main.fadeIn(240, 8, 6, 12);
      this.respawning = false;
    });
  }

  restartLevel() {
    if (this.finished) return;
    this.cameras.main.fadeOut(220, 8, 6, 12);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.restart({ levelKey: this.levelKey });
    });
  }

  pauseGame() {
    if (this.finished || this.scene.isPaused()) return;
    this.scene.launch('Pause', { levelKey: this.levelKey });
    this.scene.pause();
  }

  complete() {
    if (this.finished) return;
    this.finished = true;
    Touch.show(false);
    const time = this.elapsed;
    Save.complete(this.index, this.levelKey, time);
    this.audio.play('complete');
    if (this.player.body.enable) this.player.body.setVelocity(0, 0);
    this.tweens.add({ targets: this.player, alpha: 0, duration: 560, delay: 160 });
    this.tweens.add({ targets: this.doorGlow, alpha: 1, scale: 3.4, duration: 800 });

    this.cameras.main.fadeOut(900, 8, 6, 12);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const next = LEVELS[this.index + 1];
      this.scene.start('LevelComplete', {
        levelKey: this.levelKey,
        index: this.index,
        time,
        deaths: this.deaths,
        nextKey: next ? next.key : null
      });
    });
  }
}
