import { System } from '@engine/ecs';
import { GameState } from '@/state/GameState';
import { Intent, IntentQueue, isIntent } from '@/state/IntentQueue';
import { Unit, NewlyPurchased } from '../components';
import Phaser from 'phaser';

/**
 * Manages the game's turn cycle.
 * When an `EndTurn` intent is received, it increments the turn counter
 * and restores movement points for all units.
 * Also removes NewlyPurchased component so units can act on the next turn.
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
      // In multiplayer, don't increment turn locally - wait for server to tell us
      // The server is authoritative for turn advancement
      if (!this.gameState.isMultiplayer) {
        this.gameState.turn++;
      }
      // In multiplayer, the turn will be updated from server state updates

      // Restore MP for all units
      const units = this.world.view(Unit);
      for (const entity of units) {
        const unit = this.world.getComponent(entity, Unit)!;
        unit.mp = unit.maxMp;
      }

      // Remove NewlyPurchased component from all units so they can act next turn
      const newlyPurchasedUnits = this.world.view(NewlyPurchased);
      for (const entity of newlyPurchasedUnits) {
        this.world.removeComponent(entity, NewlyPurchased);
      }

      // Signal that a new turn has begun (only if we actually advanced the turn)
      // In multiplayer, TurnBegan will be triggered when server confirms turn advancement
      if (!this.gameState.isMultiplayer) {
        this.intents.push({ type: 'TurnBegan' });
        this.events.emit('ui-update');
      }
    }
  }
}
