/**
 * Game-wide constants for configuration and tuning.
 *
 * Using a central configuration file like this makes it easy to adjust
 * core game parameters without digging through the codebase.
 */

// --- Tile Dimensions ---
// The pixel dimensions of a single isometric tile.
// For a classic 2:1 ratio, TILE_W should be twice TILE_H.
export const TILE_W = 64;
export const TILE_H = 32;

// --- Camera Settings ---
export const CAMERA_ZOOM = {
  DEFAULT: 0.9,
  MIN: 0.4,
  MAX: 1.5,
};
export const CAMERA_SCROLL_SPEED = 0.7;

// --- Fog of War ---
export const FOG_COLOR = 0x000000;
export const FOG_ALPHA_UNREVEALED = 0.8; // Dark shroud
export const FOG_ALPHA_REVEALED = 0.3; // Dim overlay

// --- Unit Defaults ---
// These can be overridden by data in units.json
export const DEFAULT_UNIT_MP = 2;
export const DEFAULT_UNIT_SIGHT = 2;

// --- Colors ---
export const CURSOR_COLOR = 0xffffff;
export const PATH_COLOR = 0x00ff00;
export const SELECTION_COLOR = 0xffff00;

// --- Combat Settings ---
export const COMBAT = {
  // Base damage calculation: damage = attack * (1 + random(0, variance))
  DAMAGE_VARIANCE: 0.2, // 20% random variance in damage
  MIN_DAMAGE: 1, // Minimum damage dealt (even if calculation is lower)
  DAMAGE_NUMBER_DURATION: 1500, // How long damage numbers stay visible (ms)
  DAMAGE_NUMBER_OFFSET_Y: -40, // Vertical offset for damage numbers above units
  DAMAGE_NUMBER_COLOR: 0xff0000, // Red color for damage numbers
  DAMAGE_NUMBER_FONT_SIZE: '24px',
};

// --- Resource & Production Settings ---
export const RESOURCES = {
  // Base yields per population (each population can work one tile)
  TILES_PER_POPULATION: 1, // How many tiles each population point can work
  // City base yields (yields from the city tile itself)
  CITY_BASE_FOOD: 2, // Base food from city center
  CITY_BASE_PRODUCTION: 1, // Base production from city center
  CITY_BASE_GOLD: 0, // Base gold from city center
  // Food required for city growth
  FOOD_PER_POPULATION: 20, // Food needed per population point (for growth)
};

// --- Game Defaults ---
export const DEFAULT_CIVILIZATION_ID = 'romans'; // Default civilization ID
export const HUMAN_PLAYER_ID = 0; // The human player's ID (all other IDs are bots)
