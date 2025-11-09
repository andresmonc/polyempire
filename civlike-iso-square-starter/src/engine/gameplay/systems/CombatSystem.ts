import { System } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import * as Components from '../components';
import { COMBAT } from '@config/game';
import Phaser from 'phaser';

/**
 * Handles combat between units.
 * When a unit attacks another, damage is calculated and applied.
 * Units with 0 health are destroyed.
 */
export class CombatSystem extends System {
  private intents: IntentQueue;
  private events: Phaser.Events.EventEmitter;
  private gameScene: Phaser.Scene;
  private damageNumbers: Map<Entity, Phaser.GameObjects.Text> = new Map();

  constructor(
    intents: IntentQueue,
    events: Phaser.Events.EventEmitter,
    gameScene: Phaser.Scene,
  ) {
    super();
    this.intents = intents;
    this.events = events;
    this.gameScene = gameScene;
  }

  update(_dt: number): void {
    const attack = this.intents.pop(isIntent('Attack'));
    if (!attack) return;

    const { attacker, target } = attack.payload;

    // Verify both entities are units
    const attackerUnit = this.world.getComponent(attacker, Components.Unit);
    const targetUnit = this.world.getComponent(target, Components.Unit);

    if (!attackerUnit || !targetUnit) {
      console.warn('Attack intent received for non-unit entities');
      return;
    }

    // Check if attacker can attack
    if (!attackerUnit.canAttack) {
      console.warn('Unit cannot attack');
      return;
    }

    // Check if units are on adjacent tiles
    const attackerPos = this.world.getComponent(attacker, Components.TransformTile);
    const targetPos = this.world.getComponent(target, Components.TransformTile);

    if (!attackerPos || !targetPos) {
      console.warn('Attack intent received for units without positions');
      return;
    }

    // Check adjacency (4-way neighbors)
    const dx = Math.abs(attackerPos.tx - targetPos.tx);
    const dy = Math.abs(attackerPos.ty - targetPos.ty);
    const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);

    if (!isAdjacent) {
      console.warn('Cannot attack: units are not adjacent');
      return;
    }

    // Calculate damage
    const damage = this.calculateDamage(attackerUnit.attack, targetUnit.defense);

    // Apply damage
    targetUnit.health = Math.max(0, targetUnit.health - damage);

    // Show damage number
    this.showDamageNumber(target, damage);

    console.log(
      `Unit attacked: ${damage} damage dealt. Target health: ${targetUnit.health}/${targetUnit.maxHealth}`,
    );

    // Check if target is dead
    if (targetUnit.health <= 0) {
      this.destroyUnit(target);
    }

    // Attacker loses MP (attacking costs movement)
    attackerUnit.mp = Math.max(0, attackerUnit.mp - 1);

    this.events.emit('ui-update');
  }

  /**
   * Calculates damage based on attack and defense stats.
   * Uses configuration-driven variance for randomness.
   */
  private calculateDamage(attack: number, defense: number): number {
    // Base damage is attack value
    // Defense reduces damage: damage = attack * (1 - defense / (defense + attack))
    const defenseReduction = defense / (defense + attack);
    const baseDamage = attack * (1 - defenseReduction);

    // Add random variance
    const variance = COMBAT.DAMAGE_VARIANCE;
    const randomFactor = 1 + (Math.random() * 2 - 1) * variance; // Random between (1-variance) and (1+variance)
    const damage = Math.max(COMBAT.MIN_DAMAGE, Math.round(baseDamage * randomFactor));

    return damage;
  }

  /**
   * Shows a damage number above the unit briefly.
   */
  private showDamageNumber(unitEntity: Entity, damage: number): void {
    // Get unit sprite position
    const gameScene = this.gameScene as any;
    const unitSprite = gameScene.unitSprites?.get(unitEntity);
    if (!unitSprite) return;

    // Remove existing damage number if any
    const existing = this.damageNumbers.get(unitEntity);
    if (existing) {
      existing.destroy();
    }

    // Create damage number text
    const damageText = this.gameScene.add.text(
      unitSprite.x,
      unitSprite.y + COMBAT.DAMAGE_NUMBER_OFFSET_Y,
      `-${damage}`,
      {
        fontSize: COMBAT.DAMAGE_NUMBER_FONT_SIZE,
        color: `#${COMBAT.DAMAGE_NUMBER_COLOR.toString(16).padStart(6, '0')}`,
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 3,
      },
    );
    damageText.setOrigin(0.5, 0.5);
    damageText.setDepth(unitSprite.y + 1000); // Above everything

    this.damageNumbers.set(unitEntity, damageText);

    // Animate and remove after duration
    this.gameScene.tweens.add({
      targets: damageText,
      y: damageText.y - 30,
      alpha: 0,
      duration: COMBAT.DAMAGE_NUMBER_DURATION,
      ease: 'Power2',
      onComplete: () => {
        damageText.destroy();
        this.damageNumbers.delete(unitEntity);
      },
    });
  }

  /**
   * Destroys a unit when health reaches 0.
   */
  private destroyUnit(entity: Entity): void {
    console.log('Unit destroyed');
    
    // Remove from game state if selected
    const gameState = (this.gameScene as any).gameState;
    if (gameState && gameState.selectedEntity === entity) {
      gameState.selectedEntity = null;
      gameState.moveMode = false;
    }

    // Clean up unit sprite immediately
    const gameScene = this.gameScene as any;
    if (gameScene.unitSprites) {
      const sprite = gameScene.unitSprites.get(entity);
      if (sprite) {
        sprite.destroy();
        gameScene.unitSprites.delete(entity);
      }
    }

    // Destroy the entity
    this.world.destroyEntity(entity);
    this.events.emit('ui-update');
  }
}

