import { World, Entity } from '@engine/ecs';
import * as Components from '@engine/gameplay/components';
import { MapData } from '@engine/map/MapData';
import { RESOURCES } from '@config/game';
import { CityBorders } from './cityBorders';

/**
 * Calculates per-turn yields for a city.
 * Includes yields from worked tiles, base city yields, and building bonuses.
 */
export interface CityYields {
  food: number;
  production: number;
  gold: number;
}

export class CityYieldsCalculator {
  /**
   * Calculates per-turn yields for a city.
   */
  static calculateYields(
    world: World,
    mapData: MapData,
    cityEntity: Entity,
  ): CityYields | null {
    const city = world.getComponent(cityEntity, Components.City);
    const transform = world.getComponent(cityEntity, Components.TransformTile);
    
    if (!city || !transform) return null;

    const yields: CityYields = { food: 0, production: 0, gold: 0 };

    // 1. Calculate yields from worked tiles
    const tileYields = this.calculateTileYields(city, transform, mapData);
    yields.food += tileYields.food;
    yields.production += tileYields.production;
    yields.gold += tileYields.gold;

    // 2. Add base city yields
    yields.food += RESOURCES.CITY_BASE_FOOD;
    yields.production += RESOURCES.CITY_BASE_PRODUCTION;
    yields.gold += RESOURCES.CITY_BASE_GOLD;

    // 3. Add building yields
    const buildingYields = this.calculateBuildingYields(world, mapData, cityEntity);
    yields.food += buildingYields.food;
    yields.production += buildingYields.production;
    yields.gold += buildingYields.gold;

    return yields;
  }

  /**
   * Calculates yields from tiles that the city works.
   */
  private static calculateTileYields(
    city: Components.City,
    transform: Components.TransformTile,
    mapData: MapData,
  ): CityYields {
    const yields: CityYields = { food: 0, production: 0, gold: 0 };
    const workableTiles = this.getWorkableTiles(city, transform, mapData);
    
    // Sort tiles by total yield (food + production + gold) descending
    const sortedTiles = workableTiles.sort((a, b) => {
      const aTotal = a.yields.food + a.yields.production + a.yields.gold;
      const bTotal = b.yields.food + b.yields.production + b.yields.gold;
      return bTotal - aTotal;
    });

    // Work the best tiles up to population limit
    const tilesToWork = Math.min(city.population, sortedTiles.length);
    for (let i = 0; i < tilesToWork; i++) {
      const tile = sortedTiles[i];
      yields.food += tile.yields.food;
      yields.production += tile.yields.production;
      yields.gold += tile.yields.gold;
    }

    return yields;
  }

  /**
   * Gets all tiles that the city can potentially work.
   */
  private static getWorkableTiles(
    city: Components.City,
    transform: Components.TransformTile,
    mapData: MapData,
  ): Array<{ tx: number; ty: number; yields: CityYields }> {
    const workableTiles: Array<{
      tx: number;
      ty: number;
      yields: CityYields;
    }> = [];
    const sightRange = city.getSightRange();
    const dimensions = mapData.getDimensions();

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
        const terrain = mapData.getTerrainAt(tx, ty);
        if (!terrain || !terrain.yields) continue;

        workableTiles.push({
          tx,
          ty,
          yields: {
            food: terrain.yields.food || 0,
            production: terrain.yields.production || 0,
            gold: terrain.yields.gold || 0,
          },
        });
      }
    }

    return workableTiles;
  }

  /**
   * Calculates yields from buildings owned by the city.
   */
  private static calculateBuildingYields(
    world: World,
    mapData: MapData,
    cityEntity: Entity,
  ): CityYields {
    const yields: CityYields = { food: 0, production: 0, gold: 0 };
    
    // Get all buildings
    const buildings = world.view(Components.Building, Components.TransformTile);
    
    // Get city tiles
    const cityTiles = CityBorders.getCityTiles(world, mapData, cityEntity);
    const cityTileSet = new Set(cityTiles.map(t => `${t.tx},${t.ty}`));
    
    // Sum yields from buildings within city borders
    for (const buildingEntity of buildings) {
      const building = world.getComponent(buildingEntity, Components.Building)!;
      const buildingPos = world.getComponent(buildingEntity, Components.TransformTile)!;
      
      // Check if building is within this city's borders
      const tileKey = `${buildingPos.tx},${buildingPos.ty}`;
      if (cityTileSet.has(tileKey)) {
        if (building.yields.food) yields.food += building.yields.food;
        if (building.yields.production) yields.production += building.yields.production;
        if (building.yields.gold) yields.gold += building.yields.gold;
      }
    }
    
    return yields;
  }

  /**
   * Calculates total per-turn yields for a player/civilization (all cities combined).
   */
  static calculateTotalYields(
    world: World,
    mapData: MapData,
    playerId: number = 0,
  ): CityYields {
    const totalYields: CityYields = { food: 0, production: 0, gold: 0 };

    // Get all cities owned by this player
    const cities = world.view(Components.City, Components.TransformTile, Components.Owner);
    
    for (const cityEntity of cities) {
      const owner = world.getComponent(cityEntity, Components.Owner);
      if (!owner || owner.playerId !== playerId) continue;

      const cityYields = this.calculateYields(world, mapData, cityEntity);
      if (cityYields) {
        totalYields.food += cityYields.food;
        totalYields.production += cityYields.production;
        totalYields.gold += cityYields.gold;
      }
    }

    return totalYields;
  }
}

