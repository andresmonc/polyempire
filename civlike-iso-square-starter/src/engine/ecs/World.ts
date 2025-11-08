import { Component, ComponentClass, ComponentMap, Entity } from './Entity';
import { System } from './System';

/**
 * The World is the main container for all entities, components, and systems.
 * It manages the game state and orchestrates updates.
 */
export class World {
  private nextEntityId = 0;
  private entities = new Set<Entity>();
  private components = new Map<string, Map<Entity, Component>>();
  private systems: System[] = [];

  // --- Entity Management ---

  public createEntity(): Entity {
    const entity = this.nextEntityId++;
    this.entities.add(entity);
    return entity;
  }

  public destroyEntity(entity: Entity): void {
    if (!this.entities.has(entity)) return;

    for (const componentMap of this.components.values()) {
      componentMap.delete(entity);
    }
    this.entities.delete(entity);
  }

  // --- Component Management ---

  public addComponent<T extends Component>(
    entity: Entity,
    component: T,
  ): void {
    const componentName = component.constructor.name;
    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map());
    }
    this.components.get(componentName)!.set(entity, component);
  }

  public getComponent<T extends Component>(
    entity: Entity,
    componentClass: ComponentClass<T>,
  ): T | undefined {
    const componentMap = this.components.get(componentClass.name);
    return componentMap?.get(entity) as T | undefined;
  }

  public hasComponent<T extends Component>(
    entity: Entity,
    componentClass: ComponentClass<T>,
  ): boolean {
    const componentMap = this.components.get(componentClass.name);
    return componentMap?.has(entity) ?? false;
  }

  public removeComponent<T extends Component>(
    entity: Entity,
    componentClass: ComponentClass<T>,
  ): void {
    this.components.get(componentClass.name)?.delete(entity);
  }

  // --- System & View Management ---

  public addSystem(system: System): void {
    this.systems.push(system);
    system.world = this;
  }

  /**
   * Retrieves all entities that have a specific set of components.
   * @param componentClasses - The component classes to query for.
   * @returns An array of entities that have all the specified components.
   */
  public view<T extends Component[]>(
    ...componentClasses: { [K in keyof T]: ComponentClass<T[K]> }
  ): Entity[] {
    const entities: Entity[] = [];
    if (componentClasses.length === 0) {
      return Array.from(this.entities);
    }

    // Find the smallest component map to iterate over
    let smallestMapSize = Infinity;
    let smallestMapName: string | null = null;

    for (const cls of componentClasses) {
      const map = this.components.get(cls.name);
      if (map && map.size < smallestMapSize) {
        smallestMapSize = map.size;
        smallestMapName = cls.name;
      }
    }

    if (!smallestMapName) return [];

    const primaryMap = this.components.get(smallestMapName)!;

    // Iterate over the smallest set and check for other components
    for (const entity of primaryMap.keys()) {
      let hasAll = true;
      for (const cls of componentClasses) {
        if (!this.hasComponent(entity, cls)) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) {
        entities.push(entity);
      }
    }
    return entities;
  }

  /**
   * Runs all registered systems in the order they were added.
   * @param dt - The time delta since the last update.
   */
  public update(dt: number): void {
    for (const system of this.systems) {
      system.update(dt);
    }
  }
}
