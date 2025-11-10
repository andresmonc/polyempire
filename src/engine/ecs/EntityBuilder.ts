import { World, Entity } from '@engine/ecs';
import * as Components from '@engine/gameplay/components';
import { TilePoint, tileToWorld } from '@engine/math/iso';

/**
 * Builder pattern for creating entities with common component combinations
 * Reduces duplication when creating units, cities, buildings, etc.
 */
export class EntityBuilder {
  constructor(private world: World) {}

  /**
   * Creates an entity with position components (TransformTile and ScreenPos)
   */
  withPosition(position: TilePoint): this {
    const entity = this.world.createEntity();
    this.world.addComponent(entity, new Components.TransformTile(position.tx, position.ty));
    const worldPos = tileToWorld(position);
    this.world.addComponent(entity, new Components.ScreenPos(worldPos.x, worldPos.y));
    return this as any;
  }

  /**
   * Adds ownership and civilization components
   */
  withOwnership(playerId: number, civId?: string): this {
    // This is a bit tricky with the builder pattern in TypeScript
    // We'll need to track the entity being built
    throw new Error('Use build() method instead - this is a helper for internal use');
  }

  /**
   * Creates a complete entity with position, ownership, and civilization
   * This is the main entry point for the builder
   */
  static createOwnedEntity(
    world: World,
    position: TilePoint,
    playerId: number,
    civId?: string,
  ): Entity {
    const entity = world.createEntity();
    world.addComponent(entity, new Components.TransformTile(position.tx, position.ty));
    const worldPos = tileToWorld(position);
    world.addComponent(entity, new Components.ScreenPos(worldPos.x, worldPos.y));
    world.addComponent(entity, new Components.Owner(playerId));
    if (civId) {
      world.addComponent(entity, new Components.CivilizationComponent(civId));
    }
    return entity;
  }

  /**
   * Adds ownership components to an existing entity
   */
  static addOwnership(
    world: World,
    entity: Entity,
    playerId: number,
    civId?: string,
  ): void {
    world.addComponent(entity, new Components.Owner(playerId));
    if (civId) {
      world.addComponent(entity, new Components.CivilizationComponent(civId));
    }
  }
}

