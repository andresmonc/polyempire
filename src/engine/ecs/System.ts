import { World } from './World';

/**
 * A System processes entities that have a certain set of components.
 * Logic is implemented in the `update` method.
 */
export abstract class System {
  public world!: World;

  /**
   * This method is called on every frame by the World.
   * @param dt - The time delta since the last update, in milliseconds.
   */
  public abstract update(dt: number): void;
}
