import { TilePoint } from '@engine/math/iso';
import { Terrain, TerrainRegistry } from './Terrain';

/**
 * Represents the static data for a game map.
 * This includes its dimensions, the grid of terrain tiles, and start position.
 */
export class MapData {
  public readonly width: number;
  public readonly height: number;
  public readonly startPos: TilePoint;

  // 1D array storing terrain IDs for each tile, indexed by `ty * width + tx`.
  private tiles: string[];
  private terrainRegistry: TerrainRegistry;

  constructor(
    width: number,
    height: number,
    startPos: TilePoint,
    tiles: string[],
    terrainRegistry: TerrainRegistry,
  ) {
    this.width = width;
    this.height = height;
    this.startPos = startPos;
    this.tiles = tiles;
    this.terrainRegistry = terrainRegistry;

    if (tiles.length !== width * height) {
      throw new Error(
        'Map data size does not match dimensions (width * height).',
      );
    }
  }

  public getDimensions() {
    return { width: this.width, height: this.height };
  }

  private getTileIndex(tx: number, ty: number): number {
    return ty * this.width + tx;
  }

  /**
   * Gets the terrain type ID for a specific tile coordinate.
   * @param tx - The tile's x-coordinate.
   * @param ty - The tile's y-coordinate.
   * @returns The terrain ID string, or undefined if out of bounds.
   */
  public getTerrainIdAt(tx: number, ty: number): string | undefined {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) {
      return undefined;
    }
    return this.tiles[this.getTileIndex(tx, ty)];
  }

  /**
   * Gets the full Terrain object for a specific tile coordinate.
   * @param tx - The tile's x-coordinate.
   * @param ty - The tile's y-coordinate.
   * @returns The Terrain object, or undefined if out of bounds.
   */
  public getTerrainAt(tx: number, ty: number): Terrain | undefined {
    const terrainId = this.getTerrainIdAt(tx, ty);
    return terrainId ? this.terrainRegistry.get(terrainId) : undefined;
  }

  /**
   * A convenience method that throws an error if the terrain is not found.
   */
  public mustGetTerrainAt(tx: number, ty: number): Terrain {
    const terrain = this.getTerrainAt(tx, ty);
    if (!terrain) {
      throw new Error(`No terrain found at (${tx}, ${ty})`);
    }
    return terrain;
  }
}
