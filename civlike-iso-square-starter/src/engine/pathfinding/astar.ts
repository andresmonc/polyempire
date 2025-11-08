import { TilePoint } from '@engine/math/iso';
import { MapData } from '@engine/map/MapData';
import { getNeighbors, manhattanDistance } from '@engine/math/grid';

/**
 * A node in the pathfinding grid.
 */
interface PathNode {
  tx: number;
  ty: number;
  g: number; // Cost from start to this node
  h: number; // Heuristic cost from this node to end
  f: number; // g + h
  parent: PathNode | null;
}

/**
 * Finds the shortest path between two points on a grid using the A* algorithm.
 * The path is weighted by the `moveCost` of the terrain.
 *
 * @param start - The starting tile coordinate.
 * @param end - The ending tile coordinate.
 * @param mapData - The map data containing terrain information.
 * @returns An array of tile coordinates representing the path from start to end,
 *          or null if no path is found. The path includes the start and end points.
 */
export function findPath(
  start: TilePoint,
  end: TilePoint,
  mapData: MapData,
): TilePoint[] | null {
  const openSet = new Map<string, PathNode>();
  const closedSet = new Set<string>();

  const startNode: PathNode = {
    tx: start.tx,
    ty: start.ty,
    g: 0,
    h: manhattanDistance(start, end),
    f: manhattanDistance(start, end),
    parent: null,
  };

  const startKey = `${start.tx},${start.ty}`;
  openSet.set(startKey, startNode);

  while (openSet.size > 0) {
    // Find the node with the lowest f score in the open set
    let currentNode: PathNode | null = null;
    let currentKey = '';
    for (const [key, node] of openSet.entries()) {
      if (!currentNode || node.f < currentNode.f) {
        currentNode = node;
        currentKey = key;
      }
    }

    if (!currentNode) break; // Should not happen if openSet is not empty

    // If we reached the end, reconstruct the path
    if (currentNode.tx === end.tx && currentNode.ty === end.ty) {
      const path: TilePoint[] = [];
      let temp: PathNode | null = currentNode;
      while (temp) {
        path.push({ tx: temp.tx, ty: temp.ty });
        temp = temp.parent;
      }
      return path.reverse();
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    const neighbors = getNeighbors(
      currentNode.tx,
      currentNode.ty,
      mapData.getDimensions(),
    );

    for (const neighborPos of neighbors) {
      const neighborKey = `${neighborPos.tx},${neighborPos.ty}`;
      if (closedSet.has(neighborKey)) {
        continue;
      }

      const terrain = mapData.getTerrainAt(neighborPos.tx, neighborPos.ty);
      if (!terrain || terrain.blocked) {
        continue;
      }

      const gScore = currentNode.g + terrain.moveCost;

      let neighborNode = openSet.get(neighborKey);
      if (!neighborNode) {
        neighborNode = {
          tx: neighborPos.tx,
          ty: neighborPos.ty,
          g: gScore,
          h: manhattanDistance(neighborPos, end),
          f: gScore + manhattanDistance(neighborPos, end),
          parent: currentNode,
        };
        openSet.set(neighborKey, neighborNode);
      } else if (gScore < neighborNode.g) {
        // Found a better path to this neighbor
        neighborNode.parent = currentNode;
        neighborNode.g = gScore;
        neighborNode.f = gScore + neighborNode.h;
      }
    }
  }

  return null; // No path found
}
