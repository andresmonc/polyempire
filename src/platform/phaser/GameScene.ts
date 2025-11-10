import Phaser from 'phaser';
import { World, Entity } from '@engine/ecs';
import { GameState } from '@/state/GameState';
import { IntentQueue } from '@/state/IntentQueue';
import { NetworkIntentQueue } from '@/network/NetworkIntentQueue';
import { IGameClient, createGameClient } from '@/network';
import { GameStateUpdate } from '@/network/types';
import { MapData } from '@engine/map/MapData';
import { TerrainRegistry } from '@engine/map/Terrain';
import { FogOfWar } from '@engine/map/FogOfWar';
import { CivilizationRegistry, getCitySpriteKey } from '@engine/civilization/Civilization';
import { UnitFactory } from '@/utils/unitFactory';
import { DEFAULT_CIVILIZATION_ID } from '@config/game';
import * as Systems from '@engine/gameplay/systems';
import * as Components from '@engine/gameplay/components';
import { PointerInput } from './input/PointerInput';
import { IsoTileSprite } from './sprites/IsoTileSprite';
import { UnitSprite } from './sprites/UnitSprite';
import { CitySprite } from './sprites/CitySprite';
import { stableSort } from './depthSort';
import {
  CAMERA_SCROLL_SPEED,
  CAMERA_ZOOM,
  PATH_COLOR,
  SELECTION_COLOR,
  TILE_H,
  TILE_W,
} from '@config/game';
import { tileToWorld } from '@engine/math/iso';
import { chebyshevDistance } from '@engine/math/grid';

/**
 * The main scene where the game is rendered and played.
 * It orchestrates the ECS world, game state, and Phaser-specific rendering.
 */
export class GameScene extends Phaser.Scene {
  private ecsWorld!: World;
  private gameState!: GameState;
  private intentQueue!: NetworkIntentQueue;
  private gameClient!: IGameClient;
  public mapData!: MapData; // Made public for HUD access
  private fogOfWar!: FogOfWar;
  private civilizationRegistry!: CivilizationRegistry;

  private tileSprites = new Map<Entity, IsoTileSprite>();
  public unitSprites = new Map<Entity, UnitSprite>(); // Made public for PointerInput access
  public citySprites = new Map<Entity, CitySprite>(); // Made public for PointerInput access
  private buildingSprites = new Map<Entity, Phaser.GameObjects.Graphics>();
  private cityBorders = new Map<Entity, Phaser.GameObjects.Graphics>();
  private unitsContainer!: Phaser.GameObjects.Container;
  private pathPreview!: Phaser.GameObjects.Graphics;
  private controls!: Phaser.Cameras.Controls.SmoothedKeyControl;
  public civilizationProductionSystem!: Systems.CivilizationProductionSystem; // Made public for ProductionSystem access
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private hasMoved = false;
  private readonly DRAG_THRESHOLD = 5; // Pixels to move before starting drag

  constructor() {
    super('GameScene');
  }

  async create(data?: { 
    selectedCivId?: string; 
    bots?: Array<{ civId: string; playerId: number }>;
    multiplayer?: boolean;
    sessionId?: string;
    playerId?: number;
    apiBaseUrl?: string;
  }) {
    // --- Initialization ---
    await this.initializeState(
      data?.multiplayer || false,
      data?.sessionId,
      data?.playerId || 0,
      data?.apiBaseUrl,
    );
    this.initializeMap();
    this.initializeCamera();
    this.initializeInput();
    this.initializeSystems();

    // --- World Creation ---
    this.createTileEntities();
    this.createInitialUnits(data?.selectedCivId || DEFAULT_CIVILIZATION_ID);
    
    // Create bot units
    if (data?.bots && data.bots.length > 0) {
      this.createBotUnits(data.bots);
    }

    // Initialize civilizations for initial units to ensure production starts accruing from turn 1
    const initialUnits = this.ecsWorld.view(Components.Unit, Components.Owner, Components.CivilizationComponent);
    for (const unitEntity of initialUnits) {
      const owner = this.ecsWorld.getComponent(unitEntity, Components.Owner);
      const civ = this.ecsWorld.getComponent(unitEntity, Components.CivilizationComponent);
      if (owner && this.gameState.isCurrentPlayer(owner.playerId) && civ) {
        this.civilizationProductionSystem.initializeCivilization(civ.civId);
      }
    }

    // Initial fog computation
    this.intentQueue.push({ type: 'TurnBegan' });

    // --- UI Notification ---
    // Notify React UI that the game is ready
    this.game.events.emit('game-ready', {
      intentQueue: this.intentQueue,
      gameState: this.gameState,
      ecsWorld: this.ecsWorld,
    });
  }

  update(_time: number, delta: number) {
    // Update camera controls
    this.controls?.update(delta);

    // --- Game Logic Update ---
    // This runs all the systems in the ECS world
    this.ecsWorld.update(delta);

    // --- Phaser-specific Updates ---
    this.updateUnitSprites();
    this.updateCitySprites();
    this.updateBuildingSprites();
    this.updateCityBorders();
    this.updateTileSprites();
    this.updateSelectionAndPath();

    // Depth sort units after all position updates
    // Note: Units are now directly in scene, not container, so we sort the unit sprites
    const unitSpriteList = Array.from(this.unitSprites.values());
    stableSort(unitSpriteList);
  }

  // --- Initialization Methods ---

  private async initializeState(
    multiplayer: boolean = false,
    sessionId?: string,
    playerId: number = 0,
    apiBaseUrl?: string,
  ) {
    this.ecsWorld = new World();
    this.gameState = new GameState();
    this.gameState.localPlayerId = playerId;
    this.gameState.isMultiplayer = multiplayer;
    this.gameState.sessionId = sessionId || null;

    // Create appropriate game client
    if (multiplayer && sessionId) {
      this.gameClient = createGameClient('rest', { apiBaseUrl });
      await this.gameClient.initialize(sessionId, playerId);
      
      // Start polling for updates
      if (this.gameClient.startPolling) {
        this.gameClient.startPolling((update) => {
          this.handleStateUpdate(update);
        });
        
        // Also poll for session info updates (turn status)
        setInterval(() => {
          const session = this.gameClient.getSession();
          if (session && this.gameState.isMultiplayer) {
            this.game.events.emit('session-update', {
              playersEndedTurn: session.playersEndedTurn,
              allPlayersEnded: session.allPlayersEnded,
            });
          }
        }, 2000); // Poll every 2 seconds
      }
    } else {
      this.gameClient = createGameClient('local');
      await this.gameClient.initialize('local-game', playerId);
    }

    // Create network-aware intent queue
    this.intentQueue = new NetworkIntentQueue();
    this.intentQueue.setGameClient(this.gameClient);
  }

  /**
   * Handle state updates from the server (for multiplayer games)
   */
  private handleStateUpdate(update: GameStateUpdate): void {
    // Apply the state update using the game client
    this.gameClient.applyStateUpdate(update, this.ecsWorld, this.gameState);

    // Apply any actions from the update
    // These are actions that other players performed
    update.actions.forEach((intent) => {
      // Only process actions that aren't from the local player
      // (local player actions are already processed locally)
      this.intentQueue.push(intent);
    });

    // Emit UI update event to refresh the HUD
    this.game.events.emit('ui-update');
  }

  private initializeMap() {
    const terrainData = this.cache.json.get('terrains');
    const terrainRegistry = new TerrainRegistry(terrainData);

    const civilizationData = this.cache.json.get('civilizations');
    this.civilizationRegistry = new CivilizationRegistry(civilizationData);

    const mapJson = this.cache.json.get('map');
    this.mapData = new MapData(
      mapJson.width,
      mapJson.height,
      mapJson.start,
      mapJson.tiles,
      terrainRegistry,
    );

    this.fogOfWar = new FogOfWar(this.mapData);
  }

  private initializeCamera() {
    this.cameras.main.setZoom(CAMERA_ZOOM.DEFAULT);
    this.cameras.main.centerOn(0, 0);

    // Keyboard panning controls
    const cursors = this.input.keyboard!.createCursorKeys();
    const controlConfig = {
      camera: this.cameras.main,
      left: cursors.left,
      right: cursors.right,
      up: cursors.up,
      down: cursors.down,
      acceleration: 0.04,
      drag: 0.0005,
      maxSpeed: 0.7,
    };
    this.controls = new Phaser.Cameras.Controls.SmoothedKeyControl(
      controlConfig,
    );

    // Zooming controls
    this.input.on(
      'wheel',
      (_pointer: any, _gameObjects: any, _deltaX: any, deltaY: number) => {
        const newZoom = this.cameras.main.zoom - deltaY * 0.001;
        this.cameras.main.setZoom(
          Phaser.Math.Clamp(newZoom, CAMERA_ZOOM.MIN, CAMERA_ZOOM.MAX),
        );
      },
    );

    // Click-and-drag camera panning (works for mouse and touch)
    this.setupCameraDrag();
  }

  private setupCameraDrag() {
    // Track pointer down
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      // Start drag on middle mouse button immediately, or track for left-click/touch drag
      if (pointer.middleButtonDown()) {
        // Middle mouse button - start dragging immediately
        this.isDragging = true;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.cameraStartX = this.cameras.main.scrollX;
        this.cameraStartY = this.cameras.main.scrollY;
      } else if (pointer.leftButtonDown() || pointer.isDown) {
        // Left click or touch - track initial position, will start drag if moved
        this.isDragging = false;
        this.hasMoved = false;
        this.pointerDownX = pointer.x;
        this.pointerDownY = pointer.y;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.cameraStartX = this.cameras.main.scrollX;
        this.cameraStartY = this.cameras.main.scrollY;
      }
    });

    // Track pointer move
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        // Middle mouse button - always drag
        if (!this.isDragging) {
          this.isDragging = true;
          this.dragStartX = pointer.x;
          this.dragStartY = pointer.y;
          this.cameraStartX = this.cameras.main.scrollX;
          this.cameraStartY = this.cameras.main.scrollY;
        }
        
        const deltaX = this.dragStartX - pointer.x;
        const deltaY = this.dragStartY - pointer.y;
        
        this.cameras.main.setScroll(
          this.cameraStartX + deltaX / this.cameras.main.zoom,
          this.cameraStartY + deltaY / this.cameras.main.zoom,
        );
      } else if (pointer.leftButtonDown() || pointer.isDown) {
        // Left click or touch - check if moved enough to start drag
        if (!this.isDragging) {
          const moveDistance = Math.sqrt(
            Math.pow(pointer.x - this.pointerDownX, 2) + 
            Math.pow(pointer.y - this.pointerDownY, 2)
          );
          
          if (moveDistance > this.DRAG_THRESHOLD) {
            // Moved enough - start dragging
            this.isDragging = true;
            this.hasMoved = true;
            // Update drag start to current position to avoid jump
            this.dragStartX = pointer.x;
            this.dragStartY = pointer.y;
            this.cameraStartX = this.cameras.main.scrollX;
            this.cameraStartY = this.cameras.main.scrollY;
          }
        }
        
        if (this.isDragging) {
          const deltaX = this.dragStartX - pointer.x;
          const deltaY = this.dragStartY - pointer.y;
          
          // Move camera by the drag delta (inverse because we want to drag the world, not the camera)
          this.cameras.main.setScroll(
            this.cameraStartX + deltaX / this.cameras.main.zoom,
            this.cameraStartY + deltaY / this.cameras.main.zoom,
          );
        }
      }
    });

    // Track pointer up
    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      const wasDragging = this.isDragging && this.hasMoved;
      this.isDragging = false;
      // Keep hasMoved true if we were dragging, so PointerInput can check it
      // It will be reset on next pointer down
      if (!wasDragging) {
        this.hasMoved = false;
      }
    });

    // Also handle pointer cancel (for touch events that get interrupted)
    this.input.on(Phaser.Input.Events.POINTER_CANCEL, () => {
      this.isDragging = false;
      this.hasMoved = false;
    });
  }

  private initializeInput() {
    new PointerInput(this, this.intentQueue, this.ecsWorld, this.gameState);
  }

  private initializeSystems() {
    this.ecsWorld.addSystem(
      new Systems.TurnSystem(this.intentQueue, this.gameState, this.game.events),
    );
    this.ecsWorld.addSystem(new Systems.SelectionSystem(this.intentQueue, this.gameState, this.game.events));
    this.ecsWorld.addSystem(new Systems.CityGrowthSystem(this.intentQueue));
    // Yield and production systems must run before FogSystem (which consumes TurnBegan)
    this.ecsWorld.addSystem(
      new Systems.YieldSystem(this.intentQueue, this.game.events, this.mapData, this.gameState),
    );
    this.ecsWorld.addSystem(new Systems.BuildingYieldSystem(
      this.intentQueue,
      this.game.events,
      this.gameState,
    ));
    this.civilizationProductionSystem = new Systems.CivilizationProductionSystem(
      this.intentQueue,
      this.game.events,
      this.civilizationRegistry,
      this.gameState,
    );
    this.ecsWorld.addSystem(this.civilizationProductionSystem);
    this.ecsWorld.addSystem(new Systems.MoveModeSystem(this.intentQueue, this.gameState, this.game.events));
    this.ecsWorld.addSystem(new Systems.PathRequestSystem(this.intentQueue, this.mapData, this.fogOfWar, this.gameState, this.game.events));
    this.ecsWorld.addSystem(new Systems.MovementSystem(this.mapData));
    this.ecsWorld.addSystem(new Systems.FogSystem(this.fogOfWar, this.intentQueue, this.gameState));
    this.ecsWorld.addSystem(new Systems.FoundCitySystem(this.intentQueue, this.gameState, this.game.events));
    this.ecsWorld.addSystem(new Systems.CombatSystem(this.intentQueue, this.game.events, this));
    this.ecsWorld.addSystem(new Systems.ProductionSystem(
      this.intentQueue,
      this.game.events,
      this,
      this.civilizationRegistry,
      this.unitSprites,
      this.mapData,
      this.civilizationProductionSystem,
    ));
    this.ecsWorld.addSystem(new Systems.ProduceUnitSystem(
      this.intentQueue,
      this.game.events,
      this,
      this.gameState,
      this.civilizationProductionSystem,
      this.civilizationRegistry,
      this.unitSprites,
    ));
    this.ecsWorld.addSystem(new Systems.ProduceBuildingSystem(
      this.intentQueue,
      this.game.events,
      this,
      this.gameState,
      this.civilizationProductionSystem,
      this.mapData,
    ));
    this.ecsWorld.addSystem(new Systems.BuildBuildingSystem(
      this.intentQueue,
      this.game.events,
      this,
    ));
    this.ecsWorld.addSystem(new Systems.RenderSyncSystem()); // Must be last logic system
  }

  // --- Entity & Sprite Creation ---

  private createTileEntities() {
    const tilesContainer = this.add.container(0, 0);
    for (let ty = 0; ty < this.mapData.height; ty++) {
      for (let tx = 0; tx < this.mapData.width; tx++) {
        const terrain = this.mapData.mustGetTerrainAt(tx, ty);
        const entity = this.ecsWorld.createEntity();
        this.ecsWorld.addComponent(entity, new Components.TransformTile(tx, ty));
        this.ecsWorld.addComponent(entity, new Components.Tile(terrain.id));

        const tileSprite = new IsoTileSprite(this, tx, ty, terrain);
        tilesContainer.add(tileSprite);
        this.tileSprites.set(entity, tileSprite);
      }
    }
  }

  private createInitialUnits(selectedCivId: string = DEFAULT_CIVILIZATION_ID) {
    this.unitsContainer = this.add.container(0, 0);
    this.pathPreview = this.add.graphics();
    this.unitsContainer.add(this.pathPreview);

    const startPos = this.mapData.startPos;
    const civId = selectedCivId;

    // Use UnitFactory to create the initial settler
    const unitFactory = new UnitFactory(
      this.ecsWorld,
      this,
      this.civilizationRegistry,
      this.unitSprites,
    );

    const settler = unitFactory.createUnit('settler', { tx: startPos.tx, ty: startPos.ty }, 0, civId);
    if (!settler) {
      throw new Error('Failed to create initial settler unit');
    }
  }

  /**
   * Creates bot units at random valid positions on the map.
   */
  private createBotUnits(bots: Array<{ civId: string; playerId: number }>) {
    const unitFactory = new UnitFactory(
      this.ecsWorld,
      this,
      this.civilizationRegistry,
      this.unitSprites,
    );

    // Get all valid spawn positions (not blocked, not water, not too close to player start)
    const validPositions = this.getValidSpawnPositions();
    
    if (validPositions.length < bots.length) {
      console.warn(`Not enough valid spawn positions for ${bots.length} bots. Only spawning ${validPositions.length} bots.`);
    }

    // Shuffle positions to randomize
    const shuffledPositions = [...validPositions].sort(() => Math.random() - 0.5);

    bots.forEach((bot, index) => {
      if (index >= shuffledPositions.length) {
        console.warn(`No valid spawn position for bot ${index + 1}`);
        return;
      }

      const spawnPos = shuffledPositions[index];
      const settler = unitFactory.createUnit('settler', spawnPos, bot.playerId, bot.civId);
      
      if (!settler) {
        console.warn(`Failed to create bot unit for ${bot.civId} at (${spawnPos.tx}, ${spawnPos.ty})`);
      }
    });
  }

  /**
   * Finds valid spawn positions on the map.
   * Valid positions are not blocked, not water, and not too close to player start.
   */
  private getValidSpawnPositions(): Array<{ tx: number; ty: number }> {
    const validPositions: Array<{ tx: number; ty: number }> = [];
    const { width, height } = this.mapData.getDimensions();
    const playerStart = this.mapData.startPos;
    const minDistanceFromPlayer = 5; // Minimum distance from player start

    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const terrain = this.mapData.getTerrainAt(tx, ty);
        
        // Skip if terrain is blocked or doesn't exist
        if (!terrain || terrain.blocked) {
          continue;
        }

        // Skip water (check if terrain id contains "water" or has moveCost -1)
        // Actually, blocked already covers this, but let's be explicit
        if (terrain.id.toLowerCase().includes('water')) {
          continue;
        }

        // Skip positions too close to player start
        const distance = Math.max(
          Math.abs(tx - playerStart.tx),
          Math.abs(ty - playerStart.ty),
        );
        if (distance < minDistanceFromPlayer) {
          continue;
        }

        validPositions.push({ tx, ty });
      }
    }

    return validPositions;
  }

  // --- Per-Frame Update Methods ---

  private updateUnitSprites() {
    // Clean up sprites for entities that no longer exist
    const currentEntities = new Set(this.ecsWorld.view(Components.Unit, Components.TransformTile));
    for (const [entity, sprite] of this.unitSprites.entries()) {
      if (!currentEntities.has(entity)) {
        // Entity was destroyed, remove its sprite
        sprite.destroy();
        this.unitSprites.delete(entity);
      }
    }

    // Update sprites for existing entities
    for (const entity of currentEntities) {
      const sprite = this.unitSprites.get(entity);
      const transform = this.ecsWorld.getComponent(entity, Components.TransformTile)!;
      const screenPos = this.ecsWorld.getComponent(entity, Components.ScreenPos);
      
      if (sprite) {
        // Calculate target position directly from TransformTile to ensure it's always correct
        const targetWorldPos = tileToWorld(transform);
        const targetX = targetWorldPos.x;
        const targetY = targetWorldPos.y;
        
        // Get current sprite position (world coordinates since sprite is directly in scene)
        const currentX = sprite.x;
        const currentY = sprite.y;

        // Always update position immediately - no animation for now to debug
        if (Math.abs(currentX - targetX) > 0.01 || Math.abs(currentY - targetY) > 0.01) {
          // Stop any existing tweens
          this.tweens.killTweensOf(sprite);
          
          // Set position immediately
          sprite.setPosition(targetX, targetY);
          sprite.setDepth(targetY + TILE_H);
        }
        
        // Also sync ScreenPos if it exists (for other systems that might use it)
        if (screenPos) {
          screenPos.x = targetX;
          screenPos.y = targetY;
        }
      }
    }
  }

  private updateCitySprites() {
    // Clean up sprites for cities that no longer exist
    const currentCities = new Set(this.ecsWorld.view(Components.City, Components.TransformTile));
    for (const [entity, sprite] of this.citySprites.entries()) {
      if (!currentCities.has(entity)) {
        // City was destroyed, remove its sprite
        sprite.destroy();
        this.citySprites.delete(entity);
      }
    }

    // Update or create sprites for existing cities
    for (const cityEntity of currentCities) {
      const transform = this.ecsWorld.getComponent(cityEntity, Components.TransformTile)!;
      const screenPos = this.ecsWorld.getComponent(cityEntity, Components.ScreenPos);
      const civilization = this.ecsWorld.getComponent(cityEntity, Components.CivilizationComponent);
      
      let citySprite = this.citySprites.get(cityEntity);
      if (!citySprite) {
        // Get civilization-specific city sprite if available
        const civ = civilization ? this.civilizationRegistry.get(civilization.civId) : undefined;
        const citySpriteKey = getCitySpriteKey('city', civ?.sprites);
        
        // Create new city sprite (try to load civilization-specific texture, fallback to base 'city' texture, then icon)
        const worldPos = tileToWorld(transform);
        citySprite = new CitySprite(this, worldPos.x, worldPos.y, citySpriteKey);
        this.add.existing(citySprite);
        this.citySprites.set(cityEntity, citySprite);
      } else {
        // Update existing sprite position
        const targetWorldPos = tileToWorld(transform);
        citySprite.setPosition(targetWorldPos.x, targetWorldPos.y);
        
        // Also sync ScreenPos if it exists
        if (screenPos) {
          screenPos.x = targetWorldPos.x;
          screenPos.y = targetWorldPos.y;
        }
      }
    }
  }

  private updateBuildingSprites() {
    const buildings = this.ecsWorld.view(Components.Building, Components.TransformTile);
    
    // Clean up sprites for buildings that no longer exist
    const currentBuildingEntities = new Set(buildings);
    for (const [entity, sprite] of this.buildingSprites.entries()) {
      if (!currentBuildingEntities.has(entity)) {
        sprite.destroy();
        this.buildingSprites.delete(entity);
      }
    }

    // Update sprites for existing buildings
    for (const buildingEntity of buildings) {
      const building = this.ecsWorld.getComponent(buildingEntity, Components.Building)!;
      const transform = this.ecsWorld.getComponent(buildingEntity, Components.TransformTile)!;
      
      let buildingSprite = this.buildingSprites.get(buildingEntity);
      if (!buildingSprite) {
        // Create new building sprite (simple colored circle for now)
        buildingSprite = this.add.graphics();
        this.buildingSprites.set(buildingEntity, buildingSprite);
      }

      // Update position
      const worldPos = tileToWorld(transform);
      buildingSprite.clear();
      
      // Draw a small icon to represent the building
      // Color based on building type (simple hash)
      const color = this.getBuildingColor(building.buildingType);
      buildingSprite.fillStyle(color, 0.8);
      buildingSprite.fillCircle(0, -8, 6); // Small circle above tile center
      buildingSprite.setPosition(worldPos.x, worldPos.y);
      buildingSprite.setDepth(worldPos.y + TILE_H / 2);
    }
  }

  /**
   * Gets a color for a building type (simple hash-based coloring).
   */
  private getBuildingColor(buildingType: string): number {
    // Simple hash function to get consistent colors
    let hash = 0;
    for (let i = 0; i < buildingType.length; i++) {
      hash = buildingType.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Generate a color in the range 0x444444 to 0xcccccc
    const color = 0x444444 + (Math.abs(hash) % 0x888888);
    return color;
  }

  private updateCityBorders() {
    const cities = this.ecsWorld.view(Components.City, Components.TransformTile);
    
    // Clean up borders for cities that no longer exist
    const currentCityEntities = new Set(cities);
    for (const [entity, border] of this.cityBorders.entries()) {
      if (!currentCityEntities.has(entity)) {
        border.destroy();
        this.cityBorders.delete(entity);
      }
    }

    // Update borders for all cities
    for (const cityEntity of cities) {
      const city = this.ecsWorld.getComponent(cityEntity, Components.City)!;
      const transform = this.ecsWorld.getComponent(cityEntity, Components.TransformTile)!;
      
      let border = this.cityBorders.get(cityEntity);
      if (!border) {
        border = this.add.graphics();
        this.cityBorders.set(cityEntity, border);
      }

      // Clear and redraw border
      border.clear();
      
      // Get all tiles within the city's sight range (population)
      const sightRange = city.getSightRange();
      const borderTiles = this.getTilesInRange(transform.tx, transform.ty, sightRange);
      
      // Draw border around each tile in the city's range
      border.lineStyle(2, 0x4169e1, 0.6); // Blue border with transparency
      
      for (const tile of borderTiles) {
        const worldPos = tileToWorld(tile);
        
        // Draw diamond outline using lineTo
        border.beginPath();
        border.moveTo(worldPos.x, worldPos.y - TILE_H / 2); // Top
        border.lineTo(worldPos.x + TILE_W / 2, worldPos.y); // Right
        border.lineTo(worldPos.x, worldPos.y + TILE_H / 2); // Bottom
        border.lineTo(worldPos.x - TILE_W / 2, worldPos.y); // Left
        border.closePath();
        border.strokePath();
      }
      
      // Set depth to be above tiles but below units
      const cityWorldPos = tileToWorld(transform);
      border.setDepth(cityWorldPos.y + TILE_H / 4);
    }
  }

  /**
   * Gets all tiles within a Chebyshev distance range from a center point.
   */
  private getTilesInRange(centerTx: number, centerTy: number, range: number): Array<{ tx: number; ty: number }> {
    const tiles: Array<{ tx: number; ty: number }> = [];
    const dimensions = this.mapData.getDimensions();
    
    for (let tx = centerTx - range; tx <= centerTx + range; tx++) {
      for (let ty = centerTy - range; ty <= centerTy + range; ty++) {
        if (chebyshevDistance({ tx, ty }, { tx: centerTx, ty: centerTy }) <= range) {
          if (tx >= 0 && tx < dimensions.width && ty >= 0 && ty < dimensions.height) {
            tiles.push({ tx, ty });
          }
        }
      }
    }
    
    return tiles;
  }

  private updateTileSprites() {
    const entities = this.ecsWorld.view(Components.Tile, Components.TransformTile);
    for (const entity of entities) {
      const sprite = this.tileSprites.get(entity);
      const transform = this.ecsWorld.getComponent(entity, Components.TransformTile)!;
      if (sprite) {
        const isVisible = this.fogOfWar.isVisible(transform.tx, transform.ty);
        const isRevealed = this.fogOfWar.isRevealed(transform.tx, transform.ty);
        sprite.updateFog(isVisible, isRevealed);
      }
    }
  }

  private updateSelectionAndPath() {
    if (!this.pathPreview) return; // Not initialized yet
    this.pathPreview.clear();
    this.unitSprites.forEach(s => s.clearTint());

    const selectedId = this.gameState.selectedEntity;
    if (selectedId === null) return;

    const unit = this.ecsWorld.getComponent(selectedId, Components.Unit);
    const transform = this.ecsWorld.getComponent(
      selectedId,
      Components.TransformTile,
    );

    if (!unit || !transform) return;

    // Highlight selected unit
    const sprite = this.unitSprites.get(selectedId);
    if (sprite) {
      sprite.setTint(SELECTION_COLOR);
    }

    // Draw path preview
    if (unit.path.length > 0) {
      this.pathPreview.lineStyle(2, PATH_COLOR, 0.8);
      const currentPos = tileToWorld(transform);
      this.pathPreview.beginPath();
      this.pathPreview.moveTo(currentPos.x, currentPos.y);
      for (const point of unit.path) {
        const worldPos = tileToWorld(point);
        this.pathPreview.lineTo(worldPos.x, worldPos.y);
      }
      this.pathPreview.strokePath();
    }
  }
}
