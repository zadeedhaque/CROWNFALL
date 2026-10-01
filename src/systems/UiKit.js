import Phaser from 'phaser';
import { label } from '../gfx/PixelFont.js';
import { getAudio } from '../audio/AudioManager.js';

export const INK = {
  gold: 0xe8bc5a,
  goldDim: 0x8a7038,
  parchment: 0xf0e0c0,
  dim: 0x7b6a58,
  teal: 0x48a3ad,
  red: 0xc8452f
};

/** A carved stone plaque with a gold inner rule. */
export function panel(scene, x, y, w, h, opt = {}) {
  const g = scene.add.graphics();
  const fillCol = opt.fill !== undefined ? opt.fill : 0x140f1c;
  const alpha = opt.alpha !== undefined ? opt.alpha : 0.9;
  g.fillStyle(fillCol, alpha);
  g.fillRect(x, y, w, h);
  g.lineStyle(1, 0x3a2f24, 1);
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.lineStyle(1, opt.edge !== undefined ? opt.edge : INK.goldDim, 1);
  g.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
  // corner studs
  g.fillStyle(INK.gold, 1);
  [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + h - 4], [x + w - 4, y + h - 4]]
    .forEach(([cx, cy]) => g.fillRect(cx, cy, 2, 2));
  return g;
}

/** Thin decorative rule used under headings. */
export function rule(scene, x, y, w, tint = INK.goldDim) {
  const g = scene.add.graphics();
  g.fillStyle(tint, 1);
  g.fillRect(x, y, w, 1);
  g.fillStyle(INK.gold, 1);
  g.fillRect(x + w / 2 - 2, y - 1, 4, 3);
  return g;
}

/**
 * Keyboard + mouse menu. Items are { text, onSelect, enabled, hint, value }.
 * Rendered as centred rows with a moving caret.
 */
export class Menu {
  constructor(scene, x, y, items, opt = {}) {
    this.scene = scene;
    this.items = items;
    this.index = items.findIndex((i) => i.enabled !== false);
    if (this.index < 0) this.index = 0;
    this.spacing = opt.spacing || 16;
    this.size = opt.size || 8;
    this.x = x;
    this.y = y;
    this.audio = getAudio(scene);
    this.rows = [];
    this.locked = false;

    items.forEach((item, i) => {
      const t = label(scene, x, y + i * this.spacing, item.text, this.size);
      t.setOrigin(0.5, 0);
      t.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(0, 0, 1, 1),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: item.enabled !== false
      });
      this.fitHitArea(t);
      t.on('pointerover', () => { if (item.enabled !== false) this.moveTo(i); });
      t.on('pointerdown', () => { if (item.enabled !== false) { this.moveTo(i); this.choose(); } });
      this.rows.push(t);
    });

    this.caretL = label(scene, 0, 0, '>', this.size, INK.gold).setOrigin(0.5, 0);
    this.caretR = label(scene, 0, 0, '<', this.size, INK.gold).setOrigin(0.5, 0);

    this.keys = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D
    });

    this.refresh();
  }

  setText(i, text) {
    this.items[i].text = text;
    this.rows[i].setText(String(text).toUpperCase());
    this.fitHitArea(this.rows[i]);
  }

  /**
   * Make a row tappable well beyond its glyphs - an 8px line of text is far too
   * small a target for a thumb - without overlapping the rows around it.
   */
  fitHitArea(t) {
    const w = Math.max(t.width + 48, 150);
    const padY = Math.max(2, Math.floor((this.spacing - t.height) / 2));
    t.input.hitArea.setTo(t.width / 2 - w / 2, -padY, w, t.height + padY * 2);
  }

  moveTo(i) {
    if (i === this.index) return;
    this.index = i;
    this.audio.play('menu');
    this.refresh();
  }

  step(delta) {
    let n = this.index;
    do {
      n = Phaser.Math.Wrap(n + delta, 0, this.items.length);
    } while (this.items[n].enabled === false && n !== this.index);
    this.moveTo(n);
  }

  choose() {
    const item = this.items[this.index];
    if (!item || item.enabled === false || this.locked) return;
    this.audio.play('select');
    item.onSelect && item.onSelect(item);
  }

  nudge(dir) {
    const item = this.items[this.index];
    if (item && item.onNudge) { this.audio.play('menu'); item.onNudge(dir, item); }
  }

  refresh() {
    this.rows.forEach((t, i) => {
      const it = this.items[i];
      const active = i === this.index;
      t.setTint(it.enabled === false ? INK.dim : active ? INK.gold : INK.parchment);
      t.setAlpha(it.enabled === false ? 0.55 : 1);
    });
    const row = this.rows[this.index];
    if (row) {
      const half = row.width / 2 + 9;
      this.caretL.setPosition(Math.round(this.x - half), Math.round(row.y));
      this.caretR.setPosition(Math.round(this.x + half), Math.round(row.y));
    }
    this.onChange && this.onChange(this.index);
  }

  update() {
    const K = Phaser.Input.Keyboard;
    if (K.JustDown(this.keys.up) || K.JustDown(this.keys.w)) this.step(-1);
    if (K.JustDown(this.keys.down) || K.JustDown(this.keys.s)) this.step(1);
    if (K.JustDown(this.keys.left) || K.JustDown(this.keys.a)) this.nudge(-1);
    if (K.JustDown(this.keys.right) || K.JustDown(this.keys.d)) this.nudge(1);
    if (K.JustDown(this.keys.enter) || K.JustDown(this.keys.space)) this.choose();

    // gentle pulse on the caret
    const p = 0.6 + 0.4 * Math.sin(this.scene.time.now / 220);
    this.caretL.setAlpha(p);
    this.caretR.setAlpha(p);
  }
}

/**
 * The layered palace backdrop shared by every menu screen. Cheap: three
 * tileSprites that drift slowly sideways.
 */
export function menuBackdrop(scene, palette = 'fortress') {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const sky = scene.add.image(0, 0, `sky-${palette}`).setOrigin(0).setDepth(0);
  sky.setDisplaySize(W, H);
  const far = scene.add.tileSprite(0, H - 190, W, 180, `far-${palette}`).setOrigin(0).setDepth(1).setAlpha(0.85);
  const mid = scene.add.tileSprite(0, H - 150, W, 220, `mid-${palette}`).setOrigin(0).setDepth(2).setAlpha(0.9);

  const shade = scene.add.graphics().setDepth(3);
  shade.fillStyle(0x0b0910, 0.45);
  shade.fillRect(0, 0, W, H);

  scene.events.on('update', (time, delta) => {
    far.tilePositionX += delta * 0.004;
    mid.tilePositionX += delta * 0.010;
  });

  return { sky, far, mid, shade };
}

/** Fade the camera out, run a callback, used by every screen transition. */
export function leave(scene, fn, duration = 260) {
  scene.cameras.main.fadeOut(duration, 8, 6, 12);
  scene.cameras.main.once('camerafadeoutcomplete', fn);
}
