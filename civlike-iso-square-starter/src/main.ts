import Phaser from 'phaser';
import { BootScene } from '@platform/phaser/BootScene';
import { StartScene } from '@platform/phaser/StartScene';
import { CivilizationSelectionScene } from '@platform/phaser/CivilizationSelectionScene';
import { GameScene } from '@platform/phaser/GameScene';
import { mountHud } from '@/ui/mount';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  scene: [BootScene, StartScene, CivilizationSelectionScene, GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: true,
    antialias: true,
    antialiasGL: true,
  },
};

const game = new Phaser.Game(config);

// Mount the React HUD
// The `game` instance can be passed to the UI layer if needed,
// for example, to allow UI components to push intents into the game world.
mountHud(game);
