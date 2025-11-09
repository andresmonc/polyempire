import Phaser from 'phaser';
import { TILE_H, TILE_W } from '@config/game';

/**
 * A custom sprite for representing a city on the isometric grid.
 * Tries to load a texture first, falls back to a simple icon if the texture doesn't exist.
 */
export class CitySprite extends Phaser.GameObjects.Container {
  private cityIcon: Phaser.GameObjects.GameObject | null = null;
  private cityImage: Phaser.GameObjects.Image | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string = 'city',
  ) {
    super(scene, x, y);

    // Try to use a texture if it exists, otherwise fall back to icon
    if (scene.textures.exists(textureKey)) {
      // Use texture sprite
      const cityImage = scene.add.image(0, -TILE_H / 4, textureKey);
      // Scale to fit within tile bounds
      const maxSize = Math.min(TILE_W * 0.6, TILE_H * 0.8);
      const scale = Math.min(maxSize / cityImage.width, maxSize / cityImage.height);
      cityImage.setScale(scale);
      cityImage.setOrigin(0.5, 0.5);
      this.cityImage = cityImage;
      this.add(cityImage);
    } else {
      // Fallback to icon
      this.createIcon(scene);
    }

    // Set depth to be above tiles but below units
    this.setDepth(y + TILE_H / 2);
  }

  /**
   * Creates a fallback icon when no texture is available.
   */
  private createIcon(scene: Phaser.Scene): void {
    // Create a simple city icon (circle with a smaller circle inside)
    const outerCircle = scene.add.circle(0, -TILE_H / 4, TILE_W / 3, 0x8b4513, 0.9); // Brown city
    const innerCircle = scene.add.circle(0, -TILE_H / 4, TILE_W / 6, 0xffd700, 0.9); // Gold center
    
    // Add a small flag/building on top
    const flag = scene.add.rectangle(0, -TILE_H / 2, TILE_W / 8, TILE_H / 4, 0xff0000, 0.9);
    
    this.cityIcon = outerCircle;
    this.add(outerCircle);
    this.add(innerCircle);
    this.add(flag);
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

