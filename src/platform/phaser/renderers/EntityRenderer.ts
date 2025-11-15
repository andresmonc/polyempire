import Phaser from 'phaser';
import { World, Entity } from '@engine/ecs';
import * as Components from '@engine/gameplay/components';
import { UnitSprite } from '../sprites/UnitSprite';
import { CitySprite } from '../sprites/CitySprite';
import { CivilizationRegistry, getCitySpriteKey } from '@engine/civilization/Civilization';
import { tileToWorld } from '@engine/math/iso';
import { chebyshevDistance } from '@engine/math/grid';
import { TILE_H, TILE_W, SELECTION_COLOR, PATH_COLOR } from '@config/game';
import { MapData } from '@engine/map/MapData';

/**
 * Handles rendering and updating of entity sprites (units, cities, buildings, borders)
 */
export class EntityRenderer {
  private scene: Phaser.Scene;
  private ecsWorld: World;
  private civilizationRegistry: CivilizationRegistry;
  private mapData: MapData;
  
  public unitSprites = new Map<Entity, UnitSprite>();
  public citySprites = new Map<Entity, CitySprite>();
  private buildingSprites = new Map<Entity, Phaser.GameObjects.Graphics>();
  private cityBorders = new Map<Entity, Phaser.GameObjects.Graphics>();
  private pathPreview!: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    ecsWorld: World,
    civilizationRegistry: CivilizationRegistry,
    mapData: MapData,
    pathPreview: Phaser.GameObjects.Graphics,
  ) {
    this.scene = scene;
    this.ecsWorld = ecsWorld;
    this.civilizationRegistry = civilizationRegistry;
    this.mapData = mapData;
    this.pathPreview = pathPreview;
  }

  update(selectedEntityId: Entity | null): void {
    this.updateUnitSprites();
    this.updateCitySprites();
    this.updateBuildingSprites();
    this.updateCityBorders();
    this.updateSelectionAndPath(selectedEntityId);
  }

  private updateUnitSprites(): void {
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
          this.scene.tweens.killTweensOf(sprite);
          
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

  private updateCitySprites(): void {
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
        citySprite = new CitySprite(this.scene, worldPos.x, worldPos.y, citySpriteKey);
        this.scene.add.existing(citySprite);
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

  private updateBuildingSprites(): void {
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
        buildingSprite = this.scene.add.graphics();
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

  private updateCityBorders(): void {
    const cities = this.ecsWorld.view(Components.City, Components.TransformTile);
    
    // Clean up borders for cities that no longer exist
    const currentCityEntities = new Set(cities);
    for (const [entity, border] of this.cityBorders.entries()) {
      if (!currentCityEntities.has(entity)) {
        border.destroy();
        this.cityBorders.delete(entity);
      }
    }

    // Update borders for existing cities
    for (const cityEntity of cities) {
      const city = this.ecsWorld.getComponent(cityEntity, Components.City)!;
      const transform = this.ecsWorld.getComponent(cityEntity, Components.TransformTile)!;
      
      let border = this.cityBorders.get(cityEntity);
      if (!border) {
        border = this.scene.add.graphics();
        this.cityBorders.set(cityEntity, border);
      }

      // Clear and redraw border
      border.clear();
      
      // Get all tiles within the city's sight range (population)
      const sightRange = city.getSightRange();
      const tilesInRange = this.getTilesInRange(transform.tx, transform.ty, sightRange);
      
      // Draw border around city tiles
      const cityWorldPos = tileToWorld(transform);
      border.lineStyle(2, 0x4169e1, 0.6); // Blue border with transparency
      
      for (const tile of tilesInRange) {
        const worldPos = tileToWorld(tile);
        // Draw diamond shape border
        border.beginPath();
        border.moveTo(worldPos.x, worldPos.y - TILE_H / 2); // Top
        border.lineTo(worldPos.x + TILE_W / 2, worldPos.y); // Right
        border.lineTo(worldPos.x, worldPos.y + TILE_H / 2); // Bottom
        border.lineTo(worldPos.x - TILE_W / 2, worldPos.y); // Left
        border.closePath();
        border.strokePath();
      }
      
      border.setDepth(cityWorldPos.y + TILE_H / 4);
    }
  }

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

  /**
   * Updates selection and path preview for a selected entity
   */
  updateSelectionAndPath(selectedEntityId: Entity | null): void {
    if (!this.pathPreview) return;
    this.pathPreview.clear();
    this.unitSprites.forEach(s => s.clearTint());

    if (selectedEntityId === null) return;

    const unit = this.ecsWorld.getComponent(selectedEntityId, Components.Unit);
    const transform = this.ecsWorld.getComponent(selectedEntityId, Components.TransformTile);

    if (!unit || !transform) return;

    // Highlight selected unit
    const sprite = this.unitSprites.get(selectedEntityId);
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

