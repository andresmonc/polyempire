import { TilePoint } from '@engine/math/iso';
import { MapData } from '@engine/map/MapData';
import { Terrain } from '@engine/map/Terrain';

/**
 * Configuration for starting position generation
 */
export interface StartingPositionConfig {
  minDistance: number; // Minimum distance between starting positions (in tiles)
  maxAttempts: number; // Maximum attempts to find valid positions
  preferGoodTerrain: boolean; // Whether to prefer good terrain (plains, grassland)
}

const DEFAULT_CONFIG: StartingPositionConfig = {
  minDistance: 8, // Minimum 8 tiles apart
  maxAttempts: 1000,
  preferGoodTerrain: true,
};

/**
 * Calculate Manhattan distance between two tile points
 */
function manhattanDistance(p1: TilePoint, p2: TilePoint): number {
  return Math.abs(p1.tx - p2.tx) + Math.abs(p1.ty - p2.ty);
}

/**
 * Check if a position is valid for starting (not water, not too close to edge)
 */
function isValidStartingPosition(
  tx: number,
  ty: number,
  mapData: MapData,
  existingPositions: TilePoint[],
  minDistance: number,
): boolean {
  // Check bounds
  if (tx < 2 || tx >= mapData.width - 2 || ty < 2 || ty >= mapData.height - 2) {
    return false;
  }

  // Check terrain - avoid water and impassable terrain
  const terrain = mapData.getTerrainAt(tx, ty);
  if (!terrain || terrain.isWater || !terrain.isPassable) {
    return false;
  }

  // Check distance from existing positions
  const position: TilePoint = { tx, ty };
  for (const existing of existingPositions) {
    if (manhattanDistance(position, existing) < minDistance) {
      return false;
    }
  }

  return true;
}

/**
 * Get a terrain score for starting position preference
 * Higher score = better starting position
 */
function getTerrainScore(tx: number, ty: number, mapData: MapData): number {
  const terrain = mapData.getTerrainAt(tx, ty);
  if (!terrain) return -1;

  // Prefer plains and grassland
  if (terrain.id === 'plains' || terrain.id === 'grassland') {
    return 3;
  }
  // Accept other passable terrain
  if (terrain.isPassable && !terrain.isWater) {
    return 1;
  }
  return -1;
}

/**
 * Generate random starting positions for multiple players
 * Ensures minimum distance between players while keeping positions random
 */
export function generateStartingPositions(
  numPlayers: number,
  mapData: MapData,
  config: Partial<StartingPositionConfig> = {},
): TilePoint[] {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const positions: TilePoint[] = [];
  const { width, height } = mapData.getDimensions();

  // Try to place each player
  for (let playerIndex = 0; playerIndex < numPlayers; playerIndex++) {
    let position: TilePoint | null = null;
    let attempts = 0;

    // Collect candidate positions
    const candidates: Array<{ pos: TilePoint; score: number }> = [];

    // If we prefer good terrain, first collect all valid candidates with scores
    if (finalConfig.preferGoodTerrain) {
      for (let ty = 2; ty < height - 2; ty++) {
        for (let tx = 2; tx < width - 2; tx++) {
          if (isValidStartingPosition(tx, ty, mapData, positions, finalConfig.minDistance)) {
            const score = getTerrainScore(tx, ty, mapData);
            if (score > 0) {
              candidates.push({ pos: { tx, ty }, score });
            }
          }
        }
      }

      // Sort by score (higher is better)
      candidates.sort((a, b) => b.score - a.score);

      // Pick from top candidates with some randomness
      if (candidates.length > 0) {
        // Take top 30% of candidates, or at least 10, whichever is larger
        const topCandidates = candidates.slice(
          0,
          Math.max(10, Math.floor(candidates.length * 0.3)),
        );
        const randomIndex = Math.floor(Math.random() * topCandidates.length);
        position = topCandidates[randomIndex].pos;
      }
    }

    // If we didn't find a position yet, try random placement
    if (!position) {
      while (attempts < finalConfig.maxAttempts && !position) {
        const tx = Math.floor(Math.random() * (width - 4)) + 2;
        const ty = Math.floor(Math.random() * (height - 4)) + 2;

        if (isValidStartingPosition(tx, ty, mapData, positions, finalConfig.minDistance)) {
          position = { tx, ty };
        }
        attempts++;
      }
    }

    // If we still don't have a position, use a fallback strategy
    if (!position) {
      // Fallback: place at increasing distance from center
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      const angle = (playerIndex * 2 * Math.PI) / numPlayers;
      const radius = finalConfig.minDistance * (playerIndex + 1) * 0.5;
      const tx = Math.floor(centerX + radius * Math.cos(angle));
      const ty = Math.floor(centerY + radius * Math.sin(angle));

      // Clamp to valid bounds
      const clampedTx = Math.max(2, Math.min(width - 3, tx));
      const clampedTy = Math.max(2, Math.min(height - 3, ty));

      position = { tx: clampedTx, ty: clampedTy };
    }

    if (position) {
      positions.push(position);
    } else {
      throw new Error(
        `Failed to generate starting position for player ${playerIndex + 1} after ${finalConfig.maxAttempts} attempts`,
      );
    }
  }

  return positions;
}

/**
 * Generate a single starting position (for single-player or first player)
 */
export function generateSingleStartingPosition(
  mapData: MapData,
  config: Partial<StartingPositionConfig> = {},
): TilePoint {
  const positions = generateStartingPositions(1, mapData, config);
  return positions[0];
}

