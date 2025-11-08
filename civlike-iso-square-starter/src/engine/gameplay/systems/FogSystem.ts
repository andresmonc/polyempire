import { System } from '@engine/ecs';
import { FogOfWar } from '@engine/map/FogOfWar';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import { Owner, TransformTile, Unit } from '../components';

/**
 * Manages Fog of War updates.
 * It listens for `TurnBegan` intents or detects unit movement, then triggers
 * a recomputation of the visible tiles.
 */
export class FogSystem extends System {
  private fogOfWar: FogOfWar;
  private intents: IntentQueue;
  private lastUnitPositions = new Map<number, string>();

  constructor(fogOfWar: FogOfWar, intents: IntentQueue) {
    super();
    this.fogOfWar = fogOfWar;
    this.intents = intents;
  }

  update(_dt: number): void {
    // Pop the intent to consume it (prevents infinite recomputation)
    const turnBegan = this.intents.pop(isIntent('TurnBegan'));
    const units = this.world.view(Unit, TransformTile, Owner);
    let needsRecompute = !!turnBegan;

    // Check if any unit has moved since the last check
    // Also clean up positions for entities that no longer exist
    const currentEntities = new Set(units);
    for (const [entity, _] of this.lastUnitPositions.entries()) {
      if (!currentEntities.has(entity)) {
        this.lastUnitPositions.delete(entity);
      }
    }

    for (const entity of units) {
      const transform = this.world.getComponent(entity, TransformTile)!;
      const posKey = `${transform.tx},${transform.ty}`;
      if (this.lastUnitPositions.get(entity) !== posKey) {
        needsRecompute = true;
        this.lastUnitPositions.set(entity, posKey);
      }
    }

    if (needsRecompute) {
      const playerUnits = units
        .map(entity => ({
          entity,
          owner: this.world.getComponent(entity, Owner)!,
          unit: this.world.getComponent(entity, Unit)!,
          pos: this.world.getComponent(entity, TransformTile)!,
        }))
        .filter(u => u.owner.playerId === 0); // TODO: Support multiple players/AI

      this.fogOfWar.recompute(
        playerUnits.map(u => ({ pos: u.pos, sight: u.unit.sight })),
      );
    }
  }
}
