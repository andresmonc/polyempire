import Phaser from 'phaser';
import { World, Entity } from '@engine/ecs';
import * as Components from '@engine/gameplay/components';
import { FogOfWar } from '@engine/map/FogOfWar';
import { GameState } from '@/state/GameState';
import { tileToWorld } from '@engine/math/iso';
import { TILE_H, TILE_W, FOG_COLOR, FOG_ALPHA_REVEALED, FOG_ALPHA_UNREVEALED } from '@config/game';

/**
 * Handles rendering of fog of war overlays
 */
export class FogRenderer {
  private scene: Phaser.Scene;
  private ecsWorld: World;
  private fogOfWar: FogOfWar;
  private gameState: GameState;
  private fogLayer!: Phaser.GameObjects.Container;
  private tileSprites: Map<Entity, any>; // IsoTileSprite

  constructor(
    scene: Phaser.Scene,
    ecsWorld: World,
    fogOfWar: FogOfWar,
    gameState: GameState,
    tileSprites: Map<Entity, any>,
  ) {
    this.scene = scene;
    this.ecsWorld = ecsWorld;
    this.fogOfWar = fogOfWar;
    this.gameState = gameState;
    this.tileSprites = tileSprites;
  }

  /**
   * Initialize the fog layer (must be called after scene is created)
   */
  initialize(): void {
    this.fogLayer = this.scene.add.container(0, 0);
    this.fogLayer.setDepth(10000); // Very high depth to ensure it's on top
  }

  /**
   * Update fog rendering for all tiles
   */
  update(): void {
    if (!this.fogLayer) {
      return; // Fog layer not initialized yet
    }

    const entities = this.ecsWorld.view(Components.Tile, Components.TransformTile);
    
    // Clear existing fog overlays
    this.fogLayer.removeAll(true);
    
    for (const entity of entities) {
      const sprite = this.tileSprites.get(entity);
      const transform = this.ecsWorld.getComponent(entity, Components.TransformTile)!;
      if (sprite) {
        // Use local player's fog state for rendering
        const playerId = this.gameState.localPlayerId;
        const isVisible = this.fogOfWar.isVisible(transform.tx, transform.ty, playerId);
        const isRevealed = this.fogOfWar.isRevealed(transform.tx, transform.ty, playerId);
        
        // Update tile sprite fog (for backwards compatibility)
        sprite.updateFog(isVisible, isRevealed);
        
        // Create fog overlay in separate layer that renders on top
        if (!isVisible) {
          const worldPos = tileToWorld(transform);
          const fogOverlay = this.scene.add.graphics();
          const alpha = isRevealed ? FOG_ALPHA_REVEALED : FOG_ALPHA_UNREVEALED;
          
          const points = [
            { x: 0, y: -TILE_H / 2 },
            { x: TILE_W / 2, y: 0 },
            { x: 0, y: TILE_H / 2 },
            { x: -TILE_W / 2, y: 0 },
          ];
          
          fogOverlay.fillStyle(FOG_COLOR, 1);
          fogOverlay.beginPath();
          fogOverlay.moveTo(points[0].x, points[0].y);
          fogOverlay.lineTo(points[1].x, points[1].y);
          fogOverlay.lineTo(points[2].x, points[2].y);
          fogOverlay.lineTo(points[3].x, points[3].y);
          fogOverlay.closePath();
          fogOverlay.fillPath();
          fogOverlay.setAlpha(alpha);
          fogOverlay.setPosition(worldPos.x, worldPos.y);
          this.fogLayer.add(fogOverlay);
        }
      }
    }
  }
}

