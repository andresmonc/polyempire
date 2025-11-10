import { Entity } from '@engine/ecs';
import { TilePoint } from '@engine/math/iso';

// --- Define Intent Payloads ---

export interface SelectEntityPayload {
  entity: Entity | null;
}

export interface MoveToPayload {
  entity: Entity;
  target: TilePoint;
}

// --- Define Intent Types ---

export interface SelectEntityIntent {
  type: 'SelectEntity';
  payload: SelectEntityPayload;
}

export interface MoveToIntent {
  type: 'MoveTo';
  payload: MoveToPayload;
}

export interface EndTurnIntent {
  type: 'EndTurn';
}

export interface EnterMoveModeIntent {
  type: 'EnterMoveMode';
}

export interface CancelMoveModeIntent {
  type: 'CancelMoveMode';
}

export interface FoundCityIntent {
  type: 'FoundCity';
  payload: { entity: Entity };
}

export interface ProduceUnitIntent {
  type: 'ProduceUnit';
  payload: { cityEntity: Entity; unitType: string };
}

export interface ProduceBuildingIntent {
  type: 'ProduceBuilding';
  payload: { cityEntity: Entity; buildingType: string };
}

export interface BuildBuildingIntent {
  type: 'BuildBuilding';
  payload: { cityEntity: Entity; buildingType: string; tx: number; ty: number };
}

export interface AttackIntent {
  type: 'Attack';
  payload: { attacker: Entity; target: Entity };
}

/**
 * An internal event triggered by the TurnSystem.
 */
export interface TurnBeganIntent {
  type: 'TurnBegan';
}

// --- Union Type for All Intents ---

export type Intent =
  | SelectEntityIntent
  | MoveToIntent
  | EndTurnIntent
  | EnterMoveModeIntent
  | CancelMoveModeIntent
  | FoundCityIntent
  | ProduceUnitIntent
  | ProduceBuildingIntent
  | BuildBuildingIntent
  | AttackIntent
  | TurnBeganIntent;

// --- Type Guard for checking intent types ---

export function isIntent<T extends Intent['type']>(type: T) {
  return (intent: Intent): intent is Extract<Intent, { type: T }> => {
    return intent.type === type;
  };
}

// --- Intent Queue ---

/**
 * A simple queue to manage player actions and game events.
 * Systems can push intents, and other systems can read and process them.
 * This decouples systems from each other.
 */
export class IntentQueue {
  protected queue: Intent[] = [];

  /**
   * Adds an intent to the end of the queue.
   */
  public push(intent: Intent): void {
    this.queue.push(intent);
  }

  /**
   * Retrieves and removes the first intent in the queue that matches the filter.
   * @param filter - A type guard function to find a specific intent type.
   * @returns The found intent, or undefined if not found.
   */
  public pop<T extends Intent>(filter: (intent: Intent) => intent is T): T | undefined {
    const index = this.queue.findIndex(filter);
    if (index !== -1) {
      const intent = this.queue[index] as T;
      this.queue.splice(index, 1);
      return intent;
    }
    return undefined;
  }

  /**
   * Retrieves the first intent in the queue that matches the filter, without removing it.
   * @param filter - A type guard function to find a specific intent type.
   * @returns The found intent, or undefined if not found.
   */
  public peek<T extends Intent>(filter: (intent: Intent) => intent is T): T | undefined {
    return this.queue.find(filter) as T | undefined;
  }

  /**
   * Clears all intents from the queue.
   */
  public clear(): void {
    this.queue = [];
  }
}
