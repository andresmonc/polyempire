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
      // Filter units and cities owned by the current active player(s)
      // In multiplayer, this could be extended to show fog for all human players
      const playerUnits = units
        .map(entity => ({
          entity,
          owner: this.world.getComponent(entity, Owner)!,
          unit: this.world.getComponent(entity, Unit)!,
          pos: this.world.getComponent(entity, TransformTile)!,
        }))
        .filter(u => this.gameState.isCurrentPlayer(u.owner.playerId));

      const playerCities = cities
        .map(entity => ({
          entity,
          owner: this.world.getComponent(entity, Owner)!,
          city: this.world.getComponent(entity, City)!,
          pos: this.world.getComponent(entity, TransformTile)!,
        }))
        .filter(c => this.gameState.isCurrentPlayer(c.owner.playerId));

      this.fogOfWar.recompute(
        playerUnits.map(u => ({ pos: { tx: u.pos.tx, ty: u.pos.ty }, sight: u.unit.sight })),
        playerCities.map(c => ({ pos: { tx: c.pos.tx, ty: c.pos.ty }, sight: c.city.getSightRange() })),
      );
    }
  }
}
