import { TilePoint } from '@engine/math/iso';
import { MapData } from '@engine/map/MapData';

/**
 * Represents a single step in a path, including the cost to take it.
 */
export interface PathStep {
  pos: TilePoint;
  cost: number;
}

/**
 * The result of splitting a path based on a movement budget.
 */
export interface MovementSplit {
  consumedSteps: PathStep[]; // The portion of the path that can be traversed this turn.
  remainingPath: TilePoint[]; // The rest of the path to be traversed in future turns.
  remainingMp: number; // The movement points left after taking the consumed steps.
}

/**
 * Converts a simple path of tile coordinates into a path of steps with costs.
 * @param path - The array of tile coordinates.
 * @param mapData - The map data to look up terrain costs.
 * @returns An array of `PathStep` objects.
 */
function pathToSteps(path: TilePoint[], mapData: MapData): PathStep[] {
  if (path.length < 2) {
    return [];
  }
  // The first step (the starting tile) has no cost to enter.
  // The cost is associated with *entering* the next tile.
  const steps: PathStep[] = [];
  for (let i = 1; i < path.length; i++) {
    const tile = path[i];
    const terrain = mapData.mustGetTerrainAt(tile.tx, tile.ty);
    steps.push({
      pos: tile,
      cost: terrain.moveCost,
    });
  }
  return steps;
}

/**
 * Splits a path into a portion that can be traversed with a given movement budget (MP)
 * and a remaining portion for subsequent turns.
 *
 * This is crucial for multi-turn movement. A unit might be given a long path,
 * and this function determines how far it can get this turn.
 *
 * @param path - The full path the unit wants to traverse (including the start tile).
 * @param movementPoints - The unit's available movement points for this turn.
 * @param mapData - The map data to determine movement costs.
 * @returns A `MovementSplit` object detailing the outcome.
 */
export function calculateMovementBudget(
  path: TilePoint[],
  movementPoints: number,
  mapData: MapData,
): MovementSplit {
  const steps = pathToSteps(path, mapData);
  const consumedSteps: PathStep[] = [];
  let remainingMp = movementPoints;
  let lastConsumedStepIndex = -1;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.cost <= remainingMp) {
      remainingMp -= step.cost;
      consumedSteps.push(step);
      lastConsumedStepIndex = i;
    } else {
      break; // Not enough MP for the next step
    }
  }

  // The remaining path starts from the last consumed tile.
  // If we consumed steps, the new path starts at the last consumed position.
  // If we consumed no steps, the path remains the same.
  const remainingPath =
    lastConsumedStepIndex > -1
      ? path.slice(lastConsumedStepIndex + 1)
      : path;

  return {
    consumedSteps,
    remainingPath,
    remainingMp,
  };
}
