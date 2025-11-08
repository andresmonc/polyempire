import Phaser from 'phaser';

/**
 * The BootScene is responsible for preloading all essential assets
 * that are needed for the entire game. This includes JSON data files,
 * placeholder textures, and UI assets.
 *
 * Once everything is loaded, it transitions to the main `GameScene`.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Load data files
    this.load.json('terrains', 'data/terrains.json');
    this.load.json('units', 'data/units.json');
    this.load.json('map', 'data/map.sample.json');

    // Load placeholder textures
    this.load.image('unit', 'assets/textures/unit.png');

    // TODO: Load font assets if you have any
  }

  create() {
    this.scene.start('GameScene');
  }
}
