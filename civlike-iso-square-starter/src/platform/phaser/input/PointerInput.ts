import { World, Entity } from '@engine/ecs';
import { worldToTile, isoToWorld } from '@engine/math/iso';
import { GameState } from '@/state/GameState';
import { IntentQueue } from '@/state/IntentQueue';
import Phaser from 'phaser';
import { Unit, TransformTile, ScreenPos } from '@engine/gameplay/components';

/**
 * Handles pointer input from Phaser and translates it into game intents.
 * This class decouples the raw Phaser input events from the game's logic.
 */
export class PointerInput {
  constructor(
    private scene: Phaser.Scene,
    private intents: IntentQueue,
    private world: World,
    private gameState: GameState,
  ) {
    this.scene.input.on(
      Phaser.Input.Events.POINTER_UP,
      this.handlePointerUp,
      this,
    );
  }

  private handlePointerUp = (pointer: Phaser.Input.Pointer) => {
    if (pointer.rightButtonReleased()) {
      this.handleRightClick();
      return;
    }

    // Get the clicked position in world coordinates
    // Use getWorldPoint to properly convert screen coordinates to world coordinates
    const worldPoint = this.scene.cameras.main.getWorldPoint(
      pointer.x,
      pointer.y,
    );

    // Convert world coordinates to the logical tile coordinates
    const targetTile = worldToTile(worldPoint.x, worldPoint.y);

    // Check if a unit was clicked - try both tile-based and sprite-based detection
    let clickedUnit = this.findUnitAt(targetTile.tx, targetTile.ty);
    
    // If no unit found by tile, try checking sprite bounds (for more forgiving click detection)
    if (clickedUnit === null) {
      clickedUnit = this.findUnitBySpriteBounds(worldPoint.x, worldPoint.y);
    }

    if (clickedUnit !== null) {
      // A unit was clicked, so select it
      this.intents.push({
        type: 'SelectEntity',
        payload: { entity: clickedUnit },
      });
    } else {
      // A tile was clicked. If a unit is already selected, issue a move command.
      const selectedEntity = this.gameState.selectedEntity;
      if (selectedEntity !== null) {
        this.intents.push({
          type: 'MoveTo',
          payload: { entity: selectedEntity, target: targetTile },
        });
      }
    }
  };

  private handleRightClick() {
    // On right click, deselect the current unit
    this.intents.push({
      type: 'SelectEntity',
      payload: { entity: null },
    });
  }

  /**
   * Finds the first unit entity located at a given tile coordinate.
   * @returns The entity ID of the unit, or null if no unit is found.
   */
  private findUnitAt(tx: number, ty: number): Entity | null {
    // This is a simple linear search. For a large number of units,
    // a spatial partitioning system (e.g., a grid mapping tile coords to entities)
    // would be much more efficient.
    const units = this.world.view(Unit, TransformTile);
    
    for (const entity of units) {
      const pos = this.world.getComponent(entity, TransformTile);
      if (pos && pos.tx === tx && pos.ty === ty) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Finds a unit by checking if the world point is within any unit sprite's bounds.
   * This is a fallback for when tile-based detection fails due to coordinate issues.
   */
  private findUnitBySpriteBounds(worldX: number, worldY: number): Entity | null {
    // Get the GameScene to access unit sprites
    if (!('unitSprites' in this.scene)) {
      return null;
    }

    const gameScene = this.scene as { unitSprites: Map<Entity, Phaser.GameObjects.Sprite> };
    const units = this.world.view(Unit, TransformTile);
    const clickRadius = 32; // Allow clicking within 32 pixels of unit center

    for (const entity of units) {
      const sprite = gameScene.unitSprites.get(entity);
      if (!sprite) continue;

      const dx = sprite.x - worldX;
      const dy = sprite.y - worldY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < clickRadius) {
        return entity;
      }
    }

    return null;
  }
}
