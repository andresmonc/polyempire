import { System } from '@engine/ecs';
import { City, TransformTile } from '../components';
import { logger } from '@/utils/logger';

/**
 * Handles city level growth based on population.
 * Cities level up when their population meets the cumulative requirement for the next level.
 */
export class CityGrowthSystem extends System {
  update(_dt: number): void {
    // Process all cities
    const cities = this.world.view(City, TransformTile);
    for (const cityEntity of cities) {
      const city = this.world.getComponent(cityEntity, City)!;
      
      // Check if city can level up based on population
      if (city.tryLevelUp()) {
        const transform = this.world.getComponent(cityEntity, TransformTile)!;
        logger.info(`City at (${transform.tx}, ${transform.ty}) leveled up to level ${city.level} (population: ${city.population})`);
      }
    }
  }
}
