import { System } from '@engine/ecs';
import { MapData } from '@engine/map/MapData';
import { findPath } from '@engine/pathfinding/astar';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import { Owner, TransformTile, Unit } from '../components';
import { FogOfWar } from '@engine/map/FogOfWar';

/**
 * Processes `MoveTo` intents by calculating a path for the selected unit.
 * If a valid path is found, it's stored in the unit's `Unit` component.
 * The actual movement is handled by the `MovementSystem`.
 */
export class PathRequestSystem extends System {
  private intents: IntentQueue;
  private mapData: MapData;
  private fogOfWar: FogOfWar;

  constructor(intents: IntentQueue, mapData: MapData, fogOfWar: FogOfWar) {
    super();
    this.intents = intents;
    this.mapData = mapData;
    this.fogOfWar = fogOfWar;
  }

  update(_dt: number): void {
    const intent = this.intents.pop(isIntent('MoveTo'));
    if (!intent) return;

    const { entity, target } = intent.payload;

    const unit = this.world.getComponent(entity, Unit);
    const transform = this.world.getComponent(entity, TransformTile);
    const owner = this.world.getComponent(entity, Owner);

    if (!unit || !transform || !owner) return;

    // For now, only allow movement for player-owned units
    if (owner.playerId !== 0) return;

    // Do not allow pathfinding to unrevealed tiles
    if (!this.fogOfWar.isRevealed(target.tx, target.ty)) {
      console.log('Cannot move to unrevealed tile.');
      unit.path = []; // Clear existing path
      return;
    }

    const path = findPath(transform, target, this.mapData);

    if (path) {
      // Path includes the start point, so we remove it
      path.shift();
      unit.path = path;
    } else {
      console.log('No path found!');
      unit.path = []; // Clear existing path
    }
  }
}
