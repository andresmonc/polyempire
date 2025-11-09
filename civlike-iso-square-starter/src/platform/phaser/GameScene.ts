import Phaser from 'phaser';
import { World, Entity } from '@engine/ecs';
import { GameState } from '@/state/GameState';
import { IntentQueue } from '@/state/IntentQueue';
import { MapData } from '@engine/map/MapData';
import { TerrainRegistry } from '@engine/map/Terrain';
import { FogOfWar } from '@engine/map/FogOfWar';
import * as Systems from '@engine/gameplay/systems';
import * as Components from '@engine/gameplay/components';
import { PointerInput } from './input/PointerInput';
import { IsoTileSprite } from './sprites/IsoTileSprite';
import { UnitSprite } from './sprites/UnitSprite';
import { stableSort } from './depthSort';
import {
  CAMERA_SCROLL_SPEED,
  CAMERA_ZOOM,
  PATH_COLOR,
  SELECTION_COLOR,
  TILE_H,
} from '@config/game';
import { tileToWorld } from '@engine/math/iso';

/**
 * The main scene where the game is rendered and played.
 * It orchestrates the ECS world, game state, and Phaser-specific rendering.
 */
export class GameScene extends Phaser.Scene {
  private ecsWorld!: World;
  private gameState!: GameState;
  private intentQueue!: IntentQueue;
  public mapData!: MapData; // Made public for HUD access
  private fogOfWar!: FogOfWar;

  private tileSprites = new Map<Entity, IsoTileSprite>();
  public unitSprites = new Map<Entity, UnitSprite>(); // Made public for PointerInput access
  private unitsContainer!: Phaser.GameObjects.Container;
  private pathPreview!: Phaser.GameObjects.Graphics;
  private controls!: Phaser.Cameras.Controls.SmoothedKeyControl;

  constructor() {
    super('GameScene');
  }

  create() {
    // --- Initialization ---
    this.initializeState();
    this.initializeMap();
    this.initializeCamera();
    this.initializeInput();
    this.initializeSystems();

    // --- World Creation ---
    this.createTileEntities();
    this.createInitialUnits();

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
    this.updateTileSprites();
    this.updateSelectionAndPath();

    // Depth sort units after all position updates
    // Note: Units are now directly in scene, not container, so we sort the unit sprites
    const unitSpriteList = Array.from(this.unitSprites.values());
    stableSort(unitSpriteList);
  }

  // --- Initialization Methods ---

  private initializeState() {
    this.ecsWorld = new World();
    this.gameState = new GameState();
    this.intentQueue = new IntentQueue();
  }

  private initializeMap() {
    const terrainData = this.cache.json.get('terrains');
    const terrainRegistry = new TerrainRegistry(terrainData);

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

    // Panning controls
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
  }

  private initializeInput() {
    new PointerInput(this, this.intentQueue, this.ecsWorld, this.gameState);
  }

  private initializeSystems() {
    this.ecsWorld.addSystem(
      new Systems.TurnSystem(this.intentQueue, this.gameState, this.game.events),
    );
    this.ecsWorld.addSystem(new Systems.SelectionSystem(this.intentQueue, this.gameState));
    this.ecsWorld.addSystem(new Systems.PathRequestSystem(this.intentQueue, this.mapData, this.fogOfWar));
    this.ecsWorld.addSystem(new Systems.MovementSystem(this.mapData));
    this.ecsWorld.addSystem(new Systems.FogSystem(this.fogOfWar, this.intentQueue));
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

  private createInitialUnits() {
    this.unitsContainer = this.add.container(0, 0);
    this.pathPreview = this.add.graphics();
    this.unitsContainer.add(this.pathPreview);

    const unitData = this.cache.json.get('units').scout;
    const startPos = this.mapData.startPos;

    const scout = this.ecsWorld.createEntity();
    this.ecsWorld.addComponent(scout, new Components.TransformTile(startPos.tx, startPos.ty));
    this.ecsWorld.addComponent(scout, new Components.Unit(unitData.mp, unitData.mp, unitData.sightRange));
    this.ecsWorld.addComponent(scout, new Components.Owner(0)); // Player 0
    this.ecsWorld.addComponent(scout, new Components.Selectable());

    // Create ScreenPos immediately so sprite can be positioned correctly
    const initialWorldPos = tileToWorld(startPos);
    this.ecsWorld.addComponent(scout, new Components.ScreenPos(initialWorldPos.x, initialWorldPos.y));

    // Add sprite directly to scene, not container, to avoid positioning issues
    const unitSprite = new UnitSprite(this, initialWorldPos.x, initialWorldPos.y, 'unit');
    this.add.existing(unitSprite);
    this.unitSprites.set(scout, unitSprite);
  }

  // --- Per-Frame Update Methods ---

  private updateUnitSprites() {
    const entities = this.ecsWorld.view(Components.Unit, Components.TransformTile);
    for (const entity of entities) {
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
