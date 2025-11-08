/**
 * Grid-based utility functions for a square logical map.
 */
import { TilePoint } from './iso';

/**
 * Represents the dimensions of a map.
 */
export interface MapDimensions {
  width: number;
  height: number;
}

/**
 * Checks if a given tile coordinate is within the map's boundaries.
 * @param tx - The tile's x-coordinate.
 * @param ty - The tile's y-coordinate.
 * @param dimensions - The map's width and height.
 * @returns True if the tile is in bounds, false otherwise.
 */
export function isTileInBounds(
  tx: number,
  ty: number,
  dimensions: MapDimensions,
): boolean {
  return tx >= 0 && tx < dimensions.width && ty >= 0 && ty < dimensions.height;
}

/**
 * Defines the four cardinal directions for 4-way movement.
 * TODO: Could be extended to 8-way for diagonal movement.
 */
const NEIGHBOR_DELTAS_4_WAY: TilePoint[] = [
  { tx: 1, ty: 0 }, // Right
  { tx: -1, ty: 0 }, // Left
  { tx: 0, ty: 1 }, // Down
  { tx: 0, ty: -1 }, // Up
];

/**
 * Gets the valid neighbors of a tile for 4-way movement.
 * @param tx - The tile's x-coordinate.
 * @param ty - The tile's y-coordinate.
 * @param dimensions - The map's width and height.
 * @returns An array of valid neighbor tile coordinates.
 */
export function getNeighbors(
  tx: number,
  ty: number,
  dimensions: MapDimensions,
): TilePoint[] {
  const neighbors: TilePoint[] = [];
  for (const delta of NEIGHBOR_DELTAS_4_WAY) {
    const nTx = tx + delta.tx;
    const nTy = ty + delta.ty;
    if (isTileInBounds(nTx, nTy, dimensions)) {
      neighbors.push({ tx: nTx, ty: nTy });
    }
  }
  return neighbors;
}

/**
 * Calculates the Manhattan distance between two tiles on the square grid.
 * This is the appropriate heuristic for A* with 4-way movement.
 * It's the number of steps needed to move from a to b by only moving
 * horizontally or vertically.
 * @param a - The first tile point.
 * @param b - The second tile point.
 * @returns The Manhattan distance.
 */
export function manhattanDistance(a: TilePoint, b: TilePoint): number {
  return Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);
}

/**
 * Calculates the Chebyshev distance between two tiles on the square grid.
 * This is the appropriate distance metric for calculating a square/diamond-shaped
 * radius, useful for things like Fog of War sight range.
 * It's the number of steps needed to move from a to b by also allowing
 * diagonal moves (which cost the same as cardinal moves in this metric).
 * @param a - The first tile point.
 * @param b - The second tile point.
 * @returns The Chebyshev distance.
 */
export function chebyshevDistance(a: TilePoint, b: TilePoint): number {
  return Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty));
}
