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
    public path: TilePoint[] = [], // The current planned path
  ) {}
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
