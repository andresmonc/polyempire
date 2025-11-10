import { chebyshevDistance } from '@engine/math/grid';
import { TilePoint } from '@engine/math/iso';
import { MapData } from './MapData';

/**
 * Manages the state of fog of war on the map.
 *
 * It tracks three levels of visibility for each tile:
 * 1. Unrevealed (Shrouded): The tile has never been seen.
 * 2. Revealed (Dimmed): The tile has been seen before but is not currently in sight.
 * 3. Visible (Lit): The tile is currently within a unit's line of sight.
 *
 * This is a basic implementation where visibility is a diamond shape around units.
 * The `visible` grid is recomputed each turn or whenever a unit moves.
 */
export class FogOfWar {
  public readonly width: number;
  public readonly height: number;

  // `true` if the tile has ever been seen.
  private revealed: boolean[];
  // `true` if the tile is currently in a unit's sight range.
  private visible: boolean[];

  // A list of tiles that became newly visible this frame.
  public newlyVisible: TilePoint[] = [];

  constructor(mapData: MapData) {
    this.width = mapData.width;
    this.height = mapData.height;
    const tileCount = this.width * this.height;
    this.revealed = new Array(tileCount).fill(false);
    this.visible = new Array(tileCount).fill(false);
  }

  private getIndex(tx: number, ty: number): number {
    return ty * this.width + tx;
  }

  public isRevealed(tx: number, ty: number): boolean {
    const idx = this.getIndex(tx, ty);
    return this.revealed[idx] ?? false;
  }

  public isVisible(tx: number, ty: number): boolean {
    const idx = this.getIndex(tx, ty);
    return this.visible[idx] ?? false;
  }

  /**
   * Recomputes the `visible` grid based on a set of unit positions and their sight ranges,
   * and optionally city positions and their sight ranges.
   * This should be called at the start of a turn and after any unit moves or cities grow.
   * @param units - An array of objects containing unit positions and sight ranges.
   * @param cities - An optional array of objects containing city positions and sight ranges.
   */
  public recompute(
    units: { pos: TilePoint; sight: number }[],
    cities?: { pos: TilePoint; sight: number }[],
  ) {
    this.newlyVisible = [];
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
      if (nextVisible[i] && !this.revealed[i]) {
        this.revealed[i] = true;
        const tx = i % this.width;
        const ty = Math.floor(i / this.width);
        this.newlyVisible.push({ tx, ty });
      }
    }

    this.visible = nextVisible;
  }
}
