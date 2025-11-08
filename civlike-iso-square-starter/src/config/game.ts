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
