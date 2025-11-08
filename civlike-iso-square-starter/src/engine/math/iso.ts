import { TILE_H, TILE_W } from '@config/game';
/**
 * This file contains the core isometric projection math.
 * It provides functions to convert between different coordinate systems:
 *
 * 1. Tile Coordinates (tx, ty): The logical grid coordinates on the square map.
 *    - (0,0) is the top-most corner of the diamond-shaped world.
 *
 * 2. World Coordinates (x, y): The position in pixels within the Phaser world,
 *    relative to the container holding the map. This is the system Phaser uses
 *    for sprite positions.
 *    - (0,0) corresponds to the center of the tile (0,0).
 *
 * 3. Screen Coordinates: The position in pixels on the screen/canvas, handled
 *    by the Phaser camera. We mostly work in world coordinates and let the
 *    camera handle the conversion to the screen.
 *
 * The key idea is to treat the isometric view as a transformation (rotation and scaling)
 * of a regular square grid.
 *
 * - Diamond Grid: Each tile is a diamond shape. TILE_W is the full width of the diamond,
 *   and TILE_H is the full height. For a classic 2:1 isometric view, TILE_W = 2 * TILE_H.
 */

export interface Point {
  x: number;
  y: number;
}

export interface TilePoint {
  tx: number;
  ty: number;
}

/**
 * Converts tile coordinates (logical grid) to world coordinates (pixel position).
 * This gives the center of the tile.
 * x = (tx - ty) * (TILE_W / 2)
 * y = (tx + ty) * (TILE_H / 2)
 * @param tx - The tile's x-coordinate.
 * @param ty - The tile's y-coordinate.
 * @returns The world coordinates (x, y) of the center of the tile.
 */
export function isoToWorld(tx: number, ty: number): Point {
  return {
    x: (tx - ty) * (TILE_W / 2),
    y: (tx + ty) * (TILE_H / 2),
  };
}

/**
 * Converts world coordinates (pixel position) back to tile coordinates (logical grid).
 * This is the inverse of the `isoToWorld` function.
 *
 * To derive the inverse:
 * x = (tx - ty) * W/2  =>  x / (W/2) = tx - ty  (1)
 * y = (tx + ty) * H/2  =>  y / (H/2) = tx + ty  (2)
 *
 * Add (1) and (2):
 * x/(W/2) + y/(H/2) = 2*tx  =>  tx = x/W + y/H
 *
 * Subtract (1) from (2):
 * y/(H/2) - x/(W/2) = 2*ty  =>  ty = y/H - x/W
 *
 * @param x - The world x-coordinate.
 * @param y - The world y-coordinate.
 * @returns The tile coordinates (tx, ty). The values are floats and need to be rounded.
 */
export function worldToIso(x: number, y: number): TilePoint {
  const tx = x / TILE_W + y / TILE_H;
  const ty = y / TILE_H - x / TILE_W;
  return { tx, ty };
}

/**
 * Snaps world coordinates to the nearest tile coordinate.
 * Due to the nature of the grid, simply rounding the floating point tile coordinates
 * from `worldToIso` is sufficient and accurate. There's no need for complex
 * checks or epsilon values unless the tile assets have significant empty space
 * or unusual shapes. For perfect diamond tiles, this works reliably.
 * @param x - The world x-coordinate.
 * @param y - The world y-coordinate.
 * @returns The snapped integer tile coordinates.
 */
export function worldToTile(x: number, y: number): TilePoint {
  const { tx, ty } = worldToIso(x, y);
  return {
    tx: Math.round(tx),
    ty: Math.round(ty),
  };
}

/**
 * A convenience function that combines `worldToIso` and rounding.
 * @param p - The world coordinate point.
 * @returns The snapped integer tile coordinates.
 */
export function worldToTilePoint(p: Point): TilePoint {
  return worldToTile(p.x, p.y);
}

/**
 * A convenience function to get the center of a tile in world coordinates.
 * @param tp - The tile coordinate point.
 * @returns The world coordinates of the tile's center.
 */
export function tileToWorld(tp: TilePoint): Point {
  return isoToWorld(tp.tx, tp.ty);
}
