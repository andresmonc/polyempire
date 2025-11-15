import { System } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import { GameState } from '@/state/GameState';
import * as Components from '../components';
import { BuildingFactory } from '@/utils/buildingFactory';
import { BuildingsData } from '@/utils/buildingFactory';
import { CivilizationProductionSystem } from './CivilizationProductionSystem';
import { logger } from '@/utils/logger';
import { DEFAULT_CIVILIZATION_ID } from '@config/game';
import Phaser from 'phaser';

/**
 * Handles building placement on tiles.
 * When a building is completed in production, it needs to be placed on a tile.
 * This system handles the BuildBuilding intent to place buildings.
 * Multiplayer-safe: checks ownership and spends production.
 */
export class BuildBuildingSystem extends System {
  private intents: IntentQueue;
  private events: Phaser.Events.EventEmitter;
  private gameScene: Phaser.Scene;
  private gameState: GameState;
  private civilizationProductionSystem: CivilizationProductionSystem;

  constructor(
    intents: IntentQueue,
    events: Phaser.Events.EventEmitter,
    gameScene: Phaser.Scene,
    gameState: GameState,
    civilizationProductionSystem: CivilizationProductionSystem,
  ) {
    super();
    this.intents = intents;
    this.events = events;
    this.gameScene = gameScene;
    this.gameState = gameState;
    this.civilizationProductionSystem = civilizationProductionSystem;
  }

  update(_dt: number): void {
    const buildBuilding = this.intents.pop(isIntent('BuildBuilding'));
    if (!buildBuilding) return;

    const { cityEntity, buildingType, tx, ty } = buildBuilding.payload;

    // Verify the entity is a city
    const city = this.world.getComponent(cityEntity, Components.City);
    const owner = this.world.getComponent(cityEntity, Components.Owner);
    if (!city) {
      logger.warn('BuildBuilding intent received for non-city entity');
      return;
    }
    if (!owner) {
      logger.warn('BuildBuilding intent received for city without Owner');
      return;
    }

    // Multiplayer-safe: check ownership
    const canBuild = this.gameState.isMultiplayer
      ? owner.playerId === this.gameState.localPlayerId
      : this.gameState.isCurrentPlayer(owner.playerId);

    if (!canBuild) {
      logger.warn('BuildBuilding intent received for city not owned by current player');
      return;
    }

    // Get building data and production cost
    try {
      const buildingsData = this.gameScene.cache.json.get('buildings') as BuildingsData;
      const buildingData = buildingsData[buildingType];
      if (!buildingData) {
        logger.warn(`Building type "${buildingType}" not found in buildings.json`);
        return;
      }

      const productionCost = buildingData.productionCost || 50;

      // Get civilization ID
      const civilization = this.world.getComponent(cityEntity, Components.CivilizationComponent);
      const civId = civilization?.civId || DEFAULT_CIVILIZATION_ID;

      // Check if we have enough production
      const availableProduction = this.civilizationProductionSystem.getProduction(civId);
      if (availableProduction < productionCost) {
        logger.warn(`Not enough production to build ${buildingType}. Need ${productionCost}, have ${availableProduction}`);
        return;
      }

      // Check if building can be built on this tile
      const mapData = (this.gameScene as any).mapData;
      if (!mapData) {
        logger.warn('MapData not available in gameScene');
        return;
      }

      const canBuildOnTile = BuildingFactory.canBuildOnTile(
        this.world,
        mapData,
        buildingType,
        tx,
        ty,
        cityEntity,
        this.gameScene,
      );

      if (!canBuildOnTile.canBuild) {
        logger.warn(`Cannot build ${buildingType} at (${tx}, ${ty}): ${canBuildOnTile.reason}`);
        return;
      }

      // In multiplayer, skip optimistic production spending - wait for server confirmation
      // Server will handle production spending and building creation
      if (this.gameState.isMultiplayer) {
        // In multiplayer, we only process BuildBuilding intents from server state updates
        // Local BuildBuilding intents are sent to server and will come back via state sync
        // Skip population changes - server is authoritative
        const building = BuildingFactory.createBuilding(
          this.world,
          buildingType,
          { tx, ty },
          cityEntity,
          this.gameScene,
          true, // Skip population change - server is authoritative
        );
        
        if (building) {
          logger.info(`Building ${buildingType} placed at (${tx}, ${ty}) from server state`);
          this.events.emit('ui-update');
        }
        return;
      }

      // Single-player: spend production optimistically
      const spent = this.civilizationProductionSystem.spendProduction(civId, productionCost);
      if (!spent) {
        logger.warn(`Failed to spend production for ${buildingType}`);
        return;
      }

      // Create the building (population changes allowed in single-player)
      const building = BuildingFactory.createBuilding(
        this.world,
        buildingType,
        { tx, ty },
        cityEntity,
        this.gameScene,
        false, // Allow population changes in single-player
      );

      if (building) {
        logger.info(`Building ${buildingType} placed at (${tx}, ${ty}) (cost: ${productionCost}, remaining production: ${this.civilizationProductionSystem.getProduction(civId)})`);
        this.events.emit('ui-update');
      } else {
        // Refund production if building creation failed
        this.civilizationProductionSystem.addProduction(civId, productionCost);
        logger.warn(`Failed to place building ${buildingType} at (${tx}, ${ty})`);
      }
    } catch (error) {
      logger.error(`Failed to build building "${buildingType}":`, error);
    }
  }
}

