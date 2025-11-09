import { System } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import * as Components from '../components';
import { logger } from '@/utils/logger';
import Phaser from 'phaser';

/**
 * Applies building yields to cities.
 * Buildings can provide yields (food, production, gold) and city bonuses (population growth).
 */
export class BuildingYieldSystem extends System {
  private intents: IntentQueue;
  private events: Phaser.Events.EventEmitter;

  constructor(intents: IntentQueue, events: Phaser.Events.EventEmitter) {
    super();
    this.intents = intents;
    this.events = events;
  }

  update(_dt: number): void {
    // Process building yields at the start of each turn
    const turnBegan = this.intents.peek(isIntent('TurnBegan'));
    if (!turnBegan) return;

    // Get all buildings
    const buildings = this.world.view(Components.Building, Components.TransformTile);
    
    // Group buildings by their owning city
    const buildingsByCity = new Map<Entity, Array<{ building: Components.Building; entity: Entity }>>();
    
    for (const buildingEntity of buildings) {
      const building = this.world.getComponent(buildingEntity, Components.Building)!;
      const buildingPos = this.world.getComponent(buildingEntity, Components.TransformTile)!;
      
      // Find which city owns this tile (using city borders)
      const owningCity = this.findOwningCity(buildingPos.tx, buildingPos.ty);
      if (owningCity) {
        if (!buildingsByCity.has(owningCity)) {
          buildingsByCity.set(owningCity, []);
        }
        buildingsByCity.get(owningCity)!.push({ building, entity: buildingEntity });
      }
    }

    // Apply yields to each city
    for (const [cityEntity, cityBuildings] of buildingsByCity.entries()) {
      const resources = this.world.getComponent(cityEntity, Components.Resources);
      const city = this.world.getComponent(cityEntity, Components.City);
      
      if (!resources || !city) continue;

      let totalFood = 0;
      let totalProduction = 0;
      let totalGold = 0;
      let totalPopulationGrowth = 0;

      for (const { building } of cityBuildings) {
        // Add yields
        if (building.yields.food) totalFood += building.yields.food;
        if (building.yields.production) totalProduction += building.yields.production;
        if (building.yields.gold) totalGold += building.yields.gold;
        
        // Add city bonuses
        if (building.cityBonus.populationGrowth) {
          totalPopulationGrowth += building.cityBonus.populationGrowth;
        }
      }

      // Apply yields to city resources
      if (totalFood > 0 || totalProduction > 0 || totalGold > 0) {
        resources.add(totalFood, totalProduction, totalGold);
        logger.debug(
          `City received ${totalFood} food, ${totalProduction} production, ${totalGold} gold from buildings`,
        );
      }

      // Apply population growth bonus (reduces turns until growth)
      if (totalPopulationGrowth > 0) {
        // Reduce growth progress needed (bonus applies as percentage reduction)
        city.growthProgress += totalPopulationGrowth;
        logger.debug(`City received ${totalPopulationGrowth} population growth bonus from buildings`);
      }
    }

    this.events.emit('ui-update');
  }

  /**
   * Finds the city that owns a tile (within city borders).
   */
  private findOwningCity(tx: number, ty: number): Entity | null {
    const cities = this.world.view(Components.City, Components.TransformTile);
    
    for (const cityEntity of cities) {
      const city = this.world.getComponent(cityEntity, Components.City);
      const transform = this.world.getComponent(cityEntity, Components.TransformTile);
      
      if (!city || !transform) continue;
      
      const sightRange = city.getSightRange();
      const dx = Math.abs(transform.tx - tx);
      const dy = Math.abs(transform.ty - ty);
      const distance = Math.max(dx, dy); // Chebyshev distance
      
      if (distance <= sightRange) {
        return cityEntity;
      }
    }
    
    return null;
  }
}

