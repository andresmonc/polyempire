import { chebyshevDistance } from '@engine/math/grid';
import { TilePoint } from '@engine/math/iso';
import { MapData } from './MapData';

/**
 * Per-player fog state tracking
 */
interface PlayerFogState {
  // `true` if the tile has ever been seen by this player.
  revealed: boolean[];
  // `true` if the tile is currently in a unit's sight range for this player.
  visible: boolean[];
  // A list of tiles that became newly visible this frame for this player.
  newlyVisible: TilePoint[];
}

/**
 * Manages the state of fog of war on the map, per player.
 *
 * It tracks three levels of visibility for each tile per player:
 * 1. Unrevealed (Shrouded): The tile has never been seen by this player.
 * 2. Revealed (Dimmed): The tile has been seen before but is not currently in sight.
 * 3. Visible (Lit): The tile is currently within a unit's line of sight.
 *
 * This is a basic implementation where visibility is a diamond shape around units.
 * The `visible` grid is recomputed each turn or whenever a unit moves.
 */
export class FogOfWar {
  public readonly width: number;
  public readonly height: number;

  // Per-player fog state
  private playerFogStates = new Map<number, PlayerFogState>();

  constructor(mapData: MapData) {
    this.width = mapData.width;
    this.height = mapData.height;
  }

  private getIndex(tx: number, ty: number): number {
    return ty * this.width + tx;
  }

  /**
   * Gets or creates fog state for a player
   */
  private getPlayerFogState(playerId: number): PlayerFogState {
    if (!this.playerFogStates.has(playerId)) {
      const tileCount = this.width * this.height;
      this.playerFogStates.set(playerId, {
        revealed: new Array(tileCount).fill(false),
        visible: new Array(tileCount).fill(false),
        newlyVisible: [],
      });
    }
    return this.playerFogStates.get(playerId)!;
  }

  public isRevealed(tx: number, ty: number, playerId: number): boolean {
    const state = this.getPlayerFogState(playerId);
    const idx = this.getIndex(tx, ty);
    return state.revealed[idx] ?? false;
  }

  public isVisible(tx: number, ty: number, playerId: number): boolean {
    const state = this.getPlayerFogState(playerId);
    const idx = this.getIndex(tx, ty);
    return state.visible[idx] ?? false;
  }

  /**
   * Gets newly visible tiles for a player
   */
  public getNewlyVisible(playerId: number): TilePoint[] {
    const state = this.getPlayerFogState(playerId);
    return state.newlyVisible;
  }

  /**
   * Recomputes the `visible` grid for a specific player based on their unit positions and sight ranges,
   * and optionally city positions and their sight ranges.
   * This should be called at the start of a turn and after any unit moves or cities grow.
   * @param playerId - The player ID to compute fog for
   * @param units - An array of objects containing unit positions and sight ranges.
   * @param cities - An optional array of objects containing city positions and sight ranges.
   */
  public recompute(
    playerId: number,
    units: { pos: TilePoint; sight: number }[],
    cities?: { pos: TilePoint; sight: number }[],
  ) {
    const state = this.getPlayerFogState(playerId);
    state.newlyVisible = [];
    const tileCount = this.width * this.height;
    const nextVisible = new Array(tileCount).fill(false);

    for (let i = 0; i < tileCount; i++) {
      const tx = i % this.width;
      const ty = Math.floor(i / this.width);

      // Check units
      for (const unit of units) {
        if (chebyshevDistance({ tx, ty }, unit.pos) <= unit.sight) {
          nextVisible[i] = true;
          break; // No need to check other units for this tile
        }
      }

      // Check cities if provided
      if (!nextVisible[i] && cities) {
        for (const city of cities) {
          if (chebyshevDistance({ tx, ty }, city.pos) <= city.sight) {
            nextVisible[i] = true;
            break; // No need to check other cities for this tile
          }
        }
      }
    }

    // Update revealed status and identify newly visible tiles
    for (let i = 0; i < tileCount; i++) {
      if (nextVisible[i] && !state.revealed[i]) {
        state.revealed[i] = true;
        const tx = i % this.width;
        const ty = Math.floor(i / this.width);
        state.newlyVisible.push({ tx, ty });
      }
    }

    state.visible = nextVisible;
  }
}
