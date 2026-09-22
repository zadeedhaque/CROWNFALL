import Phaser from 'phaser';
import { label } from '../gfx/PixelFont.js';
import { panel, rule, Menu, menuBackdrop, leave, INK } from '../systems/UiKit.js';
import Save, { formatTime } from '../systems/Save.js';
import { levelByKey } from '../levels/index.js';

export default class LevelCompleteScene extends Phaser.Scene {
  constructor() { super('LevelComplete'); }

  init(data) { this.data2 = data; }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const d = this.data2;
    const def = levelByKey(d.levelKey);
    this.cameras.main.fadeIn(420, 8, 6, 12);
    menuBackdrop(this, def.palette);

    panel(this, 92, 34, W - 184, H - 78).setDepth(10);
    label(this, W / 2, 44, 'CHAPTER CLEARED', 8, INK.gold).setOrigin(0.5, 0).setDepth(11);
    label(this, W / 2, 58, def.name, 16, INK.parchment).setOrigin(0.5, 0).setDepth(11);
    rule(this, 120, 82, W - 240).setDepth(11);

    const best = Save.best(d.levelKey);
    const isRecord = best !== null && Math.abs(best - d.time) < 1;

    const stat = (y, k, v, tint) => {
      label(this, 120, y, k, 8, INK.dim).setOrigin(0, 0).setDepth(11);
      label(this, W - 120, y, v, 8, tint || INK.parchment).setOrigin(1, 0).setDepth(11);
    };
    stat(92, 'TIME', formatTime(d.time), isRecord ? INK.gold : INK.parchment);
    stat(104, 'BEST', formatTime(best), INK.teal);
    stat(116, 'FALLS', String(d.deaths), d.deaths === 0 ? INK.gold : INK.parchment);

    if (isRecord) {
      const nr = label(this, W / 2, 130, 'NEW BEST TIME', 8, INK.gold).setOrigin(0.5, 0).setDepth(11);
      this.tweens.add({ targets: nr, alpha: 0.3, duration: 620, yoyo: true, repeat: -1 });
    }
    if (d.deaths === 0) {
      label(this, W / 2, 130 + (isRecord ? 11 : 0), 'NOT ONE FALL', 8, INK.teal).setOrigin(0.5, 0).setDepth(11);
    }

    const items = [];
    if (d.nextKey) {
      items.push({
        text: 'NEXT CHAPTER',
        onSelect: () => leave(this, () => this.scene.start('Game', { levelKey: d.nextKey }))
      });
    } else {
      items.push({
        text: 'SEE THE DAWN',
        onSelect: () => leave(this, () => this.scene.start('Finale'))
      });
    }
    items.push({ text: 'RETRY CHAPTER', onSelect: () => leave(this, () => this.scene.start('Game', { levelKey: d.levelKey })) });
    items.push({ text: 'LEVEL SELECT', onSelect: () => leave(this, () => this.scene.start('LevelSelect'), 200) });

    this.menu = new Menu(this, W / 2, 158, items, { spacing: 15 });
    this.menu.rows.forEach((r) => r.setDepth(11));
    this.menu.caretL.setDepth(11);
    this.menu.caretR.setDepth(11);
  }

  update() { this.menu.update(); }
}
