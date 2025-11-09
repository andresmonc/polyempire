import { System, Entity } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import { GameState } from '@/state/GameState';
import * as Components from '../components';
import { CivilizationRegistry } from '@engine/civilization/Civilization';
import { logger } from '@/utils/logger';
import Phaser from 'phaser';

/**
 * Manages civilization-level production.
 * Aggregates production from all cities and adds starting production per turn.
 */
export class CivilizationProductionSystem extends System {
  private intents: IntentQueue;
  private events: Phaser.Events.EventEmitter;
  private civilizationRegistry: CivilizationRegistry;
  private gameState: GameState;
  
  // Track civilization production by civId
  private civilizationProduction: Map<string, number> = new Map();
  private lastProcessedTurn: number = -1;

  constructor(
    intents: IntentQueue,
    events: Phaser.Events.EventEmitter,
    civilizationRegistry: CivilizationRegistry,
    gameState: GameState,
  ) {
    super();
    this.intents = intents;
    this.events = events;
    this.civilizationRegistry = civilizationRegistry;
    this.gameState = gameState;
  }

  /**
   * Gets the current production for a civilization.
   */
  public getProduction(civId: string): number {
    return this.civilizationProduction.get(civId) || 0;
  }

  /**
   * Adds production to a civilization.
   */
  public addProduction(civId: string, amount: number): void {
    const current = this.civilizationProduction.get(civId) || 0;
    this.civilizationProduction.set(civId, current + amount);
  }

  /**
   * Spends production from a civilization.
   */
  public spendProduction(civId: string, amount: number): boolean {
    const current = this.civilizationProduction.get(civId) || 0;
    if (current < amount) {
      return false;
    }
    this.civilizationProduction.set(civId, current - amount);
    return true;
  }

  /**
   * Initializes production for a civilization from config.
   * Sets the initial production stockpile (one-time starting bonus).
   */
  public initializeCivilization(civId: string): void {
    if (this.civilizationProduction.has(civId)) {
      return;
    }
    
    const civ = this.civilizationRegistry.get(civId);
    const startingProduction = civ?.startingProduction || 0;
    this.civilizationProduction.set(civId, startingProduction);
  }

  update(_dt: number): void {
    const turnBegan = this.intents.peek(isIntent('TurnBegan'));
    if (!turnBegan) {
      return;
    }

    // Only process once per turn
    if (this.lastProcessedTurn === this.gameState.turn) {
      return;
    }
    
    if (this.lastProcessedTurn !== -1 && this.lastProcessedTurn >= this.gameState.turn) {
      logger.warn(`CivilizationProductionSystem: Turn processing out of sync`);
      return;
    }

    // Group cities by civilization
    const citiesByCiv = new Map<string, Entity[]>();
    const cities = this.world.view(
      Components.City,
      Components.Resources,
      Components.CivilizationComponent,
    );

    const seenCivs = new Set<string>();

    for (const cityEntity of cities) {
      const civ = this.world.getComponent(cityEntity, Components.CivilizationComponent);
      if (!civ) continue;

      if (!citiesByCiv.has(civ.civId)) {
        citiesByCiv.set(civ.civId, []);
        if (!this.civilizationProduction.has(civ.civId)) {
          this.initializeCivilization(civ.civId);
        }
      }
      citiesByCiv.get(civ.civId)!.push(cityEntity);
      seenCivs.add(civ.civId);
    }

    // Also check units for civilizations without cities
    const units = this.world.view(Components.Unit, Components.Owner, Components.CivilizationComponent);
    for (const unitEntity of units) {
      const owner = this.world.getComponent(unitEntity, Components.Owner);
      const civ = this.world.getComponent(unitEntity, Components.CivilizationComponent);
      
      if (owner && this.gameState.isCurrentPlayer(owner.playerId) && civ && !seenCivs.has(civ.civId)) {
        if (!this.civilizationProduction.has(civ.civId)) {
          this.initializeCivilization(civ.civId);
        }
        seenCivs.add(civ.civId);
        if (!citiesByCiv.has(civ.civId)) {
          citiesByCiv.set(civ.civId, []);
        }
      }
    }

    // Process each civilization
    for (const [civId, cityEntities] of citiesByCiv) {
      const civ = this.civilizationRegistry.get(civId);
      const startingProduction = civ?.startingProduction || 0;
      if (startingProduction > 0) {
        this.addProduction(civId, startingProduction);
      }

      let totalCityProduction = 0;
      for (const cityEntity of cityEntities) {
        const resources = this.world.getComponent(cityEntity, Components.Resources);
        if (resources && resources.production > 0) {
          totalCityProduction += resources.production;
          resources.production = 0;
        }
      }

      if (totalCityProduction > 0) {
        this.addProduction(civId, totalCityProduction);
      }
    }

    this.lastProcessedTurn = this.gameState.turn;

    this.events.emit('ui-update');
  }
}

