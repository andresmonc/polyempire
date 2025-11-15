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
import { EntityRenderer } from './renderers/EntityRenderer';
import { FogRenderer } from './renderers/FogRenderer';
import { NetworkSyncManager } from './managers/NetworkSyncManager';
import { CameraController } from './managers/CameraController';
import { EntityFactory } from './factories/EntityFactory';
import {
  CAMERA_SCROLL_SPEED,
  CAMERA_ZOOM,
  PATH_COLOR,
  SELECTION_COLOR,
  TILE_H,
  TILE_W,
  FOG_COLOR,
  FOG_ALPHA_REVEALED,
  FOG_ALPHA_UNREVEALED,
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
  // Map local entity IDs to server entity IDs for multiplayer sync
  private entityIdMap = new Map<number, number>(); // localEntityId -> serverEntityId
  private serverEntityIdMap = new Map<number, number>(); // serverEntityId -> localEntityId
  public mapData!: MapData; // Made public for HUD access
  private fogOfWar!: FogOfWar;
  private civilizationRegistry!: CivilizationRegistry;

  private tileSprites = new Map<Entity, IsoTileSprite>();
  private unitsContainer!: Phaser.GameObjects.Container;
  private pathPreview!: Phaser.GameObjects.Graphics;
  public civilizationProductionSystem!: Systems.CivilizationProductionSystem; // Made public for ProductionSystem access
  
  // Refactored managers and renderers
  private entityRenderer!: EntityRenderer;
  private fogRenderer!: FogRenderer;
  private networkSyncManager!: NetworkSyncManager;
  private cameraController!: CameraController;
  private entityFactory!: EntityFactory;
  
  // Expose sprites for systems that need them
  public get unitSprites() {
    return this.entityRenderer.unitSprites;
  }
  
  public get citySprites() {
    return this.entityRenderer.citySprites;
  }

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
    this.initializeMap(); // Must be called before requesting initial state (needed for civilizationRegistry)
    
    // Initialize units container (needed for both single and multiplayer)
    this.unitsContainer = this.add.container(0, 0);
    this.pathPreview = this.add.graphics();
    this.unitsContainer.add(this.pathPreview);
    
    // Initialize refactored managers and renderers BEFORE systems (systems need unitSprites)
    this.entityRenderer = new EntityRenderer(
      this,
      this.ecsWorld,
      this.civilizationRegistry,
      this.mapData,
      this.pathPreview,
    );
    
    // Create empty tileSprites map for FogRenderer (will be populated later)
    this.tileSprites = new Map<Entity, IsoTileSprite>();
    
    this.fogRenderer = new FogRenderer(
      this,
      this.ecsWorld,
      this.fogOfWar,
      this.gameState,
      this.tileSprites,
    );
    this.fogRenderer.initialize();
    
    this.networkSyncManager = new NetworkSyncManager(
      this.ecsWorld,
      this.gameState,
      this.intentQueue,
      this.entityRenderer.unitSprites,
    );
    
    this.cameraController = new CameraController(this);
    this.cameraController.initialize();
    
    this.entityFactory = new EntityFactory(
      this,
      this.ecsWorld,
      this.mapData,
      this.civilizationRegistry,
      this.entityRenderer.unitSprites,
    );
    
    // Now initialize systems (they need entityRenderer to be ready)
    this.initializeSystems();
    
    this.initializeInput();
    
    // Request initial state after map is initialized (for multiplayer)
    if (data?.multiplayer && this.gameClient) {
      const initialUpdate = await (this.gameClient as any).getStateUpdate(true);
      if (initialUpdate) {
        this.handleStateUpdate(initialUpdate);
      } else {
        console.warn('[GameScene] No initial state update received from server');
      }
    }

    // --- World Creation ---
    // Create tile entities and update tileSprites map
    const newTileSprites = this.entityFactory.createTileEntities();
    // Merge new tiles into existing map (in case it was already initialized)
    for (const [entity, sprite] of newTileSprites.entries()) {
      this.tileSprites.set(entity, sprite);
    }
    
    if (data?.multiplayer) {
      // In multiplayer, wait for initial state sync from server
      // The server will send full state with all entities
      // We'll create units when we receive the first state update
    } else {
      // Single player: create units locally
      const allPlayers: Array<{ playerId: number; civId: string }> = [{
        playerId: 0,
        civId: data?.selectedCivId || DEFAULT_CIVILIZATION_ID,
      }];
      
      if (data?.bots && data.bots.length > 0) {
        data.bots.forEach(bot => {
          allPlayers.push({
            playerId: bot.playerId,
            civId: bot.civId,
          });
        });
      }
      
      // Generate starting positions for all players at once
      await this.entityFactory.createUnitsForAllPlayers(allPlayers);
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
    // Guard: Don't update if not fully initialized yet
    if (!this.cameraController || !this.entityRenderer || !this.fogRenderer) {
      return;
    }

    // Update camera controls
    this.cameraController.update(delta);

    // --- Game Logic Update ---
    // This runs all the systems in the ECS world
    this.ecsWorld.update(delta);

    // --- Phaser-specific Updates ---
    this.entityRenderer.update(this.gameState.selectedEntity);
    this.fogRenderer.update();

    // Depth sort units after all position updates
    const unitSpriteList = Array.from(this.entityRenderer.unitSprites.values());
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
      
      // Start polling for updates (initial state will be requested after map init)
      if (this.gameClient.startPolling) {
        this.gameClient.startPolling((update) => {
          this.handleStateUpdate(update);
        });
        
        // Also poll for session info updates (turn status)
        // Check if player count changed to trigger full state refresh
        let lastPlayerCount = this.gameClient.getSession()?.players?.length || 0;
        setInterval(async () => {
          const session = this.gameClient.getSession();
          if (session && this.gameState.isMultiplayer) {
            const currentPlayerCount = session.players?.length || 0;
            
            // If player count increased, force a full state refresh to see new player's units
            if (currentPlayerCount > lastPlayerCount) {
              lastPlayerCount = currentPlayerCount;
              
              // Request full state update to get new player's units
              try {
                const fullStateUpdate = await (this.gameClient as any).getStateUpdate(true);
                if (fullStateUpdate) {
                  this.handleStateUpdate(fullStateUpdate);
                }
              } catch (error) {
                console.error('[GameScene] Failed to refresh state after player join:', error);
              }
            } else if (currentPlayerCount !== lastPlayerCount) {
              // Player count decreased (player left)
              lastPlayerCount = currentPlayerCount;
            }
            
            this.game.events.emit('session-update', {
              playersEndedTurn: session.playersEndedTurn,
              allPlayersEnded: session.allPlayersEnded,
              isSequentialMode: session.isSequentialMode,
            });
          }
        }, 1500); // Poll every 1.5 seconds (faster to catch new players)
      }
    } else {
      this.gameClient = createGameClient('local');
      await this.gameClient.initialize('local-game', playerId);
    }

    // Create network-aware intent queue
    this.intentQueue = new NetworkIntentQueue();
    this.intentQueue.setGameClient(this.gameClient);
    
    // Expose entity ID mapping to game client for intent translation
    if (this.gameClient && 'entityIdMap' in this.gameClient) {
      (this.gameClient as any).entityIdMap = this.entityIdMap;
    }
  }

  /**
   * Handle state updates from the server (for multiplayer games)
   */
  private handleStateUpdate(update: GameStateUpdate): void {
    // If we have full state, sync entities first (this happens on initial load)
    if (update.fullState) {
      this.syncEntitiesFromServer(update.fullState);
    }

    // Use NetworkSyncManager for state update handling
    this.networkSyncManager.handleStateUpdate(update, this.gameClient, this.game.events);
  }

  /**
   * Synchronize entities from server state
   */
  private syncEntitiesFromServer(fullState: {
    entities: Array<{
      id: number;
      ownerId: number;
      civId: string;
      type: string;
      position: { tx: number; ty: number };
      data: Record<string, unknown>;
    }>;
  }): void {
    // Only sync in multiplayer mode
    if (!this.gameState.isMultiplayer) return;

    // Ensure civilization registry is initialized (it should be from initializeMap)
    if (!this.civilizationRegistry) {
      console.error('[GameScene] civilizationRegistry not initialized yet!');
      return;
    }

    // Ensure units container exists
    if (!this.unitsContainer) {
      this.unitsContainer = this.add.container(0, 0);
      this.pathPreview = this.add.graphics();
      this.unitsContainer.add(this.pathPreview);
    }

    const unitFactory = new UnitFactory(
      this.ecsWorld,
      this,
      this.civilizationRegistry,
      this.entityRenderer.unitSprites,
    );
    
    // Store reference to unitsContainer in unitFactory if it has a method to set it
    // (UnitFactory adds sprites directly to scene, which should work, but let's verify)

    // Track which entities we've synced
    const syncedEntityIds = new Set<number>();

    fullState.entities.forEach((serverEntity) => {
      if (serverEntity.type === 'unit') {
        syncedEntityIds.add(serverEntity.id);

        // First, try to find existing entity by server entity ID mapping (most reliable)
        let existingEntity = this.serverEntityIdMap.get(serverEntity.id);
        
        // If not found by ID mapping, try to find by owner and position
        // IMPORTANT: Only match if owner matches exactly to prevent cross-player mix-ups
        if (!existingEntity) {
          existingEntity = Array.from(this.ecsWorld.view(Components.Unit, Components.Owner)).find(
            (e) => {
              const owner = this.ecsWorld.getComponent(e, Components.Owner);
              const transform = this.ecsWorld.getComponent(e, Components.TransformTile);
              // Match by owner (MUST match exactly) and exact position (or very close - within 1 tile)
              // Also check that this entity isn't already mapped to a different server entity
              if (owner?.playerId === serverEntity.ownerId && transform) {
                const currentMappedId = this.entityIdMap.get(e);
                // If already mapped to a different server entity, don't remap it
                if (currentMappedId !== undefined && currentMappedId !== serverEntity.id) {
                  return false;
                }
                const dx = Math.abs(transform.tx - serverEntity.position.tx);
                const dy = Math.abs(transform.ty - serverEntity.position.ty);
                return dx <= 1 && dy <= 1;
              }
              return false;
            }
          );
        }

        if (!existingEntity) {
          // Create new entity from server state
          const unitType = (serverEntity.data.unitType as string) || 'settler';
          const entity = unitFactory.createUnit(
            unitType,
            serverEntity.position,
            serverEntity.ownerId,
            serverEntity.civId,
          );
          
          // Entity is a number, so we need to check for null/undefined, not truthiness (entity 0 is valid!)
          if (entity !== null && entity !== undefined && typeof entity === 'number') {
            // Update entity data from server
            const unit = this.ecsWorld.getComponent(entity, Components.Unit);
            if (unit) {
              unit.mp = (serverEntity.data.mp as number) ?? unit.mp;
              unit.maxMp = (serverEntity.data.maxMp as number) ?? unit.maxMp;
              unit.health = (serverEntity.data.health as number) ?? unit.health;
              unit.maxHealth = (serverEntity.data.maxHealth as number) ?? unit.maxHealth;
            }
            
            // If this is the local player's unit, center camera on it
            const transform = this.ecsWorld.getComponent(entity, Components.TransformTile);
            if (serverEntity.ownerId === this.gameState.localPlayerId && transform) {
              const worldPos = tileToWorld(transform);
              this.cameras.main.centerOn(worldPos.x, worldPos.y);
            }
            
            // Store server entity ID mapping for this local entity
            // Verify ownership before mapping to prevent cross-player mix-ups
            const owner = this.ecsWorld.getComponent(entity, Components.Owner);
            if (owner && owner.playerId === serverEntity.ownerId) {
              this.entityIdMap.set(entity, serverEntity.id);
              this.serverEntityIdMap.set(serverEntity.id, entity);
              console.log(`[GameScene] Mapped local entity ${entity} (player ${owner.playerId}) to server entity ${serverEntity.id} (player ${serverEntity.ownerId})`);
            } else {
              console.error(`[GameScene] Ownership mismatch when creating entity mapping: local entity ${entity} owner ${owner?.playerId} vs server entity ${serverEntity.id} owner ${serverEntity.ownerId}`);
            }
          } else {
            console.error(`[GameScene] Failed to create entity for player ${serverEntity.ownerId}`);
          }
        } else {
          // Update existing entity position and data from server
          const transform = this.ecsWorld.getComponent(existingEntity, Components.TransformTile);
          const unit = this.ecsWorld.getComponent(existingEntity, Components.Unit);
          const owner = this.ecsWorld.getComponent(existingEntity, Components.Owner);
          
          // Update entity ID mapping (in case it wasn't set before)
          // IMPORTANT: Verify ownership matches before updating mapping to prevent cross-player entity ID mix-ups
          if (owner && owner.playerId === serverEntity.ownerId) {
            const currentMappedId = this.entityIdMap.get(existingEntity);
            if (currentMappedId !== serverEntity.id) {
              // Remove old mapping if it exists
              if (currentMappedId !== undefined) {
                this.serverEntityIdMap.delete(currentMappedId);
              }
              this.entityIdMap.set(existingEntity, serverEntity.id);
              this.serverEntityIdMap.set(serverEntity.id, existingEntity);
            }
          } else if (owner && owner.playerId !== serverEntity.ownerId) {
            // Ownership mismatch - this shouldn't happen, but log it
            console.warn(`[GameScene] Ownership mismatch when syncing entity: local owner ${owner.playerId} vs server owner ${serverEntity.ownerId}`);
          }
          
          // Only update if it's not the local player's unit (server is authoritative)
          // OR if it's another player's unit (always sync)
          if (owner && owner.playerId !== this.gameState.localPlayerId) {
            if (transform) {
              transform.tx = serverEntity.position.tx;
              transform.ty = serverEntity.position.ty;
              const worldPos = tileToWorld(serverEntity.position);
              const screenPos = this.ecsWorld.getComponent(existingEntity, Components.ScreenPos);
              if (screenPos) {
                screenPos.x = worldPos.x;
                screenPos.y = worldPos.y;
              }
              // Update sprite position
              const sprite = this.entityRenderer.unitSprites.get(existingEntity);
              if (sprite) {
                sprite.setPosition(worldPos.x, worldPos.y);
              }
            }
            
            if (unit) {
              unit.mp = (serverEntity.data.mp as number) ?? unit.mp;
              unit.maxMp = (serverEntity.data.maxMp as number) ?? unit.maxMp;
              unit.health = (serverEntity.data.health as number) ?? unit.health;
              unit.maxHealth = (serverEntity.data.maxHealth as number) ?? unit.maxHealth;
            }
          }
        }
      }
    });

    // Remove entities that don't exist on server (for all players, to prevent duplicates)
    const localUnits = Array.from(this.ecsWorld.view(Components.Unit, Components.Owner));
    
    for (const entity of localUnits) {
      const owner = this.ecsWorld.getComponent(entity, Components.Owner);
      if (!owner) continue;
      
      // Check if this entity exists on server
      // First check by server entity ID mapping (most reliable)
      const serverEntityId = this.entityIdMap.get(entity);
      const existsByMapping = serverEntityId !== undefined && syncedEntityIds.has(serverEntityId);
      
      // Also check by position and owner (fallback)
      const transform = this.ecsWorld.getComponent(entity, Components.TransformTile);
      let existsByPosition = false;
      if (transform) {
        const matchingServerEntity = fullState.entities.find(
          e => e.type === 'unit' &&
               e.ownerId === owner.playerId &&
               Math.abs(e.position.tx - transform.tx) <= 1 &&
               Math.abs(e.position.ty - transform.ty) <= 1
        );
        if (matchingServerEntity) {
          existsByPosition = true;
          // Update mapping if it wasn't set
          if (!serverEntityId) {
            this.entityIdMap.set(entity, matchingServerEntity.id);
            this.serverEntityIdMap.set(matchingServerEntity.id, entity);
          }
        }
      }
      
      // If entity doesn't exist on server (by either method), remove it
      // This prevents duplicates, especially for the local player
      if (!existsByMapping && !existsByPosition) {
        // Remove entity and sprite
        const sprite = this.entityRenderer.unitSprites.get(entity);
        if (sprite) {
          sprite.destroy();
          this.entityRenderer.unitSprites.delete(entity);
        }
        // Clean up entity ID mappings
        if (serverEntityId !== undefined) {
          this.entityIdMap.delete(entity);
          this.serverEntityIdMap.delete(serverEntityId);
        }
        this.ecsWorld.destroyEntity(entity);
      }
    }
    
    // Also check for duplicate server entities (same server ID mapped to multiple local entities)
    for (const [serverId, localEntity] of this.serverEntityIdMap.entries()) {
      if (syncedEntityIds.has(serverId)) {
        // Check if there are other local entities mapped to the same server ID
        const duplicates = localUnits.filter(e => {
          const mappedId = this.entityIdMap.get(e);
          return mappedId === serverId && e !== localEntity;
        });
        
        if (duplicates.length > 0) {
          for (const duplicate of duplicates) {
            const sprite = this.entityRenderer.unitSprites.get(duplicate);
            if (sprite) {
              sprite.destroy();
              this.entityRenderer.unitSprites.delete(duplicate);
            }
            this.entityIdMap.delete(duplicate);
            this.ecsWorld.destroyEntity(duplicate);
          }
        }
      }
    }
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
    // Camera initialization is now handled by CameraController
    // This method is kept for backwards compatibility but does nothing
  }

  private initializeInput() {
    new PointerInput(this, this.intentQueue, this.ecsWorld, this.gameState);
  }

  private initializeSystems() {
    this.ecsWorld.addSystem(
      new Systems.TurnSystem(this.intentQueue, this.gameState, this.game.events),
    );
    this.ecsWorld.addSystem(new Systems.SelectionSystem(this.intentQueue, this.gameState, this.game.events));
    this.ecsWorld.addSystem(new Systems.CityGrowthSystem()); // Checks if cities can level up based on population
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
      this.gameState,
      this.civilizationProductionSystem,
    ));
    this.ecsWorld.addSystem(new Systems.RenderSyncSystem()); // Must be last logic system
  }

  // --- Entity & Sprite Creation ---
  // These methods are now handled by EntityFactory and EntityRenderer
}
