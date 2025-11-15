import { System, Entity } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import * as Components from '../components';
import { CivilizationRegistry } from '@engine/civilization/Civilization';
import { UnitFactory } from '@/utils/unitFactory';
import { BuildingFactory } from '@/utils/buildingFactory';
import { CityBorders } from '@/utils/cityBorders';
import { MapData } from '@engine/map/MapData';
import { UnitSprite } from '@platform/phaser/sprites/UnitSprite';
import { DEFAULT_CIVILIZATION_ID } from '@config/game';
import { logger } from '@/utils/logger';
import { CivilizationProductionSystem } from './CivilizationProductionSystem';
import Phaser from 'phaser';

/**
 * Handles city production.
 * Cities use civilization-level production to complete items in their queue.
 */
export class ProductionSystem extends System {
  private intents: IntentQueue;
  private events: Phaser.Events.EventEmitter;
  private unitFactory: UnitFactory | null = null;
  private gameScene: Phaser.Scene;
  private mapData: MapData;
  private civilizationProductionSystem: CivilizationProductionSystem;
  private civilizationRegistry: CivilizationRegistry;
  private unitSprites: Map<Entity, UnitSprite>;

  constructor(
    intents: IntentQueue,
    events: Phaser.Events.EventEmitter,
    gameScene: Phaser.Scene,
    civilizationRegistry: CivilizationRegistry,
    unitSprites: Map<Entity, UnitSprite>,
    mapData: MapData,
    civilizationProductionSystem: CivilizationProductionSystem,
  ) {
    super();
    this.intents = intents;
    this.events = events;
    this.gameScene = gameScene;
    this.mapData = mapData;
    this.civilizationProductionSystem = civilizationProductionSystem;
    this.civilizationRegistry = civilizationRegistry;
    this.unitSprites = unitSprites;
  }

  private getUnitFactory(): UnitFactory {
    if (!this.unitFactory) {
      // Create UnitFactory lazily once world is available
      this.unitFactory = new UnitFactory(this.world, this.gameScene, this.civilizationRegistry, this.unitSprites);
    }
    return this.unitFactory;
  }

  update(_dt: number): void {
    // Process production at the start of each turn
    const turnBegan = this.intents.peek(isIntent('TurnBegan'));
    if (!turnBegan) return;

    // Process all cities with production queues
    const cities = this.world.view(
      Components.City,
      Components.TransformTile,
      Components.ProductionQueue,
      Components.CivilizationComponent,
    );

    for (const cityEntity of cities) {
      const queue = this.world.getComponent(cityEntity, Components.ProductionQueue)!;
      const civilization = this.world.getComponent(cityEntity, Components.CivilizationComponent);

      // Get current production item
      const currentItem = queue.getCurrent();
      if (!currentItem) continue;

      // Get civilization ID (fallback to default if not set)
      const civId = civilization?.civId || DEFAULT_CIVILIZATION_ID;

      // Use production from civilization-level stockpile
      // Production is accumulated from cities and starting production by CivilizationProductionSystem
      const availableProduction = this.civilizationProductionSystem.getProduction(civId);
      const neededProduction = currentItem.cost - queue.currentProgress;
      const productionToUse = Math.min(availableProduction, neededProduction);
      
      queue.currentProgress += productionToUse;
      this.civilizationProductionSystem.spendProduction(civId, productionToUse);

      // Check if current item is complete
      if (queue.currentProgress >= currentItem.cost) {
        // Complete the item
        this.completeProduction(cityEntity, currentItem);
        
        // Remove completed item from queue
        queue.dequeue();
        queue.currentProgress = 0;

        // If there's a next item, start working on it
        const nextItem = queue.getCurrent();
        if (nextItem) {
          logger.debug(`City started producing: ${nextItem.name}`);
        }
      } else {
        // Show progress
        const remaining = currentItem.cost - queue.currentProgress;
        logger.debug(
          `City producing ${currentItem.name}: ${queue.currentProgress}/${currentItem.cost} (${remaining} remaining)`,
        );
      }
    }

    this.events.emit('ui-update');
  }

  /**
   * Completes a production item and creates the unit/building.
   */
  private completeProduction(cityEntity: Entity, item: Components.ProductionItem): void {
    if (item.type === 'unit') {
      this.completeUnitProduction(cityEntity, item.name);
    } else if (item.type === 'building') {
      this.completeBuildingProduction(cityEntity, item.name);
    }
  }

  /**
   * Completes building production and places the building.
   * Automatically places on city center if valid, otherwise finds first valid tile in city borders.
   */
  private completeBuildingProduction(cityEntity: Entity, buildingType: string): void {
    const transform = this.world.getComponent(cityEntity, Components.TransformTile);
    if (!transform) {
      logger.warn('Cannot produce building: city missing TransformTile');
      return;
    }

    // Try to place on city center first
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
      const building = BuildingFactory.createBuilding(
        this.world,
        buildingType,
        { tx: transform.tx, ty: transform.ty },
        cityEntity,
        this.gameScene,
        false, // ProductionSystem is for single-player queue completion, population changes allowed
      );
      if (building) {
        logger.debug(`Building ${buildingType} placed at city center (${transform.tx}, ${transform.ty})`);
        return;
      }
    }

    // If city center doesn't work, find first valid tile in city borders
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
        const building = BuildingFactory.createBuilding(
          this.world,
          buildingType,
          tile,
          cityEntity,
          this.gameScene,
          false, // ProductionSystem is for single-player queue completion, population changes allowed
        );
        if (building) {
          logger.debug(`Building ${buildingType} placed at (${tile.tx}, ${tile.ty})`);
          return;
        }
      }
    }

    logger.warn(`Could not find valid location to place building ${buildingType} for city`);
  }

  /**
   * Completes unit production and creates the unit.
   */
  private completeUnitProduction(cityEntity: Entity, unitType: string): void {
    const transform = this.world.getComponent(cityEntity, Components.TransformTile);
    const owner = this.world.getComponent(cityEntity, Components.Owner);
    const civilization = this.world.getComponent(cityEntity, Components.CivilizationComponent);

    if (!transform || !owner) {
      logger.warn('Cannot produce unit: city missing required components');
      return;
    }

    const civId = civilization?.civId || DEFAULT_CIVILIZATION_ID;
    const unit = this.getUnitFactory().createUnit(
      unitType,
      { tx: transform.tx, ty: transform.ty },
      owner.playerId,
      civId,
    );

    if (unit) {
      logger.debug(`Unit ${unitType} produced at city (${transform.tx}, ${transform.ty})`);
    }
  }
}

