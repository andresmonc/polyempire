import { System } from '@engine/ecs';
import { isoToWorld } from '@engine/math/iso';
import { ScreenPos, TransformTile } from '../components';

/**
 * This system acts as a bridge between the logical game state and the
 * rendering engine. It translates logical `TransformTile` positions into
 * pixel-based `ScreenPos` positions that the renderer (e.g., Phaser) can use.
 *
 * This keeps the core game logic completely independent of the rendering implementation.
 */
export class RenderSyncSystem extends System {
  update(_dt: number): void {
    const entities = this.world.view(TransformTile);

    for (const entity of entities) {
      const transform = this.world.getComponent(entity, TransformTile)!;
      const screenPos = this.world.getComponent(entity, ScreenPos);

      const newScreenPos = isoToWorld(transform.tx, transform.ty);

      if (screenPos) {
        // Update existing component
        screenPos.x = newScreenPos.x;
        screenPos.y = newScreenPos.y;
      } else {
        // Add new component if it doesn't exist
        this.world.addComponent(entity, new ScreenPos(newScreenPos.x, newScreenPos.y));
      }
    }
  }
}
