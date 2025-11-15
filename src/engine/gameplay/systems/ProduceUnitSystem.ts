import { System, Entity } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import { GameState } from '@/state/GameState';
import * as Components from '../components';
import { UnitsData, UnitFactory } from '@/utils/unitFactory';
import { logger } from '@/utils/logger';
import { CivilizationProductionSystem } from './CivilizationProductionSystem';
import { CivilizationRegistry } from '@engine/civilization/Civilization';
import { UnitSprite } from '@platform/phaser/sprites/UnitSprite';
import { DEFAULT_CIVILIZATION_ID } from '@config/game';
import Phaser from 'phaser';

/**
 * Handles unit production requests from cities.
 * Spends production immediately and creates units right away.
 * Units created this turn cannot act until the next turn.
 */
export class ProduceUnitSystem extends System {
  private intents: IntentQueue;
  private events: Phaser.Events.EventEmitter;
  private gameScene: Phaser.Scene;
  private gameState: GameState;
  private civilizationProductionSystem: CivilizationProductionSystem;
  private civilizationRegistry: CivilizationRegistry;
  private unitSprites: Map<Entity, UnitSprite>;
  private unitFactory: UnitFactory | null = null;

  constructor(
    intents: IntentQueue,
    events: Phaser.Events.EventEmitter,
    gameScene: Phaser.Scene,
    gameState: GameState,
    civilizationProductionSystem: CivilizationProductionSystem,
    civilizationRegistry: CivilizationRegistry,
    unitSprites: Map<Entity, UnitSprite>,
  ) {
    super();
    this.intents = intents;
    this.events = events;
    this.gameScene = gameScene;
    this.gameState = gameState;
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
    const produceUnit = this.intents.pop(isIntent('ProduceUnit'));
    if (!produceUnit) return;

    const { cityEntity, unitType } = produceUnit.payload;

    // Verify the entity is a city and owned by the current active player
    const city = this.world.getComponent(cityEntity, Components.City);
    const owner = this.world.getComponent(cityEntity, Components.Owner);
    if (!city) {
      logger.warn('ProduceUnit intent received for non-city entity');
      return;
    }
    if (!owner) {
      logger.warn('ProduceUnit intent received for city without Owner');
      return;
    }
    
    // In multiplayer, check if this city belongs to the local player
    // In single-player, check if it belongs to the current player
    const canProduce = this.gameState.isMultiplayer
      ? owner.playerId === this.gameState.localPlayerId
      : this.gameState.isCurrentPlayer(owner.playerId);
    
    if (!canProduce) {
      logger.warn('ProduceUnit intent received for city not owned by current player');
      return;
    }

    // Get base unit data to get production cost
    try {
      const unitsData = this.gameScene.cache.json.get('units') as UnitsData;
      const baseUnitData = unitsData[unitType];
      if (!baseUnitData) {
        logger.warn(`Unit type "${unitType}" not found in units.json`);
        return;
      }

      const productionCost = baseUnitData.productionCost || 50; // Default cost

      // Get civilization ID
      const civilization = this.world.getComponent(cityEntity, Components.CivilizationComponent);
      const civId = civilization?.civId || DEFAULT_CIVILIZATION_ID;

      // Check if we have enough production
      const availableProduction = this.civilizationProductionSystem.getProduction(civId);
      if (availableProduction < productionCost) {
        logger.warn(`Not enough production to produce ${unitType}. Need ${productionCost}, have ${availableProduction}`);
        return;
      }

      // Spend production immediately
      const spent = this.civilizationProductionSystem.spendProduction(civId, productionCost);
      if (!spent) {
        logger.warn(`Failed to spend production for ${unitType}`);
        return;
      }

      // Get city position
      const transform = this.world.getComponent(cityEntity, Components.TransformTile);
      if (!transform) {
        logger.warn('Cannot produce unit: city missing TransformTile');
        return;
      }

      // Create unit immediately
      const unit = this.getUnitFactory().createUnit(
        unitType,
        { tx: transform.tx, ty: transform.ty },
        owner.playerId,
        civId,
      );

      if (unit) {
        // Mark unit as newly purchased so it can't act this turn
        this.world.addComponent(unit, new Components.NewlyPurchased());
        logger.debug(`Unit ${unitType} purchased and created immediately (cost: ${productionCost}, remaining production: ${this.civilizationProductionSystem.getProduction(civId)})`);
      } else {
        // Refund production if unit creation failed
        this.civilizationProductionSystem.addProduction(civId, productionCost);
        logger.error(`Failed to create unit ${unitType}, production refunded`);
      }
    } catch (error) {
      logger.error(`Failed to get unit data for "${unitType}":`, error);
    }

    this.events.emit('ui-update');
  }
}

