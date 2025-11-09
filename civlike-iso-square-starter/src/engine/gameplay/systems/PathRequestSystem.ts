import { System } from '@engine/ecs';
import { MapData } from '@engine/map/MapData';
import { findPath } from '@engine/pathfinding/astar';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import { Owner, TransformTile, Unit } from '../components';
import { FogOfWar } from '@engine/map/FogOfWar';
import { isTileInBounds } from '@engine/math/grid';

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

    if (!unit || !transform || !owner) {
      return;
    }

    // For now, only allow movement for player-owned units
    if (owner.playerId !== 0) {
      return;
    }

    // Validate target is within map bounds
    if (!isTileInBounds(target.tx, target.ty, this.mapData.getDimensions())) {
      unit.path = []; // Clear existing path
      return;
    }

    // Early return if clicking on the same tile
    if (transform.tx === target.tx && transform.ty === target.ty) {
      unit.path = [];
      return;
    }

    const path = findPath(transform, target, this.mapData);

    if (path) {
      // Path includes the start point, so we remove it
      path.shift();
      unit.path = path;
    } else {
      unit.path = []; // Clear existing path
    }
  }
}
