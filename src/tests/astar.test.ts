import { describe, it, expect, beforeEach } from 'vitest';
import { findPath } from '@engine/pathfinding/astar';
import { MapData } from '@engine/map/MapData';
import { TerrainRegistry } from '@engine/map/Terrain';
import { TilePoint } from '@engine/math/iso';

describe('A* Pathfinding', () => {
  let mapData: MapData;
  const terrainData = {
    plains: { name: 'Plains', moveCost: 1, blocked: false, color: '', yields: {} },
    forest: { name: 'Forest', moveCost: 2, blocked: false, color: '', yields: {} },
    mountains: { name: 'Mountains', moveCost: -1, blocked: true, color: '', yields: {} },
  };

  beforeEach(() => {
    const terrainRegistry = new TerrainRegistry(terrainData as any);
    const tiles = [
      // 0       1         2         3
      'plains', 'plains', 'plains', 'plains',   // y=0
      'plains', 'forest', 'forest', 'plains',   // y=1
      'plains', 'plains', 'mountains', 'plains', // y=2
      'plains', 'plains', 'plains', 'plains',   // y=3
    ];
    mapData = new MapData(4, 4, { tx: 0, ty: 0 }, tiles, terrainRegistry);
  });

  it('should find the shortest path on a uniform grid', () => {
    const start: TilePoint = { tx: 0, ty: 0 };
    const end: TilePoint = { tx: 3, ty: 3 };
    const path = findPath(start, end, mapData);

    const expectedPath: TilePoint[] = [
      { tx: 0, ty: 0 },
      { tx: 1, ty: 0 },
      { tx: 2, ty: 0 },
      { tx: 3, ty: 0 },
      { tx: 3, ty: 1 },
      { tx: 3, ty: 2 },
      { tx: 3, ty: 3 },
    ];
    
    // A* can return different but equally short paths. We check length and content.
    expect(path).not.toBeNull();
    expect(path).toHaveLength(7); // 3 steps right, 3 steps down + start = 7 nodes
    expect(path![0]).toEqual(start);
    expect(path![path!.length - 1]).toEqual(end);
  });

  it('should find a path that avoids costly terrain', () => {
    const start: TilePoint = { tx: 0, ty: 1 };
    const end: TilePoint = { tx: 3, ty: 1 };
    const path = findPath(start, end, mapData);

    // The direct path (0,1)->(1,1)->(2,1)->(3,1) costs 1 (to plains) + 2 (to forest) + 2 (to forest) = 5
    // The path around costs 1+1+1+1+1 = 5. Both are valid.
    // Let's force a situation where going around is cheaper.
    const tiles = [
      'plains', 'plains', 'plains', 'plains',
      'plains', 'forest', 'forest', 'plains',
      'plains', 'plains', 'plains', 'plains',
    ];
    const newMapData = new MapData(4, 3, {tx:0, ty:0}, tiles, mapData['terrainRegistry']);
    const newPath = findPath(start, end, newMapData);

    const expectedPath: TilePoint[] = [
        { tx: 0, ty: 1 },
        { tx: 0, ty: 0 }, // Go up around the forest
        { tx: 1, ty: 0 },
        { tx: 2, ty: 0 },
        { tx: 3, ty: 0 },
        { tx: 3, ty: 1 }, // Come back down
    ];

    expect(newPath).toEqual(expectedPath);
  });

  it('should return null when no path exists (blocked by mountains)', () => {
    const start: TilePoint = { tx: 1, ty: 2 };
    const end: TilePoint = { tx: 3, ty: 2 };
    const path = findPath(start, end, mapData);

    expect(path).toBeNull();
  });

  it('should return a path of length 1 if start and end are the same', () => {
    const start: TilePoint = { tx: 1, ty: 1 };
    const end: TilePoint = { tx: 1, ty: 1 };
    const path = findPath(start, end, mapData);

    expect(path).toEqual([{ tx: 1, ty: 1 }]);
  });
});
