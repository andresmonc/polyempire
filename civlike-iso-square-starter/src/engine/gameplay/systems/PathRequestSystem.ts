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

    console.log('[PathRequestSystem] Processing MoveTo intent:', intent.payload);
    const { entity, target } = intent.payload;

    const unit = this.world.getComponent(entity, Unit);
    const transform = this.world.getComponent(entity, TransformTile);
    const owner = this.world.getComponent(entity, Owner);

    console.log('[PathRequestSystem] Unit:', unit, 'Transform:', transform, 'Owner:', owner);

    if (!unit || !transform || !owner) {
      console.log('[PathRequestSystem] Missing required components');
      return;
    }

    // For now, only allow movement for player-owned units
    if (owner.playerId !== 0) {
      console.log('[PathRequestSystem] Unit not owned by player 0');
      return;
    }

    // Do not allow pathfinding to unrevealed tiles
    if (!this.fogOfWar.isRevealed(target.tx, target.ty)) {
      console.log('[PathRequestSystem] Cannot move to unrevealed tile:', target.tx, target.ty);
      unit.path = []; // Clear existing path
      return;
    }

    console.log('[PathRequestSystem] Finding path from', transform.tx, transform.ty, 'to', target.tx, target.ty);
    const path = findPath(transform, target, this.mapData);

    if (path) {
      console.log('[PathRequestSystem] Path found with', path.length, 'steps');
      // Path includes the start point, so we remove it
      path.shift();
      unit.path = path;
      console.log('[PathRequestSystem] Unit path set to', unit.path.length, 'steps');
    } else {
      console.log('[PathRequestSystem] No path found!');
      unit.path = []; // Clear existing path
    }
  }
}
