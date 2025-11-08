import Phaser from 'phaser';
import { TILE_H } from '@config/game';

/**
 * A custom sprite for representing a unit on the isometric grid.
 *
 * It automatically adjusts its depth based on its y-coordinate to ensure
 * correct layering with other objects in the scene. The origin is set to
 * the bottom-center, so that the sprite's `y` position corresponds to its "feet",
 * which is crucial for correct depth sorting.
 */
export class UnitSprite extends Phaser.GameObjects.Sprite {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string | Phaser.Textures.Texture,
    frame?: string | number,
  ) {
    super(scene, x, y, texture, frame);

    // Set the origin to the bottom-center of the sprite.
    // This makes depth sorting based on the 'y' coordinate work correctly,
    // as it represents the position of the unit's "feet" on the ground.
    // The vertical offset helps position the sprite correctly above the tile center.
    this.setOrigin(0.5, 1);
  }

  /**
   * Overrides the base setPosition to automatically update the sprite's depth.
   * In Phaser, a higher depth value means the object is rendered on top.
   * By setting depth equal to the y-coordinate, objects that are lower on
   * the screen (further "south" in the iso view) will be drawn over objects
   * that are higher up.
   */
  setPosition(x: number, y: number): this {
    super.setPosition(x, y);

    // The depth is set to the y-coordinate of the sprite's base.
    // We add a small offset based on the tile height to ensure units are
    // drawn "on top" of the tiles they occupy.
    this.setDepth(y + TILE_H);

    return this;
  }
}
