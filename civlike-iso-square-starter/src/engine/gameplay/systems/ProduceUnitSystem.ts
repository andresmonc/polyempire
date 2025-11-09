import { System } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import * as Components from '../components';
import { mergeUnitData, getUnitSpriteKey } from '@engine/civilization/Civilization';
import { tileToWorld } from '@engine/math/iso';
import { UnitSprite } from '@platform/phaser/sprites/UnitSprite';
import Phaser from 'phaser';

/**
 * Handles unit production from cities.
 * When a city produces a unit, it creates the unit at the city's location.
 */
export class ProduceUnitSystem extends System {
  private intents: IntentQueue;
  private events: Phaser.Events.EventEmitter;
  private gameScene: Phaser.Scene;
  private civilizationRegistry: any;
  private unitSprites: Map<number, any>;

  constructor(
    intents: IntentQueue,
    events: Phaser.Events.EventEmitter,
    gameScene: Phaser.Scene,
    civilizationRegistry: any,
    unitSprites: Map<number, any>,
  ) {
    super();
    this.intents = intents;
    this.events = events;
    this.gameScene = gameScene;
    this.civilizationRegistry = civilizationRegistry;
    this.unitSprites = unitSprites;
  }

  update(_dt: number): void {
    const produceUnit = this.intents.pop(isIntent('ProduceUnit'));
    if (!produceUnit) return;

    const { cityEntity, unitType } = produceUnit.payload;

    // Verify the entity is a city
    const city = this.world.getComponent(cityEntity, Components.City);
    if (!city) {
      console.warn('ProduceUnit intent received for non-city entity');
      return;
    }

    // Get the city's position
    const transform = this.world.getComponent(cityEntity, Components.TransformTile);
    if (!transform) {
      console.warn('ProduceUnit intent received for city without TransformTile');
      return;
    }

    // Get the city's owner and civilization
    const owner = this.world.getComponent(cityEntity, Components.Owner);
    if (!owner) {
      console.warn('ProduceUnit intent received for city without Owner');
      return;
    }

    const civilization = this.world.getComponent(cityEntity, Components.CivilizationComponent);
    const civId = civilization?.civId || 'romans';
    const civ = this.civilizationRegistry.get(civId);

    // Get base unit data and apply civilization overrides
    const unitsData = (this.gameScene.cache.json.get('units') as any);
    const baseUnitData = unitsData[unitType];
    if (!baseUnitData) {
      console.warn(`Unit type "${unitType}" not found in units.json`);
      return;
    }

    const unitOverride = civ?.units?.[unitType];
    const mergedUnitData = mergeUnitData(baseUnitData, unitOverride);

    // Get sprite key with civilization override
    const unitSpriteKey = getUnitSpriteKey('unit', civ?.sprites);

    // Create the unit entity
    const unit = this.world.createEntity();
    this.world.addComponent(unit, new Components.TransformTile(transform.tx, transform.ty));
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
    this.world.addComponent(unit, new Components.Owner(owner.playerId));
    this.world.addComponent(unit, new Components.CivilizationComponent(civId));
    this.world.addComponent(unit, new Components.Selectable());

    // Create ScreenPos for the unit
    const worldPos = tileToWorld(transform);
    this.world.addComponent(unit, new Components.ScreenPos(worldPos.x, worldPos.y));

    // Create unit sprite
    const unitSprite = new UnitSprite(this.gameScene, worldPos.x, worldPos.y, unitSpriteKey);
    this.gameScene.add.existing(unitSprite);
    this.unitSprites.set(unit, unitSprite);

    console.log(`Unit ${unitType} produced at city (${transform.tx}, ${transform.ty})`);
    this.events.emit('ui-update');
  }
}

