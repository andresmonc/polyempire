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
 * Represents a city with population and growth mechanics.
 * Population determines the city's sight range for fog of war.
 * Growth uses a backoff mechanism: 1->2 takes 2 turns, 2->3 takes 4 turns, etc.
 */
export class City {
  constructor(
    public population: number = 1, // Current population
    public growthProgress: number = 0, // Turns accumulated toward next growth
    public turnsUntilGrowth: number = 2, // Turns needed to grow (doubles each growth)
  ) {}

  /**
   * Gets the sight range for this city based on population.
   * For now, sight range equals population.
   */
  getSightRange(): number {
    return this.population;
  }

  /**
   * Calculates the turns needed to grow from current population to next.
   * Growth backoff: 1->2: 2 turns, 2->3: 4 turns, 3->4: 8 turns, etc.
   */
  static getTurnsUntilGrowth(population: number): number {
    return Math.pow(2, population);
  }
}

/**
 * Represents a city's resource stockpile.
 */
export class Resources {
  constructor(
    public food: number = 0, // Food stockpile
    public production: number = 0, // Production stockpile
    public gold: number = 0, // Gold stockpile
  ) {}

  /**
   * Adds resources to the stockpile.
   */
  add(food: number, production: number, gold: number): void {
    this.food += food;
    this.production += production;
    this.gold += gold;
  }

  /**
   * Checks if the city has enough resources for a cost.
   */
  canAfford(cost: { food?: number; production?: number; gold?: number }): boolean {
    return (
      (cost.food === undefined || this.food >= cost.food) &&
      (cost.production === undefined || this.production >= cost.production) &&
      (cost.gold === undefined || this.gold >= cost.gold)
    );
  }

  /**
   * Spends resources (assumes canAfford was checked first).
   */
  spend(cost: { food?: number; production?: number; gold?: number }): void {
    if (cost.food !== undefined) this.food -= cost.food;
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
