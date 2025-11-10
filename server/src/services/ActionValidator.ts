import type { Intent } from '@shared/types';

/**
 * Validates game actions before processing
 */
export class ActionValidator {
  /**
   * Validate an intent is well-formed and valid
   */
  static validate(intent: Intent): { valid: boolean; error?: string } {
    // Basic structure validation
    if (!intent || !intent.type) {
      return { valid: false, error: 'Invalid intent: missing type' };
    }

    // Type-specific validation
    switch (intent.type) {
      case 'MoveTo':
        if (!intent.payload || typeof intent.payload.entity !== 'number') {
          return { valid: false, error: 'MoveTo intent: invalid entity' };
        }
        if (!intent.payload.target || typeof intent.payload.target.tx !== 'number') {
          return { valid: false, error: 'MoveTo intent: invalid target' };
        }
        break;

      case 'SelectEntity':
        // payload.entity can be null or a number
        if (intent.payload === undefined) {
          return { valid: false, error: 'SelectEntity intent: missing payload' };
        }
        break;

      case 'FoundCity':
        if (!intent.payload || typeof intent.payload.entity !== 'number') {
          return { valid: false, error: 'FoundCity intent: invalid entity' };
        }
        break;

      case 'ProduceUnit':
      case 'ProduceBuilding':
        if (!intent.payload || typeof intent.payload.cityEntity !== 'number') {
          return { valid: false, error: `${intent.type} intent: invalid cityEntity` };
        }
        if (!intent.payload.unitType && !intent.payload.buildingType) {
          return { valid: false, error: `${intent.type} intent: missing type` };
        }
        break;

      case 'BuildBuilding':
        if (!intent.payload || typeof intent.payload.cityEntity !== 'number') {
          return { valid: false, error: 'BuildBuilding intent: invalid cityEntity' };
        }
        if (typeof intent.payload.tx !== 'number' || typeof intent.payload.ty !== 'number') {
          return { valid: false, error: 'BuildBuilding intent: invalid position' };
        }
        break;

      case 'Attack':
        if (!intent.payload || typeof intent.payload.attacker !== 'number') {
          return { valid: false, error: 'Attack intent: invalid attacker' };
        }
        if (typeof intent.payload.target !== 'number') {
          return { valid: false, error: 'Attack intent: invalid target' };
        }
        break;

      case 'EndTurn':
      case 'EnterMoveMode':
      case 'CancelMoveMode':
      case 'TurnBegan':
        // These don't need payload validation
        break;

      default:
        return { valid: false, error: `Unknown intent type: ${(intent as any).type}` };
    }

    return { valid: true };
  }
}

