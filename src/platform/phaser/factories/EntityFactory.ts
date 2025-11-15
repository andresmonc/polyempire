import Phaser from 'phaser';
import { World, Entity } from '@engine/ecs';
import { MapData } from '@engine/map/MapData';
import { CivilizationRegistry } from '@engine/civilization/Civilization';
import { UnitFactory } from '@/utils/unitFactory';
import { IsoTileSprite } from '../sprites/IsoTileSprite';
import * as Components from '@engine/gameplay/components';
import { UnitSprite } from '../sprites/UnitSprite';

/**
 * Handles creation of game entities (tiles, units, etc.)
 */
export class EntityFactory {
  private scene: Phaser.Scene;
  private ecsWorld: World;
  private mapData: MapData;
  private civilizationRegistry: CivilizationRegistry;
  private unitSprites: Map<Entity, UnitSprite>;

  constructor(
    scene: Phaser.Scene,
    ecsWorld: World,
    mapData: MapData,
    civilizationRegistry: CivilizationRegistry,
    unitSprites: Map<Entity, UnitSprite>,
  ) {
    this.scene = scene;
    this.ecsWorld = ecsWorld;
    this.mapData = mapData;
    this.civilizationRegistry = civilizationRegistry;
    this.unitSprites = unitSprites;
  }

  /**
   * Create all tile entities for the map
   */
  createTileEntities(): Map<Entity, IsoTileSprite> {
    const tileSprites = new Map<Entity, IsoTileSprite>();
    const tilesContainer = this.scene.add.container(0, 0);
    
    for (let ty = 0; ty < this.mapData.height; ty++) {
      for (let tx = 0; tx < this.mapData.width; tx++) {
        const terrain = this.mapData.mustGetTerrainAt(tx, ty);
        const entity = this.ecsWorld.createEntity();
        this.ecsWorld.addComponent(entity, new Components.TransformTile(tx, ty));
        this.ecsWorld.addComponent(entity, new Components.Tile(terrain.id));

        const tileSprite = new IsoTileSprite(this.scene, tx, ty, terrain);
        tilesContainer.add(tileSprite);
        tileSprites.set(entity, tileSprite);
      }
    }
    
    return tileSprites;
  }

  /**
   * Creates units for all players with properly spaced starting positions
   */
  async createUnitsForAllPlayers(players: Array<{ playerId: number; civId: string }>): Promise<void> {
    const unitFactory = new UnitFactory(
      this.ecsWorld,
      this.scene,
      this.civilizationRegistry,
      this.unitSprites,
    );

    // Generate starting positions for all players at once
    const { generateStartingPositions } = await import('@/utils/startingPositions');
    const startingPositions = generateStartingPositions(players.length, this.mapData, {
      minDistance: 8, // Minimum 8 tiles apart
      preferGoodTerrain: true,
    });

    // Create a settler for each player at their assigned position
    players.forEach((player, index) => {
      if (index >= startingPositions.length) {
        console.warn(`No starting position for player ${player.playerId}`);
        return;
      }

      const startPos = startingPositions[index];
      const settler = unitFactory.createUnit(
        'settler',
        { tx: startPos.tx, ty: startPos.ty },
        player.playerId,
        player.civId,
      );
      
      if (!settler) {
        console.warn(`Failed to create initial settler unit for player ${player.playerId} at (${startPos.tx}, ${startPos.ty})`);
      }
    });
  }
}

