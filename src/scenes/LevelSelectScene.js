import Phaser from 'phaser';
import { label } from '../gfx/PixelFont.js';
import { panel, rule, Menu, menuBackdrop, leave, INK } from '../systems/UiKit.js';
import Save, { formatTime } from '../systems/Save.js';
import { LEVELS } from '../levels/index.js';

export default class LevelSelectScene extends Phaser.Scene {
  constructor() { super('LevelSelect'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.fadeIn(220, 8, 6, 12);
    menuBackdrop(this, 'sand');

    panel(this, 40, 18, W - 80, H - 48).setDepth(10);
    label(this, W / 2, 28, 'CHOOSE A CHAPTER', 8, INK.gold).setOrigin(0.5, 0).setDepth(11);
    rule(this, 80, 42, W - 160).setDepth(11);

    const items = LEVELS.map((lv, i) => {
      const unlocked = Save.unlocked(i + 1);
      const done = Save.state.completed.includes(lv.key);
      const mark = done ? '*' : unlocked ? '-' : '!';
      return {
        text: `${mark} ${i + 1}. ${unlocked ? lv.name : 'SEALED'}`,
        enabled: unlocked,
        onSelect: () => leave(this, () => this.scene.start('Game', { levelKey: lv.key })),
        level: lv,
        index: i
      };
    });
    items.push({ text: 'BACK TO MENU', onSelect: () => leave(this, () => this.scene.start('Menu'), 180) });

    this.menu = new Menu(this, W / 2, 56, items, { spacing: 17 });
    this.menu.rows.forEach((r) => r.setDepth(11));
    this.menu.caretL.setDepth(11);
    this.menu.caretR.setDepth(11);

    this.detailTitle = label(this, W / 2, 132, '', 8, INK.parchment).setOrigin(0.5, 0).setDepth(11);
    this.detailTeach = label(this, W / 2, 146, '', 8, INK.teal).setOrigin(0.5, 0).setDepth(11);
    this.detailBest = label(this, W / 2, 160, '', 8, INK.dim).setOrigin(0.5, 0).setDepth(11);

    this.menu.onChange = (i) => this.showDetail(items[i]);
    this.showDetail(items[this.menu.index]);

    const total = Save.totalBest();
    label(this, W / 2, H - 24, total ? `FULL RUN BEST  ${formatTime(total)}` : 'CLEAR ALL THREE TO SET A FULL-RUN TIME', 8, 0x5d5044)
      .setOrigin(0.5, 0).setDepth(11);

    this.input.keyboard.on('keydown-ESC', () => leave(this, () => this.scene.start('Menu'), 180));
  }

  showDetail(item) {
    if (!item || !item.level) {
      this.detailTitle.setText('');
      this.detailTeach.setText('');
      this.detailBest.setText('');
      return;
    }
    const unlocked = Save.unlocked(item.index + 1);
    this.detailTitle.setText(unlocked ? item.level.subtitle : 'CLEAR THE CHAPTER BEFORE IT');
    this.detailTeach.setText(unlocked ? item.level.teaches.join('  -  ') : '');
    const best = Save.best(item.level.key);
    this.detailBest.setText(unlocked ? (best ? `BEST  ${formatTime(best)}` : 'NOT YET CLEARED') : '');
  }

  update() { this.menu.update(); }
}
