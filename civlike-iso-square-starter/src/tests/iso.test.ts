import { describe, it, expect } from 'vitest';
import { isoToWorld, worldToIso, worldToTile } from '@engine/math/iso';
import { TILE_H, TILE_W } from '@config/game';

// Set tile dimensions for tests, assuming a 2:1 ratio
const W = TILE_W;
const H = TILE_H;

describe('Isometric Math Utilities', () => {
  describe('isoToWorld', () => {
    it('should correctly convert tile coordinates to world coordinates', () => {
      // Tile (0,0) should be at the world origin
      expect(isoToWorld(0, 0)).toEqual({ x: 0, y: 0 });

      // Tile (1,0)
      expect(isoToWorld(1, 0)).toEqual({ x: W / 2, y: H / 2 });

      // Tile (0,1)
      expect(isoToWorld(0, 1)).toEqual({ x: -W / 2, y: H / 2 });

      // Tile (1,1)
      expect(isoToWorld(1, 1)).toEqual({ x: 0, y: H });

      // Negative coordinates
      expect(isoToWorld(-1, 0)).toEqual({ x: -W / 2, y: -H / 2 });
    });
  });

  describe('worldToIso', () => {
    it('should be the inverse of isoToWorld', () => {
      const testPoints = [
        { tx: 0, ty: 0 },
        { tx: 1, ty: 0 },
        { tx: 0, ty: 1 },
        { tx: 1, ty: 1 },
        { tx: 5, ty: 8 },
        { tx: -3, ty: 2 },
      ];

      for (const point of testPoints) {
        const worldPos = isoToWorld(point.tx, point.ty);
        const convertedBack = worldToIso(worldPos.x, worldPos.y);
        expect(convertedBack.tx).toBeCloseTo(point.tx);
        expect(convertedBack.ty).toBeCloseTo(point.ty);
      }
    });
  });

  describe('worldToTile', () => {
    it('should snap world coordinates to the correct tile', () => {
      // Test the center of a tile
      let worldPos = isoToWorld(3, 4);
      expect(worldToTile(worldPos.x, worldPos.y)).toEqual({ tx: 3, ty: 4 });

      // Test a point slightly offset from the center
      worldPos = isoToWorld(5, 2);
      expect(worldToTile(worldPos.x + 1, worldPos.y - 1)).toEqual({
        tx: 5,
        ty: 2,
      });

      // Test a point exactly on the boundary between four tiles
      // e.g., the point where (0,0), (1,0), (0,1), (1,1) meet
      worldPos = { x: 0, y: H / 2 }; // This is on the edge of (0,0) and (0,1)
      const tile = worldToTile(worldPos.x, worldPos.y);
      // The rounding might push it to either, which is acceptable.
      // Let's check if it's one of the expected neighbors.
      const isAcceptable =
        (tile.tx === 0 && tile.ty === 0) || (tile.tx === 0 && tile.ty === 1);
      expect(isAcceptable).toBe(true);
    });

    it('should handle negative coordinates correctly', () => {
      const worldPos = isoToWorld(-2, -5);
      expect(worldToTile(worldPos.x, worldPos.y)).toEqual({ tx: -2, ty: -5 });
    });
  });
});
