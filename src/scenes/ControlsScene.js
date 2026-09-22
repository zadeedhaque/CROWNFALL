import Phaser from 'phaser';
import { label } from '../gfx/PixelFont.js';
import { panel, rule, menuBackdrop, leave, INK } from '../systems/UiKit.js';

const ROWS = [
  ['A / D  OR  ARROWS', 'MOVE'],
  ['SHIFT', 'RUN'],
  ['SPACE', 'JUMP'],
  ['S', 'CROUCH / DROP'],
  ['W  OR  E', 'PULL UP / INTERACT'],
  ['R', 'RESTART LEVEL'],
  ['ESC', 'PAUSE']
];

const NOTES = [
  'HOLD A WALL IN MID-AIR, THEN JUMP AGAIN',
  'JUMP AT A HIGH LIP TO CATCH AND CLIMB IT',
  'RUN AT A LOW WALL TO VAULT STRAIGHT OVER',
  'S WHILE HANGING LETS GO'
];

export default class ControlsScene extends Phaser.Scene {
  constructor() { super('Controls'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.fadeIn(200, 8, 6, 12);
    menuBackdrop(this, 'sand');

    panel(this, 46, 16, W - 92, H - 44).setDepth(10);
    label(this, W / 2, 26, 'CONTROLS', 8, INK.gold).setOrigin(0.5, 0).setDepth(11);
    rule(this, 80, 40, W - 160).setDepth(11);

    ROWS.forEach((r, i) => {
      const y = 50 + i * 13;
      label(this, 72, y, r[0], 8, INK.parchment).setOrigin(0, 0).setDepth(11);
      label(this, W - 72, y, r[1], 8, INK.teal).setOrigin(1, 0).setDepth(11);
    });

    rule(this, 80, 145, W - 160).setDepth(11);
    NOTES.forEach((n, i) => {
      label(this, W / 2, 156 + i * 11, n, 8, INK.dim).setOrigin(0.5, 0).setDepth(11);
    });

    label(this, W / 2, H - 22, 'ESC  OR  ENTER  -  BACK', 8, INK.goldDim).setOrigin(0.5, 0).setDepth(11);

    const back = () => leave(this, () => this.scene.start('Menu'), 180);
    this.input.keyboard.on('keydown-ESC', back);
    this.input.keyboard.on('keydown-ENTER', back);
    this.input.keyboard.on('keydown-SPACE', back);
    this.input.on('pointerdown', back);
  }
}
