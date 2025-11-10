import { System } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import { City, TransformTile } from '../components';
import { logger } from '@/utils/logger';

/**
 * Handles city population growth.
 * Growth uses a backoff mechanism: 1->2 takes 2 turns, 2->3 takes 4 turns, 3->4 takes 8 turns, etc.
 */
export class CityGrowthSystem extends System {
  private intents: IntentQueue;

  constructor(intents: IntentQueue) {
    super();
    this.intents = intents;
  }

  update(_dt: number): void {
    // Check for turn beginning
    const turnBegan = this.intents.peek(isIntent('TurnBegan'));
    if (!turnBegan) return;

    // Process all cities
    const cities = this.world.view(City, TransformTile);
    for (const cityEntity of cities) {
      const city = this.world.getComponent(cityEntity, City)!;
      
      // Increment growth progress
      city.growthProgress += 1;
      
      // Check if city should grow
      if (city.growthProgress >= city.turnsUntilGrowth) {
        // Grow the city
        city.population += 1;
        city.growthProgress = 0;
        city.turnsUntilGrowth = City.getTurnsUntilGrowth(city.population);
        
        const transform = this.world.getComponent(cityEntity, TransformTile)!;
        logger.info(`City at (${transform.tx}, ${transform.ty}) grew to population ${city.population}`);
      }
    }
  }
}

