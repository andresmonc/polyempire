import { System } from '@engine/ecs';
import { Owner } from '../components';
import { GameState } from '@/state/GameState';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import { HUMAN_PLAYER_ID } from '@config/game';
import Phaser from 'phaser';

/**
 * Handles move mode state changes.
 * When move mode is active, clicking a tile will move the selected unit.
 * Only allows move mode for units owned by the human player.
 */
export class MoveModeSystem extends System {
  private intents: IntentQueue;
  private gameState: GameState;
  private events: Phaser.Events.EventEmitter;

  constructor(intents: IntentQueue, gameState: GameState, events: Phaser.Events.EventEmitter) {
    super();
    this.intents = intents;
    this.gameState = gameState;
    this.events = events;
  }

  update(_dt: number): void {
    const enterMoveMode = this.intents.pop(isIntent('EnterMoveMode'));
    if (enterMoveMode) {
      // Only enter move mode if a unit is selected and owned by the human player
      if (this.gameState.selectedEntity !== null) {
        const owner = this.world.getComponent(this.gameState.selectedEntity, Owner);
        if (owner && owner.playerId === HUMAN_PLAYER_ID) {
          this.gameState.moveMode = true;
          this.events.emit('ui-update');
        }
      }
    }

    const cancelMoveMode = this.intents.pop(isIntent('CancelMoveMode'));
    if (cancelMoveMode) {
      this.gameState.moveMode = false;
      this.events.emit('ui-update');
    }
  }
}

