import { describe, it, expect, beforeEach } from 'vitest';
import { calculateMovementBudget } from '@engine/pathfinding/movementBudget';
import { MapData } from '@engine/map/MapData';
import { TerrainRegistry } from '@engine/map/Terrain';
import { TilePoint } from '@engine/math/iso';

describe('Movement Budget Calculation', () => {
  let mapData: MapData;
  const terrainData = {
    plains: { name: 'Plains', moveCost: 1, blocked: false, color: '', yields: {} },
    forest: { name: 'Forest', moveCost: 2, blocked: false, color: '', yields: {} },
  };

  beforeEach(() => {
    const terrainRegistry = new TerrainRegistry(terrainData as any);
    const tiles = [
      'plains', 'plains', 'forest', 'plains', 'plains',
      'plains', 'plains', 'plains', 'plains', 'plains',
    ];
    mapData = new MapData(5, 2, { tx: 0, ty: 0 }, tiles, terrainRegistry);
  });

  it('should consume the whole path if MP is sufficient', () => {
    const path: TilePoint[] = [
      { tx: 0, ty: 0 }, // Start
      { tx: 1, ty: 0 }, // Cost 1
      { tx: 2, ty: 0 }, // Cost 2
    ];
    const movementPoints = 5;
    const result = calculateMovementBudget(path, movementPoints, mapData);

    expect(result.consumedSteps).toHaveLength(2);
    expect(result.consumedSteps[0].pos).toEqual({ tx: 1, ty: 0 });
    expect(result.consumedSteps[1].pos).toEqual({ tx: 2, ty: 0 });
    expect(result.remainingPath).toEqual([{ tx: 2, ty: 0 }]); // Path from the last consumed tile
    expect(result.remainingMp).toBe(2); // 5 - 1 - 2 = 2
  });

  it('should stop when MP is exactly exhausted', () => {
    const path: TilePoint[] = [
      { tx: 0, ty: 0 }, // Start
      { tx: 1, ty: 0 }, // Cost 1
      { tx: 2, ty: 0 }, // Cost 2
    ];
    const movementPoints = 3;
    const result = calculateMovementBudget(path, movementPoints, mapData);

    expect(result.consumedSteps).toHaveLength(2);
    expect(result.remainingPath).toEqual([{ tx: 2, ty: 0 }]);
    expect(result.remainingMp).toBe(0); // 3 - 1 - 2 = 0
  });

  it('should stop part-way through if MP is insufficient for the next step', () => {
    const path: TilePoint[] = [
      { tx: 0, ty: 0 }, // Start
      { tx: 1, ty: 0 }, // Cost 1
      { tx: 2, ty: 0 }, // Cost 2 (cannot afford)
      { tx: 3, ty: 0 }, // Cost 1
    ];
    const movementPoints = 2;
    const result = calculateMovementBudget(path, movementPoints, mapData);

    expect(result.consumedSteps).toHaveLength(1);
    expect(result.consumedSteps[0].pos).toEqual({ tx: 1, ty: 0 });
    expect(result.remainingPath).toEqual([
      { tx: 1, ty: 0 },
      { tx: 2, ty: 0 },
      { tx: 3, ty: 0 },
    ]);
    expect(result.remainingMp).toBe(1); // 2 - 1 = 1
  });

  it('should consume no steps if the first step is too expensive', () => {
    const path: TilePoint[] = [
      { tx: 1, ty: 0 }, // Start
      { tx: 2, ty: 0 }, // Cost 2
    ];
    const movementPoints = 1;
    const result = calculateMovementBudget(path, movementPoints, mapData);

    expect(result.consumedSteps).toHaveLength(0);
    expect(result.remainingPath).toEqual(path); // Path is unchanged
    expect(result.remainingMp).toBe(1);
  });

  it('should handle an empty path', () => {
    const path: TilePoint[] = [{ tx: 0, ty: 0 }];
    const result = calculateMovementBudget(path, 5, mapData);
    expect(result.consumedSteps).toHaveLength(0);
    expect(result.remainingPath).toEqual(path);
    expect(result.remainingMp).toBe(5);
  });
});
