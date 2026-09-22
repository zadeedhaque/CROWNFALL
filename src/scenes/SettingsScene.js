import Phaser from 'phaser';
import { label } from '../gfx/PixelFont.js';
import { panel, rule, Menu, menuBackdrop, leave, INK } from '../systems/UiKit.js';
import { getAudio } from '../audio/AudioManager.js';
import Save from '../systems/Save.js';

const onOff = (v) => (v ? 'ON' : 'OFF');

export default class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.fadeIn(200, 8, 6, 12);
    menuBackdrop(this, 'ruin');
    const audio = getAudio(this);

    panel(this, 66, 24, W - 132, H - 60).setDepth(10);
    label(this, W / 2, 34, 'SETTINGS', 8, INK.gold).setOrigin(0.5, 0).setDepth(11);
    rule(this, 96, 48, W - 192).setDepth(11);

    const toggle = (key, apply) => (dir, item) => {
      const next = !Save.settings[key];
      Save.setSetting(key, next);
      apply(next);
      item.text = item.base + '   ' + onOff(next);
      this.menu.setText(this.menu.index, item.text);
    };

    const mk = (base, key, apply) => {
      const item = {
        base,
        text: base + '   ' + onOff(Save.settings[key]),
        onNudge: null,
        onSelect: null
      };
      const fn = toggle(key, apply);
      item.onNudge = fn;
      item.onSelect = () => fn(1, item);
      return item;
    };

    const items = [
      mk('MUSIC', 'music', (v) => {
        audio.setMusicEnabled(v);
        if (v) audio.startMusic('ruin'); else audio.stopMusic();
      }),
      mk('SOUND EFFECTS', 'sfx', (v) => audio.setSfxEnabled(v)),
      mk('SCREEN SHAKE', 'shake', () => {}),
      mk('IN-LEVEL HINTS', 'hints', () => {}),
      {
        text: 'ERASE PROGRESS',
        onSelect: (item) => {
          if (item.armed) {
            Save.reset();
            audio.setMusicEnabled(Save.settings.music);
            audio.setSfxEnabled(Save.settings.sfx);
            item.armed = false;
            this.menu.setText(this.menu.index, 'PROGRESS ERASED');
            this.time.delayedCall(1200, () => this.menu.setText(4, 'ERASE PROGRESS'));
          } else {
            item.armed = true;
            this.menu.setText(this.menu.index, 'ERASE PROGRESS?  CONFIRM');
            this.time.delayedCall(2600, () => {
              if (item.armed) { item.armed = false; this.menu.setText(4, 'ERASE PROGRESS'); }
            });
          }
        }
      },
      { text: 'BACK', onSelect: () => leave(this, () => this.scene.start('Menu'), 180) }
    ];

    this.menu = new Menu(this, W / 2, 60, items, { spacing: 16 });
    this.menu.rows.forEach((r) => r.setDepth(11));
    this.menu.caretL.setDepth(11);
    this.menu.caretR.setDepth(11);

    label(this, W / 2, H - 28, 'LEFT / RIGHT OR ENTER TO TOGGLE', 8, INK.dim).setOrigin(0.5, 0).setDepth(11);

    this.input.keyboard.on('keydown-ESC', () => leave(this, () => this.scene.start('Menu'), 180));
  }

  update() { this.menu.update(); }
}
