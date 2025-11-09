import { World, Entity } from '@engine/ecs';
import * as Components from '@engine/gameplay/components';
import { MapData } from '@engine/map/MapData';
import { tileToWorld } from '@engine/math/iso';
import { CityBorders } from './cityBorders';
import { logger } from './logger';
import Phaser from 'phaser';

/**
 * Building data structure from buildings.json
 */
export interface BuildingData {
  name: string;
  productionCost: number;
  yields?: { food?: number; production?: number; gold?: number };
  cityBonus?: { populationGrowth?: number };
  terrainRequirements?: string[]; // Array of terrain types this building can be built on
  description?: string;
}

/**
 * Buildings data structure from cache
 */
export interface BuildingsData {
  [buildingType: string]: BuildingData;
}

/**
 * Centralized utility for building operations.
 */
export class BuildingFactory {
  /**
   * Gets building data from cache with proper typing.
   */
  static getBuildingData(gameScene: Phaser.Scene, buildingType: string): BuildingData | null {
    try {
      const buildingsData = gameScene.cache.json.get('buildings') as BuildingsData;
      const buildingData = buildingsData[buildingType];
      if (!buildingData) {
        logger.warn(`Building type "${buildingType}" not found in buildings.json`);
        return null;
      }
      return buildingData;
    } catch (error) {
      logger.error(`Failed to get building data for "${buildingType}":`, error);
      return null;
    }
  }

  /**
   * Checks if a building can be built on a specific tile.
   */
  static canBuildOnTile(
    world: World,
    mapData: MapData,
    buildingType: string,
    tx: number,
    ty: number,
    cityEntity: Entity,
    gameScene: Phaser.Scene,
  ): { canBuild: boolean; reason?: string } {
    // Check if tile is within city borders
    const owningCity = CityBorders.getOwningCity(world, mapData, tx, ty);
    if (owningCity !== cityEntity) {
      return { canBuild: false, reason: 'Tile is not within city borders' };
    }

    // Check if there's already a building on this tile
    const buildings = world.view(Components.Building, Components.TransformTile);
    for (const buildingEntity of buildings) {
      const pos = world.getComponent(buildingEntity, Components.TransformTile);
      if (pos && pos.tx === tx && pos.ty === ty) {
        return { canBuild: false, reason: 'Tile already has a building' };
      }
    }

    // Get building data
    const buildingData = this.getBuildingData(gameScene, buildingType);
    if (!buildingData) {
      return { canBuild: false, reason: 'Building type not found' };
    }

    // Check terrain requirements
    if (buildingData.terrainRequirements && buildingData.terrainRequirements.length > 0) {
      const terrain = mapData.getTerrainAt(tx, ty);
      if (!terrain || !buildingData.terrainRequirements.includes(terrain.id)) {
        return {
          canBuild: false,
          reason: `Building requires terrain: ${buildingData.terrainRequirements.join(', ')}`,
        };
      }
    }

    return { canBuild: true };
  }

  /**
   * Creates a building entity on a tile.
   */
  static createBuilding(
    world: World,
    buildingType: string,
    position: { tx: number; ty: number },
    cityEntity: Entity,
    gameScene: Phaser.Scene,
  ): Entity | null {
    const buildingData = this.getBuildingData(gameScene, buildingType);
    if (!buildingData) {
      return null;
    }

    // Check if we can build here
    const mapData = (gameScene as any).mapData as MapData;
    const canBuild = this.canBuildOnTile(
      world,
      mapData,
      buildingType,
      position.tx,
      position.ty,
      cityEntity,
      gameScene,
    );

    if (!canBuild.canBuild) {
      logger.warn(`Cannot build ${buildingType} at (${position.tx}, ${position.ty}): ${canBuild.reason}`);
      return null;
    }

    // Get city owner and civilization
    const owner = world.getComponent(cityEntity, Components.Owner);
    const civilization = world.getComponent(cityEntity, Components.CivilizationComponent);

    if (!owner) {
      logger.warn('Cannot create building: city has no owner');
      return null;
    }

    // Create building entity
    const building = world.createEntity();
    world.addComponent(building, new Components.TransformTile(position.tx, position.ty));
    world.addComponent(building, new Components.Building(
      buildingType,
      buildingData.yields || {},
      buildingData.cityBonus || {},
    ));
    world.addComponent(building, new Components.Owner(owner.playerId));
    if (civilization) {
      world.addComponent(building, new Components.CivilizationComponent(civilization.civId));
    }

    // Create ScreenPos for the building
    const worldPos = tileToWorld(position);
    world.addComponent(building, new Components.ScreenPos(worldPos.x, worldPos.y));

    logger.info(`Building ${buildingType} created at (${position.tx}, ${position.ty})`);
    return building;
  }
}

