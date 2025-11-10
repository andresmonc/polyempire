import { World, Entity } from '@engine/ecs';
import * as Components from '@engine/gameplay/components';
import { chebyshevDistance } from '@engine/math/grid';
import { MapData } from '@engine/map/MapData';

/**
 * Utility functions for working with city borders.
 */
export class CityBorders {
  /**
   * Checks if a tile is within any city's borders.
   * @param world - The ECS world
   * @param mapData - The map data
   * @param tx - Tile x coordinate
   * @param ty - Tile y coordinate
   * @returns The city entity that owns this tile, or null if not in any city's borders
   */
  static getOwningCity(
    world: World,
    mapData: MapData,
    tx: number,
    ty: number,
  ): Entity | null {
    const cities = world.view(Components.City, Components.TransformTile);
    
    for (const cityEntity of cities) {
      const city = world.getComponent(cityEntity, Components.City);
      const transform = world.getComponent(cityEntity, Components.TransformTile);
      
      if (!city || !transform) continue;
      
      const sightRange = city.getSightRange();
      const distance = chebyshevDistance({ tx, ty }, { tx: transform.tx, ty: transform.ty });
      
      if (distance <= sightRange) {
        return cityEntity;
      }
    }
    
    return null;
  }

  /**
   * Gets all tiles within a city's borders.
   * @param world - The ECS world
   * @param mapData - The map data
   * @param cityEntity - The city entity
   * @returns Array of tile coordinates within the city's borders
   */
  static getCityTiles(
    world: World,
    mapData: MapData,
    cityEntity: Entity,
  ): Array<{ tx: number; ty: number }> {
    const city = world.getComponent(cityEntity, Components.City);
    const transform = world.getComponent(cityEntity, Components.TransformTile);
    
    if (!city || !transform) return [];
    
    const tiles: Array<{ tx: number; ty: number }> = [];
    const sightRange = city.getSightRange();
    const dimensions = mapData.getDimensions();
    
    for (let dx = -sightRange; dx <= sightRange; dx++) {
      for (let dy = -sightRange; dy <= sightRange; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) > sightRange) continue;
        
        const tx = transform.tx + dx;
        const ty = transform.ty + dy;
        
        if (tx >= 0 && tx < dimensions.width && ty >= 0 && ty < dimensions.height) {
          tiles.push({ tx, ty });
        }
      }
    }
    
    return tiles;
  }
}

