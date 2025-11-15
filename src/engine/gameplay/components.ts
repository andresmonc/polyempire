import { TilePoint, Point } from '@engine/math/iso';

// --- Position Components ---

/**
 * Stores an entity's position on the logical tile grid.
 * This is the source of truth for an entity's location.
 */
export class TransformTile implements TilePoint {
  constructor(
    public tx: number,
    public ty: number,
  ) {}
}

/**
 * Stores an entity's calculated screen position in world coordinates.
 * This is derived from `TransformTile` by the `RenderSyncSystem` and used
 * by the rendering layer (Phaser) to position sprites.
 */
export class ScreenPos implements Point {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

// --- Unit-specific Components ---

/**
 * Defines properties for a unit.
 */
export class Unit {
  constructor(
    public mp: number, // Current movement points
    public maxMp: number,
    public sight: number, // Sight range in tiles (Chebyshev distance)
    public health: number, // Current health
    public maxHealth: number, // Maximum health
    public attack: number, // Attack strength (0 if unit cannot attack)
    public defense: number, // Defense strength
    public canAttack: boolean, // Whether this unit can initiate combat
    public path: TilePoint[] = [], // The current planned path
  ) {}
}

/**
 * Identifies the type of unit (e.g., 'scout', 'settler', 'warrior').
 * Used to determine available actions and capabilities.
 */
export class UnitType {
  constructor(public type: string) {}
}

/**
 * A tag component indicating that a unit was just purchased this turn.
 * Units with this component cannot move or act until the next turn.
 */
export class NewlyPurchased {}

// --- Tile-specific Components ---

/**
 * Defines properties for a map tile entity.
 */
export class Tile {
  constructor(public terrainId: string) {}
}

// --- State & UI Components ---

/**
 * A tag component indicating that an entity can be selected by the player.
 */
export class Selectable {}

/**
 * A tag component indicating that an entity is currently selected.
 * Note: Currently, selection state is primarily tracked in GameState.selectedEntity
 * for easier access. This component is maintained for potential future ECS queries
 * (e.g., finding all selected entities via world.view(Selected)).
 */
export class Selected {}

/**
 * Identifies which player owns this entity.
 * TODO: For now, player 0 is the human player.
 */
export class Owner {
  constructor(public playerId: number) {}
}

/**
 * Identifies which civilization this entity belongs to.
 * Used to apply civilization-specific overrides for units, cities, and sprites.
 */
export class CivilizationComponent {
  constructor(public civId: string) {}
}

/**
 * Represents a city with population and level-based growth mechanics.
 * Population determines the city's sight range for fog of war.
 * Cities grow based on cumulative population requirements per level.
 */
export class City {
  constructor(
    public population: number = 1, // Current total population
    public level: number = 1, // Current city level (starts at 1)
  ) {}

  /**
   * Gets the sight range for this city based on population.
   * For now, sight range equals population.
   */
  getSightRange(): number {
    return this.population;
  }

  /**
   * Calculates the cumulative population required to reach a given level.
   * Level 1: 1 population (starting)
   * Level 2: 3 population total (need 2 more from level 1)
   * Level 3: 6 population total (need 3 more from level 2)
   * Level 4: 12 population total (need 6 more from level 3)
   * Level 5: 20 population total (need 8 more from level 4)
   * 
   * Pattern: Level 1→2: +2, Level 2→3: +3, Level 3→4: +6, Level 4→5: +8, then +10, +12, etc.
   */
  static getPopulationRequirementForLevel(targetLevel: number): number {
    if (targetLevel <= 1) return 1;
    if (targetLevel === 2) return 3;
    if (targetLevel === 3) return 6;
    if (targetLevel === 4) return 12;
    if (targetLevel === 5) return 20;
    
    // For levels 6+, continue pattern: +10, +12, +14, etc. (2 * level)
    let requirement = 20; // Level 5 requirement
    for (let level = 6; level <= targetLevel; level++) {
      requirement += 2 * (level - 1);
    }
    return requirement;
  }

  /**
   * Gets the population requirement for the next level.
   */
  getPopulationRequirementForNextLevel(): number {
    return City.getPopulationRequirementForLevel(this.level + 1);
  }

  /**
   * Checks if the city has enough population to level up.
   */
  canLevelUp(): boolean {
    return this.population >= this.getPopulationRequirementForNextLevel();
  }

  /**
   * Levels up the city if population requirement is met.
   * Returns true if level up occurred, false otherwise.
   */
  tryLevelUp(): boolean {
    if (this.canLevelUp()) {
      this.level += 1;
      return true;
    }
    return false;
  }
}

/**
 * Represents a city's resource stockpile.
 */
export class Resources {
  constructor(
    public production: number = 0, // Production stockpile
    public gold: number = 0, // Gold stockpile
  ) {}

  /**
   * Adds resources to the stockpile.
   */
  add(production: number, gold: number): void {
    this.production += production;
    this.gold += gold;
  }

  /**
   * Checks if the city has enough resources for a cost.
   */
  canAfford(cost: { production?: number; gold?: number }): boolean {
    return (
      (cost.production === undefined || this.production >= cost.production) &&
      (cost.gold === undefined || this.gold >= cost.gold)
    );
  }

  /**
   * Spends resources (assumes canAfford was checked first).
   */
  spend(cost: { production?: number; gold?: number }): void {
    if (cost.production !== undefined) this.production -= cost.production;
    if (cost.gold !== undefined) this.gold -= cost.gold;
  }
}

/**
 * Represents a civilization's resource stockpile (civilization-level resources).
 * This is separate from city-level resources and aggregates production from all cities.
 */
export class CivilizationResources {
  constructor(
    public production: number = 0, // Civilization-level production stockpile
  ) {}

  /**
   * Adds production to the civilization stockpile.
   */
  addProduction(amount: number): void {
    this.production += amount;
  }

  /**
   * Checks if the civilization has enough production for a cost.
   */
  canAfford(cost: number): boolean {
    return this.production >= cost;
  }

  /**
   * Spends production (assumes canAfford was checked first).
   */
  spend(amount: number): void {
    this.production -= amount;
  }
}

/**
 * Represents a production queue item.
 */
export interface ProductionItem {
  type: 'unit' | 'building';
  name: string; // e.g., 'settler', 'scout', 'granary'
  cost: number; // Production cost
}

/**
 * Represents a building placed on a tile.
 */
export class Building {
  constructor(
    public buildingType: string, // e.g., 'granary', 'lumberMill'
    public yields: { food?: number; production?: number; gold?: number } = {}, // Yields from this building
    public cityBonus: { populationGrowth?: number } = {}, // Bonuses to the owning city
  ) {}
}

/**
 * Represents a city's production queue.
 */
export class ProductionQueue {
  constructor(
    public queue: ProductionItem[] = [], // Items in the queue
    public currentProgress: number = 0, // Progress on current item
  ) {}

  /**
   * Gets the current item being produced, or null if queue is empty.
   */
  getCurrent(): ProductionItem | null {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  /**
   * Adds an item to the end of the queue.
   */
  enqueue(item: ProductionItem): void {
    this.queue.push(item);
  }

  /**
   * Removes the current item from the queue (when completed).
   */
  dequeue(): ProductionItem | null {
    return this.queue.shift() ?? null;
  }

  /**
   * Checks if the queue is empty.
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
