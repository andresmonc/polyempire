import { System, Entity } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import * as Components from '../components';
import { mergeUnitData, getUnitSpriteKey } from '@engine/civilization/Civilization';
import { tileToWorld } from '@engine/math/iso';
import { UnitSprite } from '@platform/phaser/sprites/UnitSprite';
import Phaser from 'phaser';

/**
 * Handles city production.
 * Cities accumulate production points each turn and complete items in their queue.
 */
export class ProductionSystem extends System {
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
    // Process production at the start of each turn
    const turnBegan = this.intents.peek(isIntent('TurnBegan'));
    if (!turnBegan) return;

    // Process all cities with production queues
    const cities = this.world.view(
      Components.City,
      Components.TransformTile,
      Components.Resources,
      Components.ProductionQueue,
    );

    for (const cityEntity of cities) {
      const city = this.world.getComponent(cityEntity, Components.City)!;
      const resources = this.world.getComponent(cityEntity, Components.Resources)!;
      const queue = this.world.getComponent(cityEntity, Components.ProductionQueue)!;

      // Get current production item
      const currentItem = queue.getCurrent();
      if (!currentItem) continue;

      // Use production from resources stockpile
      // Production is accumulated from yields each turn by YieldSystem
      // We use the production stockpile to build things
      const availableProduction = resources.production;
      const neededProduction = currentItem.cost - queue.currentProgress;
      const productionToUse = Math.min(availableProduction, neededProduction);
      
      queue.currentProgress += productionToUse;
      resources.production -= productionToUse; // Spend production

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
          console.log(`City started producing: ${nextItem.name}`);
        }
      } else {
        // Show progress
        const remaining = currentItem.cost - queue.currentProgress;
        console.log(
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
      // TODO: Implement building production
      console.log(`Building ${item.name} completed (not yet implemented)`);
    }
  }

  /**
   * Completes unit production and creates the unit.
   */
  private completeUnitProduction(cityEntity: Entity, unitType: string): void {
    const transform = this.world.getComponent(cityEntity, Components.TransformTile);
    const owner = this.world.getComponent(cityEntity, Components.Owner);
    const civilization = this.world.getComponent(cityEntity, Components.CivilizationComponent);

    if (!transform || !owner) {
      console.warn('Cannot produce unit: city missing required components');
      return;
    }

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
  }
}

