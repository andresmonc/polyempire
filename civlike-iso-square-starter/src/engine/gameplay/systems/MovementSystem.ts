import { System } from '@engine/ecs';
import { MapData } from '@engine/map/MapData';
import {
  calculateMovementBudget,
  MovementSplit,
} from '@engine/pathfinding/movementBudget';
import { TransformTile, Unit } from '../components';

/**
 * Handles the step-by-step movement of units along their calculated paths.
 * It consumes movement points and updates the unit's tile position.
 * It works with the `movementBudget` to handle multi-turn movement.
 */
export class MovementSystem extends System {
  private mapData: MapData;

  constructor(mapData: MapData) {
    super();
    this.mapData = mapData;
  }

  update(_dt: number): void {
    const movingEntities = this.world.view(Unit, TransformTile);

    for (const entity of movingEntities) {
      const unit = this.world.getComponent(entity, Unit)!;
      const transform = this.world.getComponent(entity, TransformTile)!;

      if (unit.path.length === 0) {
        continue;
      }

      if (unit.mp <= 0) {
        continue;
      }

      // Move one step at a time for smooth animation
      const nextStep = unit.path[0];
      if (!nextStep) {
        continue;
      }

      // Check if we're already at the next step (shouldn't happen, but handle it)
      if (transform.tx === nextStep.tx && transform.ty === nextStep.ty) {
        unit.path.shift();
        continue;
      }

      // Check if we have enough MP to move to the next tile
      const terrain = this.mapData.getTerrainAt(nextStep.tx, nextStep.ty);
      if (!terrain) {
        unit.path = [];
        continue;
      }

      if (terrain.moveCost < 0 || unit.mp < terrain.moveCost) {
        // Can't move to this tile, clear the path
        unit.path = [];
        continue;
      }

      // Move to the next tile
      transform.tx = nextStep.tx;
      transform.ty = nextStep.ty;
      unit.mp -= terrain.moveCost;
      unit.path.shift(); // Remove the step we just took
    }
  }
}
