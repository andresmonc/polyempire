import { World, Entity } from '@engine/ecs';
import { worldToTile } from '@engine/math/iso';
import { GameState } from '@/state/GameState';
import { IntentQueue } from '@/state/IntentQueue';
import Phaser from 'phaser';
import { Unit } from '@engine/gameplay/components';

/**
 * Handles pointer input from Phaser and translates it into game intents.
 * This class decouples the raw Phaser input events from the game's logic.
 */
export class PointerInput {
  constructor(
    scene: Phaser.Scene,
    private intents: IntentQueue,
    private world: World,
    private gameState: GameState,
  ) {
    scene.input.on(
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
    const worldPoint = pointer.positionToCamera(
      this.world.scene.cameras.main,
    ) as Phaser.Math.Vector2;

    // Convert world coordinates to the logical tile coordinates
    const targetTile = worldToTile(worldPoint.x, worldPoint.y);

    // Check if a unit was clicked
    const clickedUnit = this.findUnitAt(targetTile.tx, targetTile.ty);

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
    const units = this.world.view(Unit);
    for (const entity of units) {
      const pos = this.world.getComponent(entity, 'TransformTile');
      if (pos && pos.tx === tx && pos.ty === ty) {
        return entity;
      }
    }
    return null;
  }
}
