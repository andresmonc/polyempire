import { System } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import { GameState } from '@/state/GameState';
import * as Components from '../components';
import { BuildingsData, BuildingFactory } from '@/utils/buildingFactory';
import { logger } from '@/utils/logger';
import { CivilizationProductionSystem } from './CivilizationProductionSystem';
import { MapData } from '@engine/map/MapData';
import { CityBorders } from '@/utils/cityBorders';
import { DEFAULT_CIVILIZATION_ID } from '@config/game';
import Phaser from 'phaser';

/**
 * Handles building production requests from cities.
 * Spends production immediately and creates buildings right away.
 */
export class ProduceBuildingSystem extends System {
  private intents: IntentQueue;
  private events: Phaser.Events.EventEmitter;
  private gameScene: Phaser.Scene;
  private gameState: GameState;
  private civilizationProductionSystem: CivilizationProductionSystem;
  private mapData: MapData;

  constructor(
    intents: IntentQueue,
    events: Phaser.Events.EventEmitter,
    gameScene: Phaser.Scene,
    gameState: GameState,
    civilizationProductionSystem: CivilizationProductionSystem,
    mapData: MapData,
  ) {
    super();
    this.intents = intents;
    this.events = events;
    this.gameScene = gameScene;
    this.gameState = gameState;
    this.civilizationProductionSystem = civilizationProductionSystem;
    this.mapData = mapData;
  }

  update(_dt: number): void {
    const produceBuilding = this.intents.pop(isIntent('ProduceBuilding'));
    if (!produceBuilding) return;

    const { cityEntity, buildingType } = produceBuilding.payload;

    // Verify the entity is a city and owned by the current active player
    const city = this.world.getComponent(cityEntity, Components.City);
    const owner = this.world.getComponent(cityEntity, Components.Owner);
    if (!city) {
      logger.warn('ProduceBuilding intent received for non-city entity');
      return;
    }
    if (!owner) {
      logger.warn('ProduceBuilding intent received for city without Owner');
      return;
    }
    
    // In multiplayer, check if this city belongs to the local player
    // In single-player, check if it belongs to the current player
    const canProduce = this.gameState.isMultiplayer
      ? owner.playerId === this.gameState.localPlayerId
      : this.gameState.isCurrentPlayer(owner.playerId);
    
    if (!canProduce) {
      logger.warn('ProduceBuilding intent received for city not owned by current player');
      return;
    }

    // Get base building data to get production cost
    try {
      const buildingsData = this.gameScene.cache.json.get('buildings') as BuildingsData;
      const baseBuildingData = buildingsData[buildingType];
      if (!baseBuildingData) {
        logger.warn(`Building type "${buildingType}" not found in buildings.json`);
        return;
      }

      const productionCost = baseBuildingData.productionCost || 50; // Default cost

      // Get civilization ID
      const civilization = this.world.getComponent(cityEntity, Components.CivilizationComponent);
      const civId = civilization?.civId || DEFAULT_CIVILIZATION_ID;

      // Check if we have enough production
      const availableProduction = this.civilizationProductionSystem.getProduction(civId);
      if (availableProduction < productionCost) {
        logger.warn(`Not enough production to produce ${buildingType}. Need ${productionCost}, have ${availableProduction}`);
        return;
      }

      // Get city position
      const transform = this.world.getComponent(cityEntity, Components.TransformTile);
      if (!transform) {
        logger.warn('Cannot produce building: city missing TransformTile');
        return;
      }

      // Try to place on city center first
      let buildingPlaced = false;
      const cityCenterCheck = BuildingFactory.canBuildOnTile(
        this.world,
        this.mapData,
        buildingType,
        transform.tx,
        transform.ty,
        cityEntity,
        this.gameScene,
      );

      if (cityCenterCheck.canBuild) {
        // Spend production before creating building
        const spent = this.civilizationProductionSystem.spendProduction(civId, productionCost);
        if (!spent) {
          logger.warn(`Failed to spend production for ${buildingType}`);
          return;
        }

        const building = BuildingFactory.createBuilding(
          this.world,
          buildingType,
          { tx: transform.tx, ty: transform.ty },
          cityEntity,
          this.gameScene,
          this.gameState.isMultiplayer, // Skip population changes in multiplayer - server is authoritative
        );
        if (building) {
          buildingPlaced = true;
          logger.debug(`Building ${buildingType} purchased and placed at city center (cost: ${productionCost}, remaining production: ${this.civilizationProductionSystem.getProduction(civId)})`);
        } else {
          // Refund production if building creation failed
          this.civilizationProductionSystem.addProduction(civId, productionCost);
        }
      }

      // If city center doesn't work, find first valid tile in city borders
      if (!buildingPlaced) {
        const cityTiles = CityBorders.getCityTiles(this.world, this.mapData, cityEntity);
        for (const tile of cityTiles) {
          const check = BuildingFactory.canBuildOnTile(
            this.world,
            this.mapData,
            buildingType,
            tile.tx,
            tile.ty,
            cityEntity,
            this.gameScene,
          );

          if (check.canBuild) {
            // Spend production before creating building
            const spent = this.civilizationProductionSystem.spendProduction(civId, productionCost);
            if (!spent) {
              logger.warn(`Failed to spend production for ${buildingType}`);
              return;
            }

            const building = BuildingFactory.createBuilding(
              this.world,
              buildingType,
              tile,
              cityEntity,
              this.gameScene,
              this.gameState.isMultiplayer, // Skip population changes in multiplayer - server is authoritative
            );
            if (building) {
              buildingPlaced = true;
              logger.debug(`Building ${buildingType} purchased and placed at (${tile.tx}, ${tile.ty}) (cost: ${productionCost}, remaining production: ${this.civilizationProductionSystem.getProduction(civId)})`);
              break;
            } else {
              // Refund production if building creation failed
              this.civilizationProductionSystem.addProduction(civId, productionCost);
            }
          }
        }
      }

      if (!buildingPlaced) {
        logger.warn(`Could not find valid location to place building ${buildingType} for city`);
      }
    } catch (error) {
      logger.error(`Failed to get building data for "${buildingType}":`, error);
    }

    this.events.emit('ui-update');
  }
}

