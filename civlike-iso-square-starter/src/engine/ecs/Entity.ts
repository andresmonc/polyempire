import { Component } from './Component';

// A type-safe mapping of component class constructors to component instances.
// e.g., { Position: { x: 0, y: 0 } }
export type ComponentMap = { [name: string]: Component };

// A component constructor.
export type ComponentClass<T extends Component> = new (...args: any[]) => T;

/**
 * The Entity is a simple ID. All its data is stored in components.
 */
export type Entity = number;
