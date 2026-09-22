import Phaser from 'phaser';
import { GAME } from './config.js';

import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import ControlsScene from './scenes/ControlsScene.js';
import SettingsScene from './scenes/SettingsScene.js';
import LevelSelectScene from './scenes/LevelSelectScene.js';
import GameScene from './scenes/GameScene.js';
import PauseScene from './scenes/PauseScene.js';
import LevelCompleteScene from './scenes/LevelCompleteScene.js';
import FinaleScene from './scenes/FinaleScene.js';

const config = {
  type: Phaser.WEBGL,
  parent: 'game',
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  backgroundColor: '#0b0910',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  powerPreference: 'high-performance',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Cap the backing store so huge monitors do not pay for pixels nobody sees.
    max: { width: GAME.WIDTH * 5, height: GAME.HEIGHT * 5 }
  },
  fps: { target: 60, min: 30, forceSetTimeOut: false },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },   // gravity is applied per-body so platforms stay weightless
      debug: false,
      tileBias: 20,
      fps: 60
    }
  },
  render: { mipmapFilter: 'NEAREST' },
  scene: [
    BootScene, MenuScene, ControlsScene, SettingsScene,
    LevelSelectScene, GameScene, PauseScene, LevelCompleteScene, FinaleScene
  ]
};

const game = new Phaser.Game(config);

// Handy during development: inspect scenes and the player from the console.
if (import.meta.env && import.meta.env.DEV) window.game = game;

game.events.once('ready', () => {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('hidden');
    setTimeout(() => splash.remove(), 600);
  }
});

// Keep the browser from scrolling / triggering quick-find while playing.
window.addEventListener('keydown', (e) => {
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', "'", '/'].includes(e.key)) {
    e.preventDefault();
  }
}, { passive: false });

export default game;
