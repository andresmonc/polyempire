/**
 * Represents a single type of terrain.
 */
export interface Terrain {
  id: string; // e.g., "plains", "forest"
  name: string;
  moveCost: number; // Cost to enter a tile of this terrain. -1 for blocked.
  blocked: boolean; // Is this terrain impassable?
  color: string; // Hex string for rendering, e.g., "0x8a9a5b" (used as fallback if texture is not provided)
  texture?: string; // Optional texture key for custom tile images (must be loaded in BootScene)
  yields: {
    // TODO: For future gameplay
    food: number;
    prod: number;
    gold: number;
  };
}

/**
 * A registry for all available terrain types, loaded from JSON.
 */
export class TerrainRegistry {
  private terrains: Map<string, Terrain> = new Map();

  constructor(terrainData: Record<string, Omit<Terrain, 'id'>>) {
    for (const id in terrainData) {
      this.terrains.set(id, { id, ...terrainData[id] });
    }
  }

  public get(id: string): Terrain | undefined {
    return this.terrains.get(id);
  }

  public mustGet(id: string): Terrain {
    const terrain = this.get(id);
    if (!terrain) {
      throw new Error(`Terrain with id "${id}" not found.`);
    }
    return terrain;
  }

  public getAll(): Terrain[] {
    return Array.from(this.terrains.values());
  }
}
