import { System } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import * as Components from '../components';
import { BuildingFactory } from '@/utils/buildingFactory';
import { logger } from '@/utils/logger';
import Phaser from 'phaser';

/**
 * Handles building placement on tiles.
 * When a building is completed in production, it needs to be placed on a tile.
 * This system handles the BuildBuilding intent to place buildings.
 */
export class BuildBuildingSystem extends System {
  private intents: IntentQueue;
  private events: Phaser.Events.EventEmitter;
  private gameScene: Phaser.Scene;

  constructor(intents: IntentQueue, events: Phaser.Events.EventEmitter, gameScene: Phaser.Scene) {
    super();
    this.intents = intents;
    this.events = events;
    this.gameScene = gameScene;
  }

  update(_dt: number): void {
    const buildBuilding = this.intents.pop(isIntent('BuildBuilding'));
    if (!buildBuilding) return;

    const { cityEntity, buildingType, tx, ty } = buildBuilding.payload;

    // Verify the entity is a city
    const city = this.world.getComponent(cityEntity, Components.City);
    if (!city) {
      logger.warn('BuildBuilding intent received for non-city entity');
      return;
    }

    // Create the building
    const building = BuildingFactory.createBuilding(
      this.world,
      buildingType,
      { tx, ty },
      cityEntity,
      this.gameScene,
    );

    if (building) {
      logger.info(`Building ${buildingType} placed at (${tx}, ${ty})`);
      this.events.emit('ui-update');
    } else {
      logger.warn(`Failed to place building ${buildingType} at (${tx}, ${ty})`);
    }
  }
}

