/**
 * Represents a civilization's unit override configuration.
 */
export interface UnitOverride {
  name?: string; // Custom name for this unit type
  mp?: number; // Override movement points
  sightRange?: number; // Override sight range
  health?: number; // Override health
  maxHealth?: number; // Override max health
  attack?: number; // Override attack strength
  defense?: number; // Override defense strength
  canAttack?: boolean; // Override canAttack flag
}

/**
 * Represents a civilization's sprite configuration.
 */
export interface CivilizationSprites {
  unit?: string; // Sprite key for units (falls back to base unit sprite)
  city?: string; // Sprite key for cities (falls back to base city sprite)
}

/**
 * Represents a single civilization configuration.
 */
export interface Civilization {
  id: string; // e.g., "romans", "greeks"
  name: string; // Display name, e.g., "Romans"
  color: string; // Hex color for UI/borders, e.g., "0xff0000"
  startingProduction?: number; // Starting production per turn for this civilization
  units?: Record<string, UnitOverride>; // Unit type overrides (e.g., "settler": { name: "Colonist" })
  sprites?: CivilizationSprites; // Sprite overrides
}

/**
 * A registry for all available civilizations, loaded from JSON.
 */
export class CivilizationRegistry {
  private civilizations: Map<string, Civilization> = new Map();

  constructor(civilizationData: Record<string, Omit<Civilization, 'id'>>) {
    for (const id in civilizationData) {
      this.civilizations.set(id, { id, ...civilizationData[id] });
    }
  }

  public get(id: string): Civilization | undefined {
    return this.civilizations.get(id);
  }

  public mustGet(id: string): Civilization {
    const civ = this.get(id);
    if (!civ) {
      throw new Error(`Civilization with id "${id}" not found.`);
    }
    return civ;
  }

  public getAll(): Civilization[] {
    return Array.from(this.civilizations.values());
  }
}

/**
 * Base unit data structure from units.json
 */
export interface BaseUnitData {
  name: string;
  mp: number;
  sightRange: number;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  canAttack: boolean;
}

/**
 * Merges base unit data with civilization-specific overrides.
 * @param baseUnit - The base unit data from units.json
 * @param civOverride - Optional civilization override for this unit type
 * @returns Merged unit data with civilization overrides applied
 */
export function mergeUnitData(
  baseUnit: BaseUnitData,
  civOverride?: UnitOverride,
): BaseUnitData {
  if (!civOverride) {
    return { ...baseUnit };
  }

  return {
    name: civOverride.name ?? baseUnit.name,
    mp: civOverride.mp ?? baseUnit.mp,
    sightRange: civOverride.sightRange ?? baseUnit.sightRange,
    health: civOverride.health ?? baseUnit.health,
    maxHealth: civOverride.maxHealth ?? baseUnit.maxHealth,
    attack: civOverride.attack ?? baseUnit.attack,
    defense: civOverride.defense ?? baseUnit.defense,
    canAttack: civOverride.canAttack ?? baseUnit.canAttack,
  };
}

/**
 * Gets the sprite key for a unit, using civilization override if available.
 * @param baseSpriteKey - The default sprite key (e.g., "unit")
 * @param civSprites - Optional civilization sprite configuration
 * @returns The sprite key to use
 */
export function getUnitSpriteKey(
  baseSpriteKey: string,
  civSprites?: CivilizationSprites,
): string {
  return civSprites?.unit ?? baseSpriteKey;
}

/**
 * Gets the sprite key for a city, using civilization override if available.
 * @param baseSpriteKey - The default sprite key (e.g., "city")
 * @param civSprites - Optional civilization sprite configuration
 * @returns The sprite key to use
 */
export function getCitySpriteKey(
  baseSpriteKey: string,
  civSprites?: CivilizationSprites,
): string {
  return civSprites?.city ?? baseSpriteKey;
}

