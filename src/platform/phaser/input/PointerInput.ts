import { World, Entity } from '@engine/ecs';
import { worldToTile, isoToWorld } from '@engine/math/iso';
import { GameState } from '@/state/GameState';
import { IntentQueue } from '@/state/IntentQueue';
import Phaser from 'phaser';
import * as Components from '@engine/gameplay/components';
import { Unit, City, TransformTile, ScreenPos } from '@engine/gameplay/components';

/**
 * Handles pointer input from Phaser and translates it into game intents.
 * This class decouples the raw Phaser input events from the game's logic.
 */
export class PointerInput {
  constructor(
    private scene: Phaser.Scene,
    private intents: IntentQueue,
    private world: World,
    private gameState: GameState,
  ) {
    this.scene.input.on(
      Phaser.Input.Events.POINTER_UP,
      this.handlePointerUp,
      this,
    );
  }

  private handlePointerUp = (pointer: Phaser.Input.Pointer) => {
    // Check if this was a camera drag (by checking if pointer moved significantly)
    // We'll let GameScene handle preventing clicks after drags
    interface GameSceneWithCameraController {
      cameraController?: { isDraggingCamera(): boolean };
    }
    const gameScene = this.scene as GameSceneWithCameraController;
    if (gameScene.cameraController?.isDraggingCamera()) {
      // This was a drag, not a click - don't process unit selection/movement
      return;
    }

    if (pointer.rightButtonReleased()) {
      this.handleRightClick();
      return;
    }

    // Get the clicked position in world coordinates
    // Use getWorldPoint to properly convert screen coordinates to world coordinates
    const worldPoint = this.scene.cameras.main.getWorldPoint(
      pointer.x,
      pointer.y,
    );

    // Convert world coordinates to the logical tile coordinates
    const targetTile = worldToTile(worldPoint.x, worldPoint.y);

    // Check if a unit was clicked - try both tile-based and sprite-based detection
    let clickedUnit = this.findUnitAt(targetTile.tx, targetTile.ty);
    
    // If no unit found by tile, try checking sprite bounds (for more forgiving click detection)
    if (clickedUnit === null) {
      clickedUnit = this.findUnitBySpriteBounds(worldPoint.x, worldPoint.y);
    }

    // Check if a city was clicked - try both tile-based and sprite-based detection
    let clickedCity = this.findCityAt(targetTile.tx, targetTile.ty);
    
    // If no city found by tile, try checking sprite bounds
    if (clickedCity === null) {
      clickedCity = this.findCityBySpriteBounds(worldPoint.x, worldPoint.y);
    }

    // Check if we should attack instead of selecting
    const selectedEntity = this.gameState.selectedEntity;
    if (selectedEntity !== null && clickedUnit !== null && clickedUnit !== selectedEntity) {
      // Check if selected unit can attack and if clicked unit is an enemy
      const selectedUnit = this.world.getComponent(selectedEntity, Unit);
      const clickedUnitComponent = this.world.getComponent(clickedUnit, Unit);
      const selectedOwner = this.world.getComponent(selectedEntity, Components.Owner);
      const clickedOwner = this.world.getComponent(clickedUnit, Components.Owner);

      if (
        selectedUnit &&
        clickedUnitComponent &&
        selectedUnit.canAttack &&
        selectedOwner &&
        clickedOwner &&
        selectedOwner.playerId !== clickedOwner.playerId
      ) {
        // Check if units are adjacent
        const selectedPos = this.world.getComponent(selectedEntity, Components.TransformTile);
        const clickedPos = this.world.getComponent(clickedUnit, Components.TransformTile);

        if (selectedPos && clickedPos) {
          const dx = Math.abs(selectedPos.tx - clickedPos.tx);
          const dy = Math.abs(selectedPos.ty - clickedPos.ty);
          const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);

          if (isAdjacent) {
            // Attack the enemy unit
            this.intents.push({
              type: 'Attack',
              payload: { attacker: selectedEntity, target: clickedUnit },
            });
            return;
          }
        }
      }
    }

    // Prioritize units over cities if both are at the same location
    const clickedEntity = clickedUnit ?? clickedCity;

    if (clickedEntity !== null) {
      // Check if the clicked entity is owned by the current active player
      const owner = this.world.getComponent(clickedEntity, Components.Owner);
      if (!owner) {
        return; // No owner, can't select
      }
      
      // In multiplayer, check if this unit belongs to the local player
      // In single-player, check if it belongs to the current player
      const canControl = this.gameState.isMultiplayer
        ? owner.playerId === this.gameState.localPlayerId
        : this.gameState.isCurrentPlayer(owner.playerId);
      
      if (canControl) {
        // A unit or city was clicked and it's owned by the current player, so select it (this will exit move mode)
        this.intents.push({
          type: 'SelectEntity',
          payload: { entity: clickedEntity },
        });
      }
      // If not owned by current player, do nothing (can't select enemy/bot entities)
    } else {
      // An empty tile was clicked
      if (this.gameState.moveMode && this.gameState.selectedEntity !== null) {
        // In move mode - issue move command
        this.intents.push({
          type: 'MoveTo',
          payload: { entity: this.gameState.selectedEntity, target: targetTile },
        });
      } else if (this.gameState.selectedEntity !== null) {
        // Not in move mode but unit is selected - deselect it
        this.intents.push({
          type: 'SelectEntity',
          payload: { entity: null },
        });
      }
      // If nothing is selected, clicking empty tile does nothing
    }
  };

  private handleRightClick() {
    // On right click, deselect the current unit
    this.intents.push({
      type: 'SelectEntity',
      payload: { entity: null },
    });
  }

  /**
   * Finds the first unit entity located at a given tile coordinate.
   * @returns The entity ID of the unit, or null if no unit is found.
   */
  private findUnitAt(tx: number, ty: number): Entity | null {
    // This is a simple linear search. For a large number of units,
    // a spatial partitioning system (e.g., a grid mapping tile coords to entities)
    // would be much more efficient.
    const units = this.world.view(Unit, TransformTile);
    
    for (const entity of units) {
      const pos = this.world.getComponent(entity, TransformTile);
      if (pos && pos.tx === tx && pos.ty === ty) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Finds an entity by checking if the world point is within any sprite's bounds.
   * This is a fallback for when tile-based detection fails due to coordinate issues.
   */
  private findEntityBySpriteBounds(
    worldX: number,
    worldY: number,
    entities: Entity[],
    spriteMap: Map<Entity, Phaser.GameObjects.GameObject>,
    clickRadius: number,
  ): Entity | null {
    for (const entity of entities) {
      const sprite = spriteMap.get(entity);
      if (!sprite) continue;

      // Type guard for sprites with x/y properties
      if ('x' in sprite && 'y' in sprite && typeof sprite.x === 'number' && typeof sprite.y === 'number') {
        const dx = sprite.x - worldX;
        const dy = sprite.y - worldY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < clickRadius) {
          return entity;
        }
      }
    }

    return null;
  }

  /**
   * Finds a unit by checking if the world point is within any unit sprite's bounds.
   * This is a fallback for when tile-based detection fails due to coordinate issues.
   */
  private findUnitBySpriteBounds(worldX: number, worldY: number): Entity | null {
    interface GameSceneWithSprites {
      unitSprites?: Map<Entity, Phaser.GameObjects.Sprite>;
    }
    const gameScene = this.scene as GameSceneWithSprites;
    
    if (!gameScene.unitSprites) {
      return null;
    }

    const units = Array.from(this.world.view(Unit, TransformTile));
    return this.findEntityBySpriteBounds(worldX, worldY, units, gameScene.unitSprites, 32);
  }

  /**
   * Finds the first city entity located at a given tile coordinate.
   * @returns The entity ID of the city, or null if no city is found.
   */
  private findCityAt(tx: number, ty: number): Entity | null {
    const cities = this.world.view(City, TransformTile);
    
    for (const entity of cities) {
      const pos = this.world.getComponent(entity, TransformTile);
      if (pos && pos.tx === tx && pos.ty === ty) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Finds a city by checking if the world point is within any city sprite's bounds.
   * This is a fallback for when tile-based detection fails due to coordinate issues.
   */
  private findCityBySpriteBounds(worldX: number, worldY: number): Entity | null {
    interface GameSceneWithSprites {
      citySprites?: Map<Entity, Phaser.GameObjects.Container>;
    }
    const gameScene = this.scene as GameSceneWithSprites;
    
    if (!gameScene.citySprites) {
      return null;
    }

    const cities = Array.from(this.world.view(City, TransformTile));
    return this.findEntityBySpriteBounds(worldX, worldY, cities, gameScene.citySprites, 40);
  }
}
