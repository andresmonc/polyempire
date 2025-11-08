import { Entity } from '@engine/ecs';

/**
 * Holds the global state of the game that doesn't belong in the ECS.
 * This includes things like the current turn number and the currently
 * selected entity.
 */
export class GameState {
  public turn = 1;
  public selectedEntity: Entity | null = null;
}
