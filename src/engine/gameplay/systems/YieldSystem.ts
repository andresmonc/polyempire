import { System } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import { GameState } from '@/state/GameState';
import * as Components from '../components';
import { MapData } from '@engine/map/MapData';
import { RESOURCES } from '@config/game';
import { logger } from '@/utils/logger';
import Phaser from 'phaser';

/**
 * Collects yields from tiles around cities.
 * Each population point can work one tile within the city's range.
 * Yields are added to the city's resource stockpile.
 */
export class YieldSystem extends System {
  private intents: IntentQueue;
  private events: Phaser.Events.EventEmitter;
  private mapData: MapData;
  private gameState: GameState;
  private lastProcessedTurn: number = -1;

  constructor(intents: IntentQueue, events: Phaser.Events.EventEmitter, mapData: MapData, gameState: GameState) {
    super();
    this.intents = intents;
    this.events = events;
    this.mapData = mapData;
    this.gameState = gameState;
  }

  update(_dt: number): void {
    const turnBegan = this.intents.peek(isIntent('TurnBegan'));
    if (!turnBegan) {
      this.lastProcessedTurn = -1;
      return;
    }

    if (this.lastProcessedTurn === this.gameState.turn) {
      return;
    }

    // Process all cities
    const cities = this.world.view(Components.City, Components.TransformTile, Components.Resources);
    
    for (const cityEntity of cities) {
      const city = this.world.getComponent(cityEntity, Components.City)!;
      const transform = this.world.getComponent(cityEntity, Components.TransformTile)!;
      const resources = this.world.getComponent(cityEntity, Components.Resources)!;

      // Calculate yields from worked tiles
      const yields = this.calculateYields(city, transform);
      
      // Add base city yields
      yields.production += RESOURCES.CITY_BASE_PRODUCTION;
      yields.gold += RESOURCES.CITY_BASE_GOLD;
      
      // Each citizen contributes Production Points per turn
      yields.production += city.population * RESOURCES.PRODUCTION_PER_CITIZEN;

      resources.add(yields.production, yields.gold);
    }

    this.lastProcessedTurn = this.gameState.turn;

    this.events.emit('ui-update');
  }

  /**
   * Calculates yields from tiles that the city can work.
   * Each population point can work one tile within the city's range.
   */
  private calculateYields(city: Components.City, transform: Components.TransformTile): {
    production: number;
    gold: number;
  } {
    const yields = { production: 0, gold: 0 };
    const workableTiles = this.getWorkableTiles(city, transform);
    
    // Sort tiles by total yield (production + gold) descending
    // This simulates the city working the best tiles first
    const sortedTiles = workableTiles.sort((a, b) => {
      const aTotal = a.yields.production + a.yields.gold;
      const bTotal = b.yields.production + b.yields.gold;
      return bTotal - aTotal;
    });

    // Work the best tiles up to population limit
    const tilesToWork = Math.min(city.population, sortedTiles.length);
    for (let i = 0; i < tilesToWork; i++) {
      const tile = sortedTiles[i];
      yields.production += tile.yields.production;
      yields.gold += tile.yields.gold;
    }

    return yields;
  }

  /**
   * Gets all tiles that the city can potentially work.
   * This includes all tiles within the city's sight range (population).
   */
  private getWorkableTiles(
    city: Components.City,
    transform: Components.TransformTile,
  ): Array<{ tx: number; ty: number; yields: { production: number; gold: number } }> {
    const workableTiles: Array<{
      tx: number;
      ty: number;
      yields: { production: number; gold: number };
    }> = [];
    const sightRange = city.getSightRange();
    const dimensions = this.mapData.getDimensions();

    // Check all tiles within sight range
    for (let dx = -sightRange; dx <= sightRange; dx++) {
      for (let dy = -sightRange; dy <= sightRange; dy++) {
        // Use Chebyshev distance (square radius)
        if (Math.max(Math.abs(dx), Math.abs(dy)) > sightRange) continue;

        const tx = transform.tx + dx;
        const ty = transform.ty + dy;

        // Check bounds
        if (tx < 0 || tx >= dimensions.width || ty < 0 || ty >= dimensions.height) continue;

        // Get terrain yields
        const terrain = this.mapData.getTerrainAt(tx, ty);
        if (!terrain || !terrain.yields) continue;

        workableTiles.push({
          tx,
          ty,
          yields: {
            production: terrain.yields.prod || 0,
            gold: terrain.yields.gold || 0,
          },
        });
      }
    }

    return workableTiles;
  }
}

