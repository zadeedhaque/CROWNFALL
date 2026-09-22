import Phaser from 'phaser';
import { createPixelFont, label } from '../gfx/PixelFont.js';
import { createHeroTexture, createHeroAnimations } from '../gfx/HeroFactory.js';
import { generateAll } from '../gfx/ArtFactory.js';
import { getAudio } from '../audio/AudioManager.js';
import Save from '../systems/Save.js';
import { GAME, PALETTES } from '../config.js';

/**
 * Builds every texture the game needs. Generation is split across frames so the
 * loading bar actually animates instead of the tab locking up.
 */
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.setBackgroundColor('#0b0910');

    createPixelFont(this);

    const title = label(this, W / 2, H / 2 - 26, GAME.TITLE, 8, 0xe8bc5a).setOrigin(0.5);
    const sub = label(this, W / 2, H / 2 - 12, 'CARVING THE STONE', 8, 0x7b6a58).setOrigin(0.5);

    const barW = 160;
    const barX = Math.round((W - barW) / 2);
    const barY = Math.round(H / 2 + 8);
    const frame = this.add.graphics();
    frame.lineStyle(1, 0x3a2f24, 1).strokeRect(barX - 1.5, barY - 1.5, barW + 3, 7);
    const bar = this.add.graphics();

    const steps = [
      () => generateAll(this),
      () => createHeroTexture(this),
      () => createHeroAnimations(this),
      () => {
        const audio = getAudio(this);
        audio.setMusicEnabled(Save.settings.music);
        audio.setSfxEnabled(Save.settings.sfx);
      }
    ];

    let done = 0;
    const total = steps.length;

    const run = () => {
      if (done >= total) {
        sub.setText('READY');
        this.time.delayedCall(140, () => this.scene.start('Menu'));
        return;
      }
      steps[done]();
      done++;
      bar.clear().fillStyle(0xe8bc5a, 1).fillRect(barX, barY, Math.round(barW * (done / total)), 4);
      this.time.delayedCall(16, run);
    };

    // one frame of breathing room so the bar paints before work begins
    this.time.delayedCall(30, run);

    // Any key or click unlocks WebAudio (browsers require a gesture).
    const unlock = () => getAudio(this).unlock();
    this.input.keyboard.once('keydown', unlock);
    this.input.once('pointerdown', unlock);

    // Warn once if the palette config and art generator ever drift apart.
    if (!Object.keys(PALETTES).length) console.warn('No palettes configured');
  }
}
