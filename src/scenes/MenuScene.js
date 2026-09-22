import Phaser from 'phaser';
import { GAME } from '../config.js';
import { label } from '../gfx/PixelFont.js';
import { Menu, menuBackdrop, leave, INK } from '../systems/UiKit.js';
import { getAudio } from '../audio/AudioManager.js';
import Save from '../systems/Save.js';

export default class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.fadeIn(320, 8, 6, 12);
    menuBackdrop(this, 'fortress');

    const audio = getAudio(this);
    audio.unlock();
    if (Save.settings.music) audio.startMusic('fortress');
    this.input.once('pointerdown', () => { audio.unlock(); if (Save.settings.music) audio.startMusic('fortress'); });
    this.input.keyboard.once('keydown', () => { audio.unlock(); if (Save.settings.music) audio.startMusic('fortress'); });

    const crest = this.add.image(W / 2, 46, 'ui-crest').setDepth(10);
    this.tweens.add({ targets: crest, y: 48, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const glow = this.add.image(W / 2, 46, 'ui-glow').setDepth(9).setScale(1.9).setAlpha(0.7);
    this.tweens.add({ targets: glow, alpha: 0.35, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const title = label(this, W / 2, 76, GAME.TITLE, 16, INK.gold).setOrigin(0.5, 0).setDepth(10);
    const shadow = label(this, W / 2 + 1, 77, GAME.TITLE, 16, 0x2a1418).setOrigin(0.5, 0).setDepth(9);

    label(this, W / 2, 98, 'A PARKOUR TALE OF THE LAST CROWN', 8, INK.dim).setOrigin(0.5, 0).setDepth(10);

    const items = [
      { text: 'START GAME', onSelect: () => leave(this, () => this.scene.start('LevelSelect')) },
      { text: 'CONTROLS', onSelect: () => leave(this, () => this.scene.start('Controls'), 180) },
      { text: 'SETTINGS', onSelect: () => leave(this, () => this.scene.start('Settings'), 180) }
    ];
    this.menu = new Menu(this, W / 2, 138, items, { spacing: 18, size: 8 });
    this.menu.rows.forEach((r) => r.setDepth(10));
    this.menu.caretL.setDepth(10);
    this.menu.caretR.setDepth(10);

    const done = Save.state.completed.length;
    label(this, W / 2, H - 26, done ? `${done} OF 3 CHAPTERS CLEARED` : 'NO ENEMIES. NO WEAPONS. ONLY THE CLIMB.', 8, INK.dim)
      .setOrigin(0.5, 0).setDepth(10);
    label(this, W / 2, H - 14, 'ARROWS OR W S TO CHOOSE - ENTER TO CONFIRM', 8, 0x5d5044)
      .setOrigin(0.5, 0).setDepth(10);

    // a lone torch flickering in the corner for atmosphere
    const torch = this.add.sprite(30, H - 40, 'torch-fortress', 0).setDepth(6).setScale(2);
    if (!this.anims.exists('menu-torch')) {
      this.anims.create({
        key: 'menu-torch',
        frames: this.anims.generateFrameNumbers('torch-fortress', { start: 0, end: 2 }),
        frameRate: 9, repeat: -1
      });
    }
    torch.play('menu-torch');
    this.add.image(30, H - 58, 'ui-glow').setDepth(5).setAlpha(0.5).setScale(1.4);

    this.tweens.add({ targets: [title, shadow], alpha: { from: 0, to: 1 }, duration: 600 });
  }

  update() { this.menu.update(); }
}
