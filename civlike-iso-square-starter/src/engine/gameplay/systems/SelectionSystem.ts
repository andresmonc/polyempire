import { System } from '@engine/ecs';
import { Selected, Selectable } from '../components';
import { GameState } from '@/state/GameState';
import { IntentQueue, isIntent } from '@/state/IntentQueue';

/**
 * Handles entity selection based on `SelectEntity` intents.
 * It ensures only one entity is selected at a time.
 */
export class SelectionSystem extends System {
  private intents: IntentQueue;
  private gameState: GameState;

  constructor(intents: IntentQueue, gameState: GameState) {
    super();
    this.intents = intents;
    this.gameState = gameState;
  }

  update(_dt: number): void {
    const intent = this.intents.pop(isIntent('SelectEntity'));
    if (!intent) return;

    console.log('[SelectionSystem] Processing SelectEntity intent:', intent.payload);
    const { entity } = intent.payload;

    // Clear previous selection
    if (
      this.gameState.selectedEntity !== null &&
      this.gameState.selectedEntity !== entity
    ) {
      console.log('[SelectionSystem] Clearing previous selection:', this.gameState.selectedEntity);
      if (this.world.hasComponent(this.gameState.selectedEntity, Selectable)) {
        this.world.removeComponent(this.gameState.selectedEntity, Selected);
      }
    }

    // If the entity is selectable, select it
    if (entity !== null && this.world.hasComponent(entity, Selectable)) {
      console.log('[SelectionSystem] Selecting entity:', entity);
      this.world.addComponent(entity, new Selected());
      this.gameState.selectedEntity = entity;
      console.log('[SelectionSystem] Selected entity set to:', this.gameState.selectedEntity);
    } else {
      // If null or not selectable, deselect
      console.log('[SelectionSystem] Deselecting. Entity:', entity, 'has Selectable:', entity !== null ? this.world.hasComponent(entity, Selectable) : 'N/A');
      this.gameState.selectedEntity = null;
    }
  }
}
