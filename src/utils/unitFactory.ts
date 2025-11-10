import { World, Entity } from '@engine/ecs';
import * as Components from '@engine/gameplay/components';
import { mergeUnitData, getUnitSpriteKey, CivilizationRegistry } from '@engine/civilization/Civilization';
import { tileToWorld } from '@engine/math/iso';
import { UnitSprite } from '@platform/phaser/sprites/UnitSprite';
import Phaser from 'phaser';
import { logger } from './logger';

/**
 * Unit data structure from units.json
 */
export interface UnitData {
  name: string;
  mp: number;
  sightRange: number;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  canAttack: boolean;
  productionCost?: number;
}

/**
 * Units data structure from cache
 */
export interface UnitsData {
  [unitType: string]: UnitData;
}

/**
 * Centralized utility for creating units.
 * Eliminates code duplication between ProductionSystem and GameScene.
 */
export class UnitFactory {
  constructor(
    private world: World,
    private gameScene: Phaser.Scene,
    private civilizationRegistry: CivilizationRegistry,
    private unitSprites: Map<Entity, UnitSprite>,
  ) {}

  /**
   * Gets unit data from cache with proper typing.
   */
  getUnitData(unitType: string): UnitData | null {
    try {
      const unitsData = this.gameScene.cache.json.get('units') as UnitsData;
      const unitData = unitsData[unitType];
      if (!unitData) {
        logger.warn(`Unit type "${unitType}" not found in units.json`);
        return null;
      }
      return unitData;
    } catch (error) {
      logger.error(`Failed to get unit data for "${unitType}":`, error);
      return null;
    }
  }

  /**
   * Creates a unit entity at the specified position.
   */
  createUnit(
    unitType: string,
    position: { tx: number; ty: number },
    ownerId: number,
    civId: string = 'romans',
  ): Entity | null {
    // Get base unit data
    const baseUnitData = this.getUnitData(unitType);
    if (!baseUnitData) {
      return null;
    }

    // Get civilization and apply overrides
    const civ = this.civilizationRegistry.get(civId);
    if (!civ) {
      console.error(`[UnitFactory.createUnit] Civilization ${civId} not found in registry`);
      return null;
    }
    const unitOverride = civ?.units?.[unitType];
    const mergedUnitData = mergeUnitData(baseUnitData, unitOverride);

    // Get sprite key with civilization override
    const unitSpriteKey = getUnitSpriteKey('unit', civ?.sprites);

    // Create the unit entity
    const unit = this.world.createEntity();
    this.world.addComponent(unit, new Components.TransformTile(position.tx, position.ty));
    this.world.addComponent(unit, new Components.Unit(
      mergedUnitData.mp,
      mergedUnitData.mp,
      mergedUnitData.sightRange,
      mergedUnitData.health,
      mergedUnitData.maxHealth,
      mergedUnitData.attack,
      mergedUnitData.defense,
      mergedUnitData.canAttack,
    ));
    this.world.addComponent(unit, new Components.UnitType(unitType));
    this.world.addComponent(unit, new Components.Owner(ownerId));
    this.world.addComponent(unit, new Components.CivilizationComponent(civId));
    this.world.addComponent(unit, new Components.Selectable());

    // Create ScreenPos for the unit
    const worldPos = tileToWorld(position);
    this.world.addComponent(unit, new Components.ScreenPos(worldPos.x, worldPos.y));

    // Create unit sprite
    try {
      const unitSprite = new UnitSprite(this.gameScene, worldPos.x, worldPos.y, unitSpriteKey);
      this.gameScene.add.existing(unitSprite);
      this.unitSprites.set(unit, unitSprite);
      logger.debug(`Unit ${unitType} created at (${position.tx}, ${position.ty})`);
      return unit;
    } catch (error) {
      console.error(`[UnitFactory.createUnit] Error creating sprite:`, error);
      // Clean up entity if sprite creation failed
      this.world.destroyEntity(unit);
      return null;
    }
  }
}

