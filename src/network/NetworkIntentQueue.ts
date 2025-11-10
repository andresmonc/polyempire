import type { Intent } from '@shared/types';
import { IntentQueue } from '@/state/IntentQueue';
import { IGameClient } from './GameClient';

/**
 * A network-aware wrapper around IntentQueue that sends actions to the server
 * when in multiplayer mode, or processes them locally when in single-player mode.
 */
export class NetworkIntentQueue extends IntentQueue {
  private gameClient: IGameClient | null = null;

  /**
   * Set the game client to use for network operations
   */
  setGameClient(client: IGameClient): void {
    this.gameClient = client;
  }

  /**
   * Push an intent to the queue.
   * If in multiplayer mode, this will also send it to the server.
   * If in local mode, it just adds it to the local queue.
   */
  push(intent: Intent): void {
    // For EndTurn in multiplayer, check if player already ended their turn (only in simultaneous mode)
    if (intent.type === 'EndTurn' && this.gameClient) {
      const session = this.gameClient.getSession();
      const connection = this.gameClient.getConnection();
      // In simultaneous mode, check if already ended
      if (session && connection && !session.isSequentialMode && session.playersEndedTurn && session.playersEndedTurn.includes(connection.playerId)) {
        console.warn('Cannot end turn - already ended this round');
        return; // Don't add to queue if already ended
      }
      // In sequential mode, isMyTurn() will handle validation
    }

    // Always add to local queue for immediate UI feedback
    this.queue.push(intent);

    // If we have a game client and it's a network game, send to server
    if (this.gameClient && this.gameClient.getSession()?.status === 'active') {
      // Check if it's the player's turn (skip for local-only intents)
      const isLocalOnlyIntent = intent.type === 'SelectEntity' || 
                                intent.type === 'EnterMoveMode' || 
                                intent.type === 'CancelMoveMode' ||
                                intent.type === 'TurnBegan';

      if (!isLocalOnlyIntent && this.gameClient.isMyTurn()) {
        // Translate entity IDs for multiplayer (local -> server)
        const translatedIntent = this.translateEntityIds(intent);
        
        // Submit action asynchronously (fire and forget for now)
        this.gameClient.submitAction(translatedIntent).then(response => {
          if (!response.success) {
            console.warn('Action rejected by server:', response.error);
            // Remove from local queue if server rejected it
            this.removeIntent(intent);
          } else if (intent.type === 'EndTurn' && response.success) {
            // After successfully ending turn, refresh session to update UI
            // The polling will handle this, but we can also trigger it manually
            if (this.gameClient && 'fetchSession' in this.gameClient) {
              (this.gameClient as any).fetchSession?.();
            }
          }
        });
      }
    }
  }

  /**
   * Translate local entity IDs to server entity IDs for multiplayer
   */
  private translateEntityIds(intent: Intent): Intent {
    // Get entity ID mapping from game client if available
    const gameClient = this.gameClient as any;
    const entityIdMap = gameClient?.entityIdMap;
    
    if (!entityIdMap || !(entityIdMap instanceof Map)) {
      // No mapping available, return as-is
      return intent;
    }
    
    // Translate entity IDs based on intent type
    switch (intent.type) {
      case 'MoveTo':
        const serverEntityId = entityIdMap.get(intent.payload.entity);
        if (serverEntityId !== undefined) {
          return {
            ...intent,
            payload: {
              ...intent.payload,
              entity: serverEntityId,
            },
          };
        }
        break;
      case 'FoundCity':
        const serverCityEntityId = entityIdMap.get(intent.payload.entity);
        if (serverCityEntityId !== undefined) {
          return {
            ...intent,
            payload: {
              ...intent.payload,
              entity: serverCityEntityId,
            },
          };
        }
        break;
      case 'Attack':
        const serverAttackerId = entityIdMap.get(intent.payload.attacker);
        const serverTargetId = entityIdMap.get(intent.payload.target);
        if (serverAttackerId !== undefined && serverTargetId !== undefined) {
          return {
            ...intent,
            payload: {
              ...intent.payload,
              attacker: serverAttackerId,
              target: serverTargetId,
            },
          };
        }
        break;
      // Other intents don't need translation
    }
    
    return intent;
  }

  /**
   * Pop an intent from the queue (same interface as IntentQueue)
   */
  pop<T extends Intent>(filter: (intent: Intent) => intent is T): T | undefined {
    const index = this.queue.findIndex(filter);
    if (index !== -1) {
      const intent = this.queue[index] as T;
      this.queue.splice(index, 1);
      return intent;
    }
    return undefined;
  }

  /**
   * Peek at an intent without removing it (same interface as IntentQueue)
   */
  peek<T extends Intent>(filter: (intent: Intent) => intent is T): T | undefined {
    return this.queue.find(filter) as T | undefined;
  }

  /**
   * Clear all intents from the queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Remove an intent from the queue (used when server rejects an action)
   */
  private removeIntent(intent: Intent): void {
    // Find and remove the intent from the queue
    const index = this.queue.findIndex(i => 
      i.type === intent.type && 
      JSON.stringify(i) === JSON.stringify(intent)
    );
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }
}

