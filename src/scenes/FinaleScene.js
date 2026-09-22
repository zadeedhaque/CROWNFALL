import Phaser from 'phaser';
import { GAME } from '../config.js';
import { label } from '../gfx/PixelFont.js';
import { panel, rule, Menu, menuBackdrop, leave, INK } from '../systems/UiKit.js';
import Save, { formatTime } from '../systems/Save.js';
import { LEVELS } from '../levels/index.js';

export default class FinaleScene extends Phaser.Scene {
  constructor() { super('Finale'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.fadeIn(900, 8, 6, 12);
    menuBackdrop(this, 'sand');

    // dawn light breaking over the palace
    const glow = this.add.image(W / 2, H / 2 + 20, 'ui-glow').setDepth(4).setScale(7).setAlpha(0);
    this.tweens.add({ targets: glow, alpha: 0.55, duration: 2600, ease: 'Sine.Out' });

    panel(this, 86, 26, W - 172, H - 62).setDepth(10);
    label(this, W / 2, 36, GAME.TITLE, 8, INK.dim).setOrigin(0.5, 0).setDepth(11);
    const title = label(this, W / 2, 50, 'YOU ARE OUT', 16, INK.gold).setOrigin(0.5, 0).setDepth(11);
    this.tweens.add({ targets: title, alpha: { from: 0, to: 1 }, duration: 1200 });
    rule(this, 116, 76, W - 232).setDepth(11);

    label(this, W / 2, 86, 'THREE WALLS, NO WEAPON DRAWN.', 8, INK.parchment).setOrigin(0.5, 0).setDepth(11);
    label(this, W / 2, 97, 'THE SAND KEEPS THE REST OF THE STORY.', 8, INK.parchment).setOrigin(0.5, 0).setDepth(11);

    LEVELS.forEach((lv, i) => {
      const y = 116 + i * 12;
      label(this, 116, y, `${i + 1}. ${lv.name}`, 8, INK.dim).setOrigin(0, 0).setDepth(11);
      label(this, W - 116, y, formatTime(Save.best(lv.key)), 8, INK.teal).setOrigin(1, 0).setDepth(11);
    });

    const total = Save.totalBest();
    rule(this, 116, 154, W - 232).setDepth(11);
    label(this, 116, 160, 'FULL RUN', 8, INK.gold).setOrigin(0, 0).setDepth(11);
    label(this, W - 116, 160, formatTime(total), 8, INK.gold).setOrigin(1, 0).setDepth(11);

    const items = [
      { text: 'LEVEL SELECT', onSelect: () => leave(this, () => this.scene.start('LevelSelect'), 220) },
      { text: 'MAIN MENU', onSelect: () => leave(this, () => this.scene.start('Menu'), 220) }
    ];
    this.menu = new Menu(this, W / 2, 182, items, { spacing: 14 });
    this.menu.rows.forEach((r) => r.setDepth(11));
    this.menu.caretL.setDepth(11);
    this.menu.caretR.setDepth(11);

    label(this, W / 2, H - 18, 'ART, MUSIC AND CODE GENERATED FOR THIS GAME', 8, 0x4e4238)
      .setOrigin(0.5, 0).setDepth(11);
  }

  update() { this.menu.update(); }
}
