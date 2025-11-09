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
