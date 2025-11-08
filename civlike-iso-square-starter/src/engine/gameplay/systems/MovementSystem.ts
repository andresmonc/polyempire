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

      if (unit.path.length === 0 || unit.mp <= 0) {
        continue;
      }

      const budget: MovementSplit = calculateMovementBudget(
        // The path needs to include the current position for the budget calculation
        [transform, ...unit.path],
        unit.mp,
        this.mapData,
      );

      if (budget.consumedSteps.length > 0) {
        const finalStep = budget.consumedSteps[budget.consumedSteps.length - 1];

        // Move the unit to the final reachable tile for this turn
        transform.tx = finalStep.pos.tx;
        transform.ty = finalStep.pos.ty;

        // Update the unit's remaining path and movement points
        unit.mp = budget.remainingMp;
        unit.path = budget.remainingPath;

        // Signal that a unit has moved (for fog of war, etc.)
        // In a more robust system, this would be an event.
        // For now, we'll let the FogSystem query unit positions directly.
        console.log(
          `Unit ${entity} moved to (${transform.tx}, ${transform.ty}). MP left: ${unit.mp}`,
        );
      }
    }
  }
}
