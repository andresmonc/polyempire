import { System } from '@engine/ecs';
import { FogOfWar } from '@engine/map/FogOfWar';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import { GameState } from '@/state/GameState';
import { Owner, TransformTile, Unit, City } from '../components';

/**
 * Manages Fog of War updates.
 * It listens for `TurnBegan` intents or detects unit movement, then triggers
 * a recomputation of the visible tiles. Also includes cities in fog computation.
 */
export class FogSystem extends System {
  private fogOfWar: FogOfWar;
  private intents: IntentQueue;
  private gameState: GameState;
  private lastUnitPositions = new Map<number, string>();
  private lastCityPopulations = new Map<number, number>();
  private hasComputedInitialFog = false;

  constructor(fogOfWar: FogOfWar, intents: IntentQueue, gameState: GameState) {
    super();
    this.fogOfWar = fogOfWar;
    this.intents = intents;
    this.gameState = gameState;
  }

  update(_dt: number): void {
    // Pop the intent to consume it (prevents infinite recomputation)
    const turnBegan = this.intents.pop(isIntent('TurnBegan'));
    const units = this.world.view(Unit, TransformTile, Owner);
    const cities = this.world.view(City, TransformTile, Owner);
    let needsRecompute = !!turnBegan || !this.hasComputedInitialFog;

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

    // Check if any city's population has changed (which affects sight range)
    const currentCityEntities = new Set(cities);
    for (const [entity, _] of this.lastCityPopulations.entries()) {
      if (!currentCityEntities.has(entity)) {
        this.lastCityPopulations.delete(entity);
      }
    }

    for (const cityEntity of cities) {
      const city = this.world.getComponent(cityEntity, City)!;
      const lastPop = this.lastCityPopulations.get(cityEntity);
      if (lastPop === undefined || lastPop !== city.population) {
        needsRecompute = true;
        this.lastCityPopulations.set(cityEntity, city.population);
      }
    }

    if (needsRecompute) {
      // Group units and cities by player ID for per-player fog computation
      const unitsByPlayer = new Map<number, Array<{ pos: { tx: number; ty: number }; sight: number }>>();
      const citiesByPlayer = new Map<number, Array<{ pos: { tx: number; ty: number }; sight: number }>>();

      // Process all units and group by player
      for (const entity of units) {
        const owner = this.world.getComponent(entity, Owner)!;
        const unit = this.world.getComponent(entity, Unit)!;
        const pos = this.world.getComponent(entity, TransformTile)!;
        
        if (!unitsByPlayer.has(owner.playerId)) {
          unitsByPlayer.set(owner.playerId, []);
        }
        unitsByPlayer.get(owner.playerId)!.push({
          pos: { tx: pos.tx, ty: pos.ty },
          sight: unit.sight,
        });
      }

      // Process all cities and group by player
      for (const entity of cities) {
        const owner = this.world.getComponent(entity, Owner)!;
        const city = this.world.getComponent(entity, City)!;
        const pos = this.world.getComponent(entity, TransformTile)!;
        
        if (!citiesByPlayer.has(owner.playerId)) {
          citiesByPlayer.set(owner.playerId, []);
        }
        citiesByPlayer.get(owner.playerId)!.push({
          pos: { tx: pos.tx, ty: pos.ty },
          sight: city.getSightRange(),
        });
      }

      // Compute fog for each player separately
      const allPlayerIds = new Set([
        ...unitsByPlayer.keys(),
        ...citiesByPlayer.keys(),
      ]);

      for (const playerId of allPlayerIds) {
        const playerUnits = unitsByPlayer.get(playerId) || [];
        const playerCities = citiesByPlayer.get(playerId);

        this.fogOfWar.recompute(
          playerId,
          playerUnits,
          playerCities,
        );
      }

      this.hasComputedInitialFog = true;
    }
  }
}
