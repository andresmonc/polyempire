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
        console.log('[MovementSystem] Unit', entity, 'has no MP left, path length:', unit.path.length);
        continue;
      }

      // Move one step at a time for smooth animation
      const nextStep = unit.path[0];
      if (!nextStep) {
        console.log('[MovementSystem] No next step in path');
        continue;
      }

      // Check if we have enough MP to move to the next tile
      const terrain = this.mapData.getTerrainAt(nextStep.tx, nextStep.ty);
      if (!terrain) {
        console.log('[MovementSystem] No terrain at', nextStep.tx, nextStep.ty);
        unit.path = [];
        continue;
      }

      if (terrain.moveCost < 0 || unit.mp < terrain.moveCost) {
        console.log('[MovementSystem] Cannot move to tile', nextStep.tx, nextStep.ty, 'moveCost:', terrain.moveCost, 'unit MP:', unit.mp);
        // Can't move to this tile, clear the path
        unit.path = [];
        continue;
      }

      console.log('[MovementSystem] Moving unit', entity, 'from', transform.tx, transform.ty, 'to', nextStep.tx, nextStep.ty);

      // Move to the next tile
      transform.tx = nextStep.tx;
      transform.ty = nextStep.ty;
      unit.mp -= terrain.moveCost;
      unit.path.shift(); // Remove the step we just took

      console.log(
        `[MovementSystem] Unit ${entity} moved to (${transform.tx}, ${transform.ty}). MP left: ${unit.mp}, remaining path: ${unit.path.length} steps`,
      );
    }
  }
}
