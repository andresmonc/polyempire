import React, { useState, useEffect } from 'react';
import Phaser from 'phaser';
import { IntentQueue } from '@/state/IntentQueue';
import { GameState } from '@/state/GameState';
import { World, Entity } from '@engine/ecs';
import * as Components from '@engine/gameplay/components';
import { MapData } from '@engine/map/MapData';
import { Terrain } from '@engine/map/Terrain';
import { CityYieldsCalculator, CityYields } from '@/utils/cityYields';
import { DEFAULT_CIVILIZATION_ID } from '@config/game';
import { TileContextMenu } from './TileContextMenu';
import { BuildingsData } from '@/utils/buildingFactory';

interface HUDProps {
  game: Phaser.Game;
}

const hudStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '20px',
  left: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  color: 'white',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  padding: '15px',
  borderRadius: '8px',
  border: '1px solid #444',
  fontFamily: 'sans-serif',
  fontSize: '14px',
  minWidth: '220px',
  pointerEvents: 'all',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#555',
  color: 'white',
  border: '1px solid #777',
  padding: '10px 15px',
  borderRadius: '5px',
  cursor: 'pointer',
  textAlign: 'center',
};

const panelStyle: React.CSSProperties = {
  borderTop: '1px solid #444',
  paddingTop: '10px',
  marginTop: '5px',
};

const commandMenuStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: '10px',
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  padding: '15px 20px',
  borderRadius: '8px',
  border: '1px solid #444',
  fontFamily: 'sans-serif',
  pointerEvents: 'all',
};

const commandButtonStyle: React.CSSProperties = {
  backgroundColor: '#4a5568',
  color: 'white',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#718096',
  padding: '12px 20px',
  borderRadius: '5px',
  cursor: 'pointer',
  textAlign: 'center',
  fontSize: '14px',
  fontWeight: '500',
  minWidth: '100px',
  transition: 'background-color 0.2s',
};

const commandButtonActiveStyle: React.CSSProperties = {
  ...commandButtonStyle,
  backgroundColor: '#2d3748',
  borderColor: '#4a5568',
};

const commandButtonHoverStyle: React.CSSProperties = {
  backgroundColor: '#5a6578',
};

const topBarStyle: React.CSSProperties = {
  position: 'absolute',
  top: '0',
  left: '0',
  right: '0',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '30px',
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  padding: '12px 20px',
  borderBottom: '2px solid #444',
  fontFamily: 'sans-serif',
  fontSize: '16px',
  fontWeight: '600',
  color: 'white',
  pointerEvents: 'none',
  zIndex: 1000,
};

const yieldItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const yieldLabelStyle: React.CSSProperties = {
  color: '#aaa',
  fontSize: '14px',
  fontWeight: '400',
};

const yieldValueStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: '18px',
  fontWeight: '600',
};

export const HUD: React.FC<HUDProps> = ({ game }) => {
  const [intentQueue, setIntentQueue] = useState<IntentQueue | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [ecsWorld, setEcsWorld] = useState<World | null>(null);
  const [_, setTick] = useState(0); // Used to force re-renders
  const [sessionInfo, setSessionInfo] = useState<{ 
    playersEndedTurn?: number[]; 
    allPlayersEnded?: boolean;
    isSequentialMode?: boolean;
  } | null>(null);

  // --- Selected Entity State ---
  const [selectedUnit, setSelectedUnit] = useState<Components.Unit | null>(null);
  const [selectedUnitType, setSelectedUnitType] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<Components.City | null>(null);
  const [selectedCityResources, setSelectedCityResources] = useState<Components.Resources | null>(null);
  const [selectedCityQueue, setSelectedCityQueue] = useState<Components.ProductionQueue | null>(null);
  const [selectedCityYields, setSelectedCityYields] = useState<CityYields | null>(null);
  const [selectedTile, setSelectedTile] = useState<Terrain | null>(null);
  
  // --- Tile Context Menu ---
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tx: number;
    ty: number;
    cityEntity: Entity;
  } | null>(null);
  
  // --- Civilization Total Yields ---
  const [totalYields, setTotalYields] = useState<CityYields>({ production: 0, gold: 0 });
  const [availableProduction, setAvailableProduction] = useState<number>(0);
  const [startingProductionPerTurn, setStartingProductionPerTurn] = useState<number>(0);

  useEffect(() => {
    const handleGameReady = (data: {
      intentQueue: IntentQueue;
      gameState: GameState;
      ecsWorld: World;
    }) => {
      setIntentQueue(data.intentQueue);
      setGameState(data.gameState);
      setEcsWorld(data.ecsWorld);
    };

    const forceUpdate = () => setTick(tick => tick + 1);

    game.events.on('game-ready', handleGameReady);
    // Listen for an event from Phaser to trigger re-renders
    game.events.on('ui-update', forceUpdate);
    // Listen for session updates
    game.events.on('session-update', (data: { 
      playersEndedTurn?: number[]; 
      allPlayersEnded?: boolean;
      isSequentialMode?: boolean;
    }) => {
      setSessionInfo(data);
    });
    // Listen for tile context menu events
    const handleShowContextMenu = (data: {
      x: number;
      y: number;
      tx: number;
      ty: number;
      cityEntity: Entity;
    }) => {
      setContextMenu(data);
    };
    game.events.on('show-tile-context-menu', handleShowContextMenu);
    
    // Close context menu on right-click elsewhere (handled by PointerInput deselecting)
    const handleDeselect = () => {
      setContextMenu(null);
    };
    // Listen for SelectEntity with null to close menu
    const handleUIUpdate = () => {
      // Context menu will be closed by click-outside handler, but we can also close it here
      // if needed for other reasons
    };

    return () => {
      game.events.off('game-ready', handleGameReady);
      game.events.off('ui-update', forceUpdate);
      game.events.off('session-update', () => {});
      game.events.off('show-tile-context-menu', handleShowContextMenu);
    };
  }, [game]);

  useEffect(() => {
    if (!gameState || !ecsWorld) return;

    const { selectedEntity } = gameState;
    if (selectedEntity !== null) {
      // Check if the selected entity is owned by the current active player
      const owner = ecsWorld.getComponent(selectedEntity, Components.Owner);
      if (!owner) {
        // No owner - clear all selection UI
        setSelectedUnit(null);
        setSelectedUnitType(null);
        setSelectedCity(null);
        setSelectedCityResources(null);
        setSelectedCityQueue(null);
        setSelectedCityYields(null);
        setSelectedTile(null);
        return;
      }
      
      // In multiplayer, check if this unit belongs to the local player
      // In single-player, check if it belongs to the current player
      const canView = gameState.isMultiplayer
        ? owner.playerId === gameState.localPlayerId
        : gameState.isCurrentPlayer(owner.playerId);
      
      if (!canView) {
        // Not owned by player - clear all selection UI
        setSelectedUnit(null);
        setSelectedUnitType(null);
        setSelectedCity(null);
        setSelectedCityResources(null);
        setSelectedCityQueue(null);
        setSelectedCityYields(null);
        setSelectedTile(null);
        return;
      }

      const unit = ecsWorld.getComponent(selectedEntity, Components.Unit);
      const unitType = ecsWorld.getComponent(selectedEntity, Components.UnitType);
      const city = ecsWorld.getComponent(selectedEntity, Components.City);
      const cityResources = ecsWorld.getComponent(selectedEntity, Components.Resources);
      const cityQueue = ecsWorld.getComponent(selectedEntity, Components.ProductionQueue);
      const transform = ecsWorld.getComponent(selectedEntity, Components.TransformTile);
      
      setSelectedUnit(unit ?? null);
      setSelectedUnitType(unitType?.type ?? null);
      setSelectedCity(city ?? null);
      setSelectedCityResources(cityResources ?? null);
      setSelectedCityQueue(cityQueue ?? null);
      
      // Access map data from GameScene (reused for both yields and terrain)
      const gameScene = game.scene.getScene('GameScene');
      if (gameScene && 'mapData' in gameScene) {
        const map = (gameScene as { mapData: MapData }).mapData;
        
        // Calculate per-turn yields for selected city
        if (city && transform && ecsWorld) {
          const yields = CityYieldsCalculator.calculateYields(ecsWorld, map, selectedEntity);
          setSelectedCityYields(yields);
        } else {
          setSelectedCityYields(null);
        }

        // Get terrain for selected tile
        if (transform) {
          const terrain = map.getTerrainAt(transform.tx, transform.ty);
          setSelectedTile(terrain ?? null);
        } else {
          setSelectedTile(null);
        }
      } else {
        setSelectedCityYields(null);
        setSelectedTile(null);
      }
    } else {
      setSelectedUnit(null);
      setSelectedUnitType(null);
      setSelectedCity(null);
      setSelectedCityResources(null);
      setSelectedCityQueue(null);
      setSelectedCityYields(null);
      setSelectedTile(null);
    }

    // Calculate total civilization yields for the current active player
    if (ecsWorld && gameState) {
      const gameScene = game.scene.getScene('GameScene');
      if (gameScene && 'mapData' in gameScene) {
        const map = (gameScene as { mapData: MapData }).mapData;
        const total = CityYieldsCalculator.calculateTotalYields(ecsWorld, map, gameState.currentPlayerId);
        setTotalYields(total);
        
        // Get available production from CivilizationProductionSystem
        if ('civilizationProductionSystem' in gameScene && 'civilizationRegistry' in gameScene) {
          const civProductionSystem = (gameScene as { civilizationProductionSystem: any }).civilizationProductionSystem;
          const civRegistry = (gameScene as { civilizationRegistry: any }).civilizationRegistry;
          // Get the current player's civilization ID
          // First try to get it from cities
          const cities = ecsWorld.view(Components.City, Components.Owner, Components.CivilizationComponent);
          let playerCivId = DEFAULT_CIVILIZATION_ID; // Default
          for (const cityEntity of cities) {
            const owner = ecsWorld.getComponent(cityEntity, Components.Owner);
            const civ = ecsWorld.getComponent(cityEntity, Components.CivilizationComponent);
            if (owner && owner.playerId === gameState.currentPlayerId && civ) {
              playerCivId = civ.civId;
              break;
            }
          }
          // If no cities found, try to get it from units
          if (playerCivId === DEFAULT_CIVILIZATION_ID) {
            const units = ecsWorld.view(Components.Unit, Components.Owner, Components.CivilizationComponent);
            for (const unitEntity of units) {
              const owner = ecsWorld.getComponent(unitEntity, Components.Owner);
              const civ = ecsWorld.getComponent(unitEntity, Components.CivilizationComponent);
              if (owner && owner.playerId === gameState.currentPlayerId && civ) {
                playerCivId = civ.civId;
                break;
              }
            }
          }
          const production = civProductionSystem.getProduction(playerCivId);
          setAvailableProduction(production);
          
          // Get starting production per turn for this civilization
          const civ = civRegistry.get(playerCivId);
          const startingProd = civ?.startingProduction || 0;
          setStartingProductionPerTurn(startingProd);
        }
      }
    }
  }, [gameState, ecsWorld, gameState?.selectedEntity, gameState?.moveMode, _, game]); // Re-run when selection, move mode, tick, or game changes

  const handleEndTurn = () => {
    // Prevent spamming EndTurn (only in simultaneous mode)
    if (gameState?.isMultiplayer && !sessionInfo?.isSequentialMode && sessionInfo?.playersEndedTurn?.includes(gameState.localPlayerId)) {
      console.warn('Cannot end turn - already ended this round');
      return;
    }
    // In sequential mode, isMyTurn() will handle validation
    intentQueue?.push({ type: 'EndTurn' });
  };

  const handleMove = () => {
    intentQueue?.push({ type: 'EnterMoveMode' });
  };

  const handleCancelMove = () => {
    intentQueue?.push({ type: 'CancelMoveMode' });
  };

  const handleFoundCity = () => {
    if (gameState?.selectedEntity !== null) {
      intentQueue?.push({ type: 'FoundCity', payload: { entity: gameState.selectedEntity } });
    }
  };

  const handleProduceUnit = (unitType: string) => {
    if (gameState?.selectedEntity !== null) {
      intentQueue?.push({
        type: 'ProduceUnit',
        payload: { cityEntity: gameState.selectedEntity, unitType },
      });
    }
  };

  const handleProduceBuilding = (buildingType: string) => {
    if (gameState?.selectedEntity !== null) {
      intentQueue?.push({
        type: 'ProduceBuilding',
        payload: { cityEntity: gameState.selectedEntity, buildingType },
      });
    }
  };

  if (!gameState) {
    return null; // Don't render anything until the game is ready
  }

  const isMoveMode = gameState.moveMode;
  const hasSelection = gameState.selectedEntity !== null;

  return (
    <>
      {/* Top Bar - Civilization Total Yields */}
      <div style={topBarStyle}>
        <div
          style={{
            ...yieldItemStyle,
            marginRight: '20px',
            paddingRight: '20px',
            borderRight: '1px solid #444',
          }}
        >
          <span style={yieldLabelStyle}>Player ID:</span>
          <span style={yieldValueStyle}>{gameState.localPlayerId}</span>
        </div>
        {gameState.isMultiplayer && gameState.sessionId && (
          <div
            style={{
              ...yieldItemStyle,
              marginRight: '20px',
              paddingRight: '20px',
              borderRight: '1px solid #444',
              pointerEvents: 'all',
              cursor: 'pointer'
            }}
            onClick={() => {
              navigator.clipboard.writeText(gameState.sessionId!);
              alert('Session ID copied to clipboard!');
            }}
            title="Click to copy session ID"
          >
            <span style={yieldLabelStyle}>Session ID:</span>
            <span
              style={{ ...yieldValueStyle, fontSize: '12px', fontFamily: 'monospace' }}
            >
              {gameState.sessionId.substring(0, 8)}...
            </span>
          </div>
        )}
        <div style={yieldItemStyle}>
          <span style={yieldLabelStyle}>Production:</span>
          <span style={yieldValueStyle}>+{(totalYields.production + startingProductionPerTurn).toFixed(1)}</span>
        </div>
        <div style={yieldItemStyle}>
          <span style={yieldLabelStyle}>Gold:</span>
          <span style={yieldValueStyle}>+{totalYields.gold.toFixed(1)}</span>
        </div>
        <div style={yieldItemStyle}>
          <span style={yieldLabelStyle}>Available Production:</span>
          <span style={yieldValueStyle}>{availableProduction.toFixed(0)}</span>
        </div>
      </div>

      {/* Left side HUD */}
      <div style={hudStyle}>
        <div>
          <strong>Turn: {gameState.turn}</strong>
        </div>
        {gameState.isMultiplayer && gameState.sessionId && (
          <div style={{ ...panelStyle, marginTop: '10px', paddingTop: '10px' }}>
            <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>Multiplayer Session</div>
            <div 
              style={{ 
                fontSize: '11px', 
                fontFamily: 'monospace', 
                backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                padding: '5px', 
                borderRadius: '3px',
                cursor: 'pointer',
                wordBreak: 'break-all'
              }}
              onClick={() => {
                navigator.clipboard.writeText(gameState.sessionId!);
                alert('Session ID copied to clipboard!');
              }}
              title="Click to copy full session ID"
            >
              {gameState.sessionId}
            </div>
            {sessionInfo && (
              <div style={{ marginTop: '10px', fontSize: '12px' }}>
                {sessionInfo.isSequentialMode ? (
                  // Sequential mode (war)
                  gameState.currentPlayerId === gameState.localPlayerId ? (
                    <div style={{ color: '#60a5fa' }}>⚔️ Your turn (Sequential - War Mode)</div>
                  ) : (
                    <div style={{ color: '#fbbf24' }}>⚔️ Waiting for opponent's turn (War Mode)</div>
                  )
                ) : (
                  // Simultaneous mode
                  sessionInfo.allPlayersEnded ? (
                    <div style={{ color: '#4ade80' }}>All players ready - Turn advancing...</div>
                  ) : sessionInfo.playersEndedTurn && sessionInfo.playersEndedTurn.includes(gameState.localPlayerId) ? (
                    <div style={{ color: '#fbbf24' }}>Waiting for other players...</div>
                  ) : (
                    <div style={{ color: '#60a5fa' }}>Your turn - Take your actions</div>
                  )
                )}
              </div>
            )}
          </div>
        )}
        <button 
          style={{
            ...buttonStyle,
            opacity: (gameState.isMultiplayer && 
              ((sessionInfo?.isSequentialMode && gameState.currentPlayerId !== gameState.localPlayerId) ||
               (!sessionInfo?.isSequentialMode && sessionInfo?.playersEndedTurn?.includes(gameState.localPlayerId)))) ? 0.5 : 1,
            cursor: (gameState.isMultiplayer && 
              ((sessionInfo?.isSequentialMode && gameState.currentPlayerId !== gameState.localPlayerId) ||
               (!sessionInfo?.isSequentialMode && sessionInfo?.playersEndedTurn?.includes(gameState.localPlayerId)))) ? 'not-allowed' : 'pointer'
          }}
          onClick={handleEndTurn}
          disabled={gameState.isMultiplayer && 
            ((sessionInfo?.isSequentialMode && gameState.currentPlayerId !== gameState.localPlayerId) ||
             (!sessionInfo?.isSequentialMode && sessionInfo?.playersEndedTurn?.includes(gameState.localPlayerId) === true))}
        >
          {gameState.isMultiplayer && sessionInfo?.isSequentialMode 
            ? (gameState.currentPlayerId === gameState.localPlayerId ? 'End Turn' : 'Not Your Turn')
            : (gameState.isMultiplayer && sessionInfo?.playersEndedTurn?.includes(gameState.localPlayerId) 
              ? 'Turn Ended' 
              : 'End Turn')}
        </button>

        {selectedUnit && (
          <div style={panelStyle}>
            <h4>Selected Unit</h4>
            <div>
              Movement: {selectedUnit.mp} / {selectedUnit.maxMp}
            </div>
            <div>Sight: {selectedUnit.sight}</div>
            <div>
              Health: {selectedUnit.health} / {selectedUnit.maxHealth}
            </div>
            {selectedUnit.canAttack && (
              <>
                <div>Attack: {selectedUnit.attack}</div>
                <div>Defense: {selectedUnit.defense}</div>
              </>
            )}
          </div>
        )}

        {selectedCity && (
          <div style={panelStyle}>
            <h4>Selected City</h4>
            <div>Population: {selectedCity.population}</div>
            
            {selectedCityResources && (
              <div style={{ marginTop: '10px' }}>
                <strong>Resources:</strong>
                <div>Production: {selectedCityResources.production.toFixed(1)}</div>
                <div>Gold: {selectedCityResources.gold.toFixed(1)}</div>
              </div>
            )}

            {selectedCityYields && (
              <div style={{ marginTop: '10px' }}>
                <strong>Per Turn:</strong>
                <div>Production: +{selectedCityYields.production.toFixed(1)}</div>
                <div>Gold: +{selectedCityYields.gold.toFixed(1)}</div>
              </div>
            )}

            {selectedCityQueue && (
              <div style={{ marginTop: '10px' }}>
                <strong>Production:</strong>
                {selectedCityQueue.isEmpty() ? (
                  <div style={{ fontStyle: 'italic', color: '#aaa' }}>No production</div>
                ) : (
                  <>
                    {selectedCityQueue.queue.map((item, index) => {
                      const isCurrent = index === 0;
                      const progress = isCurrent ? selectedCityQueue.currentProgress : 0;
                      const progressPercent = isCurrent ? (progress / item.cost) * 100 : 0;
                      
                      return (
                        <div
                          key={index}
                          style={{
                            marginTop: '5px',
                            padding: '5px',
                            backgroundColor: isCurrent ? 'rgba(255, 255, 0, 0.2)' : 'transparent',
                            borderRadius: '3px',
                          }}
                        >
                          <div>
                            {item.name} ({item.cost} prod)
                            {isCurrent && (
                              <div style={{ fontSize: '11px', color: '#aaa' }}>
                                {progress.toFixed(0)}/{item.cost} ({progressPercent.toFixed(0)}%)
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            <div style={{ marginTop: '10px' }}>
              <strong>Produce Unit:</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '5px' }}>
                <button
                  style={{ ...buttonStyle, fontSize: '12px', padding: '5px 10px' }}
                  onClick={() => handleProduceUnit('settler')}
                >
                  Settler (50)
                </button>
                <button
                  style={{ ...buttonStyle, fontSize: '12px', padding: '5px 10px' }}
                  onClick={() => handleProduceUnit('scout')}
                >
                  Scout (30)
                </button>
              </div>
            </div>

            <div style={{ marginTop: '10px' }}>
              <strong>Produce Building:</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '5px' }}>
                {(() => {
                  // Get buildings data from game scene
                  const gameScene = game.scene.getScene('GameScene');
                  if (!gameScene || !('cache' in gameScene)) return null;
                  
                  try {
                    const buildingsData = (gameScene as any).cache.json.get('buildings');
                    if (!buildingsData) return null;
                    
                    return Object.entries(buildingsData).map(([buildingType, building]: [string, any]) => {
                      const terrainReq = building.terrainRequirements?.length > 0
                        ? ` (${building.terrainRequirements.join(', ')})`
                        : '';
                      return (
                        <button
                          key={buildingType}
                          style={{ ...buttonStyle, fontSize: '11px', padding: '5px 10px' }}
                          onClick={() => handleProduceBuilding(buildingType)}
                          title={building.description || building.name}
                        >
                          {building.name} ({building.productionCost}{terrainReq})
                        </button>
                      );
                    });
                  } catch (error) {
                    return null;
                  }
                })()}
              </div>
            </div>
          </div>
        )}

        {selectedTile && (
          <div style={panelStyle}>
            <h4>Selected Tile</h4>
            <div>Terrain: {selectedTile.name}</div>
            <div>Move Cost: {selectedTile.moveCost > 0 ? selectedTile.moveCost : 'N/A'}</div>
          </div>
        )}
      </div>

      {/* Command Menu at bottom center */}
      {hasSelection && (
        <div style={commandMenuStyle}>
          {selectedUnit && (
            <>
              {!isMoveMode ? (
                <>
                  <button
                    style={commandButtonStyle}
                    onClick={handleMove}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = commandButtonHoverStyle.backgroundColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = commandButtonStyle.backgroundColor;
                    }}
                  >
                    Move
                  </button>
                  {selectedUnitType === 'settler' && (
                    <button
                      style={commandButtonStyle}
                      onClick={handleFoundCity}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = commandButtonHoverStyle.backgroundColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = commandButtonStyle.backgroundColor;
                      }}
                    >
                      Found City
                    </button>
                  )}
                </>
              ) : (
                <button
                  style={commandButtonActiveStyle}
                  onClick={handleCancelMove}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = commandButtonHoverStyle.backgroundColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = commandButtonActiveStyle.backgroundColor;
                  }}
                >
                  Cancel
                </button>
              )}
            </>
          )}
          {/* Future: Add commands for tiles, buildings, etc. */}
        </div>
      )}

      {/* Tile Context Menu */}
      {contextMenu && intentQueue && gameState && ecsWorld && (() => {
        const gameScene = game.scene.getScene('GameScene');
        if (!gameScene || !('cache' in gameScene) || !('mapData' in gameScene)) return null;
        
        try {
          const buildingsData = (gameScene as any).cache.json.get('buildings') as BuildingsData;
          const mapData = (gameScene as any).mapData as MapData;
          
          if (!buildingsData || !mapData) return null;
          
          return (
            <TileContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              tx={contextMenu.tx}
              ty={contextMenu.ty}
              cityEntity={contextMenu.cityEntity}
              intentQueue={intentQueue}
              buildingsData={buildingsData}
              mapData={mapData}
              onClose={() => setContextMenu(null)}
            />
          );
        } catch (error) {
          console.error('Error rendering context menu:', error);
          return null;
        }
      })()}
    </>
  );
};
