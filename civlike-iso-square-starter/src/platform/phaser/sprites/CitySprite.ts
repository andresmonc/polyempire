import Phaser from 'phaser';
import { TILE_H, TILE_W } from '@config/game';

/**
 * A custom sprite for representing a city on the isometric grid.
 * Uses a simple circle shape for now, but can be extended to use a texture.
 */
export class CitySprite extends Phaser.GameObjects.Container {
  private cityIcon: Phaser.GameObjects.Arc;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    super(scene, x, y);

    // Create a simple city icon (circle with a smaller circle inside)
    const outerCircle = scene.add.circle(0, -TILE_H / 4, TILE_W / 3, 0x8b4513, 0.9); // Brown city
    const innerCircle = scene.add.circle(0, -TILE_H / 4, TILE_W / 6, 0xffd700, 0.9); // Gold center
    
    // Add a small flag/building on top
    const flag = scene.add.rectangle(0, -TILE_H / 2, TILE_W / 8, TILE_H / 4, 0xff0000, 0.9);
    
    this.cityIcon = outerCircle;
    this.add(outerCircle);
    this.add(innerCircle);
    this.add(flag);

    // Set depth to be above tiles but below units
    this.setDepth(y + TILE_H / 2);
  }

  /**
   * Updates the sprite's position and depth.
   */
  setPosition(x: number, y: number): this {
    super.setPosition(x, y);
    this.setDepth(y + TILE_H / 2);
    return this;
  }
}

