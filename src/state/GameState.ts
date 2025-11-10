import { Entity } from '@engine/ecs';

/**
 * Holds the global state of the game that doesn't belong in the ECS.
 * This includes things like the current turn number and the currently
 * selected entity. Also tracks which player(s) are currently active.
 * 
 * For multiplayer support, currentPlayerId can be updated based on turn order
 * or network events. For now, it defaults to player 0 (the human player).
 */
export class GameState {
  public turn = 1;
  public selectedEntity: Entity | null = null;
  public moveMode = false; // When true, clicking a tile will move the selected unit
  
  /**
   * The ID of the player(s) who can currently take actions.
   * In single-player, this is always 0 (the human player).
   * In multiplayer, this would change based on turn order or be an array for simultaneous turns.
   */
  public currentPlayerId: number = 0;

  /**
   * The ID of the local player (this client's player)
   * Used to determine if actions should be sent to the server
   */
  public localPlayerId: number = 0;

  /**
   * Game session ID for multiplayer games
   */
  public sessionId: string | null = null;

  /**
   * Whether the game is in multiplayer mode
   */
  public isMultiplayer: boolean = false;
  
  /**
   * Checks if a player ID is the current active player.
   * This method can be extended in the future to support multiple active players
   * (e.g., for simultaneous turns in multiplayer).
   */
  public isCurrentPlayer(playerId: number): boolean {
    return playerId === this.currentPlayerId;
  }

  /**
   * Checks if the local player is the current active player
   */
  public isMyTurn(): boolean {
    return this.isCurrentPlayer(this.localPlayerId);
  }
}
