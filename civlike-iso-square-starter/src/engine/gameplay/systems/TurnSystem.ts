import { System } from '@engine/ecs';
import { GameState } from '@/state/GameState';
import { Intent, IntentQueue, isIntent } from '@/state/IntentQueue';
import { Unit } from '../components';
import Phaser from 'phaser';

/**
 * Manages the game's turn cycle.
 * When an `EndTurn` intent is received, it increments the turn counter
 * and restores movement points for all units.
 */
export class TurnSystem extends System {
  private intents: IntentQueue;
  private gameState: GameState;
  private events: Phaser.Events.EventEmitter;

  constructor(
    intents: IntentQueue,
    gameState: GameState,
    events: Phaser.Events.EventEmitter,
  ) {
    super();
    this.intents = intents;
    this.gameState = gameState;
    this.events = events;
  }

  update(_dt: number): void {
    const endTurnIntent = this.intents.pop(isIntent('EndTurn'));

    if (endTurnIntent) {
      this.gameState.turn++;
      console.log(`Turn ${this.gameState.turn}`);

      // Restore MP for all units
      const units = this.world.view(Unit);
      for (const entity of units) {
        const unit = this.world.getComponent(entity, Unit)!;
        unit.mp = unit.maxMp;
      }

      // Signal that a new turn has begun
      this.intents.push({ type: 'TurnBegan' });
      this.events.emit('ui-update');
    }
  }
}
