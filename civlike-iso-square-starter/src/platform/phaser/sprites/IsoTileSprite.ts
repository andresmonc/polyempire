import Phaser from 'phaser';
import {
  TILE_H,
  TILE_W,
  FOG_ALPHA_REVEALED,
  FOG_ALPHA_UNREVEALED,
  FOG_COLOR,
} from '@config/game';
import { Terrain } from '@engine/map/Terrain';
import { isoToWorld } from '@engine/math/iso';

/**
 * A custom Game Object for rendering a single isometric tile.
 * It handles drawing the base terrain color and the fog of war overlay.
 * This extends Container, making it a renderable object that can hold other objects.
 */
export class IsoTileSprite extends Phaser.GameObjects.Container {
  private fogOverlay: Phaser.GameObjects.Polygon;

  constructor(
    scene: Phaser.Scene,
    tx: number,
    ty: number,
    terrain: Terrain,
  ) {
    const worldPos = isoToWorld(tx, ty);
    super(scene, worldPos.x, worldPos.y);

    // --- Define the diamond shape, relative to the container's origin (0,0) ---
    const points = [
      { x: 0, y: -TILE_H / 2 }, // Top
      { x: TILE_W / 2, y: 0 }, // Right
      { x: 0, y: TILE_H / 2 }, // Bottom
      { x: -TILE_W / 2, y: 0 }, // Left
    ];

    // --- Create children and add them to this container ---
    // Base terrain polygon with stroke for tile borders
    const poly = scene.add
      .polygon(0, 0, points, parseInt(terrain.color, 16))
      .setStrokeStyle(1, 0x333333);
    this.add(poly);

    this.fogOverlay = scene.add
      .polygon(0, 0, points, FOG_COLOR)
      .setAlpha(FOG_ALPHA_UNREVEALED);
    this.add(this.fogOverlay);
  }

  /**
   * Updates the visibility of the tile based on the fog of war status.
   * @param isVisible - Is the tile currently in a unit's line of sight?
   * @param isRevealed - Has the tile ever been seen?
   */
  public updateFog(isVisible: boolean, isRevealed: boolean) {
    if (isVisible) {
      this.fogOverlay.setAlpha(0); // Completely clear
    } else if (isRevealed) {
      this.fogOverlay.setAlpha(FOG_ALPHA_REVEALED); // Dim overlay
    } else {
      this.fogOverlay.setAlpha(FOG_ALPHA_UNREVEALED); // Dark shroud
    }
  }
}

