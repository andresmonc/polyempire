# PolyEmpire

This is a Civilization-style 4X game built with Phaser 3, TypeScript, and Vite. It features a diamond isometric grid on a square logical map and a clean separation between the core game engine and the Phaser rendering platform.

## Features

- **Tech Stack**: Phaser 3, TypeScript, Vite, React (for UI), Vitest, ESLint, Prettier.
- **Isometric Grid**: Diamond isometric projection on a logical square map.
- **ECS Architecture**: A simple Entity-Component-System implementation to manage game objects.
- **Engine/Platform Separation**: Core game logic in `/src/engine` has zero Phaser dependencies, making it portable and easy to test.
- **Turn-Based Gameplay**: A basic turn system with an "End Turn" button.
- **Unit Movement**: A* pathfinding on a 4-way grid, respecting terrain movement costs.
- **Multi-Turn Movement**: Units can follow long paths over several turns.
- **Fog of War**: Basic fog system with revealed, visible, and shrouded states.
- **UI**: A simple React-based HUD to display game state.

## Setup and Scripts

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- A package manager like `npm` or `yarn`.

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd polyempire
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Available Scripts

-   **`npm run dev`**: Starts the Vite development server with hot reloading. The game will be available at `http://localhost:5173`.
-   **`npm run build`**: Compiles TypeScript and builds the project for production in the `dist` folder.
-   **`npm run preview`**: Serves the production build locally to preview it.
-   **`npm run test`**: Runs the unit tests using Vitest.
-   **`npm run coverage`**: Runs tests and generates a code coverage report.
-   **`npm run lint`**: Lints the codebase for potential errors.
-   **`npm run format`**: Formats all files using Prettier.

## Core Concepts

### Isometric Projection

The game uses a logical square grid for gameplay calculations (pathfinding, range, etc.) but renders it as a diamond-shaped isometric grid.

-   **Tile Coords `(tx, ty)`**: The logical `(x, y)` position on the square map.
-   **World Coords `(x, y)`**: The pixel position in the Phaser world.

The conversion is handled by `/src/engine/math/iso.ts`:

-   `isoToWorld(tx, ty)`: Converts tile coordinates to the pixel coordinates of the tile's center.
    -   `x = (tx - ty) * (TILE_W / 2)`
    -   `y = (tx + ty) * (TILE_H / 2)`
-   `worldToTile(x, y)`: Converts world pixel coordinates back to the nearest tile coordinate by applying the inverse transformation and rounding.

### Movement and Turns

-   Units have **Movement Points (MP)**, defined in `/public/data/units.json`.
-   When you click a tile, the `PathRequestSystem` uses **A\*** to find a path, weighted by the `moveCost` of each terrain tile.
-   The `MovementSystem` then consumes this path. It uses `calculateMovementBudget` to determine how many steps the unit can take with its current MP.
-   If the path is longer than the unit's MP allows, the unit moves as far as it can. The remaining path is stored, and the unit will continue along it on subsequent turns after its MP is restored.
-   Clicking **End Turn** restores all units' MP.

### Fog of War

-   The `FogOfWar` class manages three states for each tile:
    1.  **Unrevealed**: Never seen. Covered by a dark shroud.
    2.  **Revealed**: Seen before, but not currently in sight. Covered by a dim overlay.
    3.  **Visible**: Currently in a unit's sight range. Fully lit.
-   Visibility is calculated using **Chebyshev distance** (a square radius on the logical grid) from each unit. It is recomputed whenever a unit moves or a new turn begins.

## How to Extend the Game

### Adding a New Terrain

1.  **Define it in `terrains.json`**: Open `/public/data/terrains.json` and add a new entry.
    ```json
    "swamp": {
      "name": "Swamp",
      "moveCost": 3,
      "blocked": false,
      "color": "0x8a8a5b",
      "yields": { "food": 1, "prod": 1, "gold": 0 }
    }
    ```
2.  **Use it in the map**: Open `/public/data/map.sample.json` and place your new `"swamp"` terrain in the `tiles` array.

### Adding a New Unit

1.  **Define it in `units.json`**: Open `/public/data/units.json` and add a new entry.
    ```json
    "warrior": {
      "name": "Warrior",
      "mp": 2,
      "sightRange": 1
    }
    ```
2.  **Create a sprite**: Add a new PNG to `/public/assets/textures/`.
3.  **Spawn it**: In `GameScene.ts`, inside `createInitialUnits`, load the new texture and create an entity for the warrior, similar to how the scout is created.

## Next Steps & TODOs

This starter provides a solid foundation. Here are some features to consider adding next:

-   **Cities & Buildings**: Found new cities, construct buildings.
-   **Culture & Borders**: Expand borders around cities.
-   **Yields & Resources**: Collect food, production, and gold from tiles.
-   **Tech Tree**: Unlock new units, buildings, and abilities.
-   **Combat**: Implement a combat system when units from different players meet.
-   **Roads & Improvements**: Build roads to reduce movement costs or farms to improve yields.
-   **Saving/Loading**: Serialize the game state to save and load games.

### Performance Considerations

-   **Texture Atlases**: For many different sprites, use a texture atlas to reduce draw calls.
-   **Throttling Updates**: Heavy operations like depth sorting or path previewing could be throttled to run less frequently if needed.
-   **Web Workers**: Offload heavy computations like A* pathfinding for large maps to a web worker to keep the main thread responsive.
-   **Spatial Partitioning**: For large numbers of units, replace the linear search in `PointerInput.findUnitAt` with a spatial hash grid for near-instant lookups.
