import Phaser from 'phaser';
import { label } from '../gfx/PixelFont.js';
import { panel, rule, Menu, INK } from '../systems/UiKit.js';
import { getAudio } from '../audio/AudioManager.js';
import Save from '../systems/Save.js';

/** Overlay scene; GameScene stays alive underneath, simply paused. */
export default class PauseScene extends Phaser.Scene {
  constructor() { super('Pause'); }

  init(data) { this.levelKey = (data && data.levelKey) || 'level1'; }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const audio = getAudio(this);

    const dim = this.add.graphics();
    dim.fillStyle(0x0b0910, 0.72);
    dim.fillRect(0, 0, W, H);

    panel(this, 132, 56, W - 264, 152);
    label(this, W / 2, 68, 'PAUSED', 8, INK.gold).setOrigin(0.5, 0);
    rule(this, 150, 82, W - 300);

    const items = [
      { text: 'RESUME', onSelect: () => this.resumeGame() },
      {
        text: 'RESTART LEVEL',
        onSelect: () => {
          const game = this.scene.get('Game');
          this.scene.resume('Game');
          this.scene.stop();
          game.restartLevel();
        }
      },
      { text: 'LEVEL SELECT', onSelect: () => { this.scene.stop('Game'); this.scene.start('LevelSelect'); } },
      {
        text: 'MUSIC  ' + (Save.settings.music ? 'ON' : 'OFF'),
        onSelect: (item) => {
          const next = !Save.settings.music;
          Save.setSetting('music', next);
          audio.setMusicEnabled(next);
          if (next) audio.startMusic(this.scene.get('Game').def.palette); else audio.stopMusic();
          this.menu.setText(this.menu.index, 'MUSIC  ' + (next ? 'ON' : 'OFF'));
        }
      },
      { text: 'MAIN MENU', onSelect: () => { this.scene.stop('Game'); this.scene.start('Menu'); } }
    ];

    this.menu = new Menu(this, W / 2, 92, items, { spacing: 16 });

    label(this, W / 2, H - 34, 'ESC TO RESUME', 8, INK.dim).setOrigin(0.5, 0);

    this.input.keyboard.on('keydown-ESC', () => this.resumeGame());
  }

  resumeGame() {
    this.scene.resume('Game');
    this.scene.stop();
  }

  update() { this.menu.update(); }
}
