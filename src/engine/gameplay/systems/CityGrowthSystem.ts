import { System } from '@engine/ecs';
import { City, TransformTile } from '../components';
import { GameState } from '@/state/GameState';
import { logger } from '@/utils/logger';

/**
 * Handles city level growth based on population.
 * Cities level up when their population meets the cumulative requirement for the next level.
 * In multiplayer, city level-ups are server-authoritative and come via state sync.
 */
export class CityGrowthSystem extends System {
  private gameState: GameState;

  constructor(gameState: GameState) {
    super();
    this.gameState = gameState;
  }

  update(_dt: number): void {
    // In multiplayer, skip local level-up checks - server is authoritative
    // City level-ups will come through server state updates
    if (this.gameState.isMultiplayer) {
      return;
    }

    // Single-player: process city level-ups locally
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
