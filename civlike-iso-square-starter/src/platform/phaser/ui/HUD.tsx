import React, { useState, useEffect } from 'react';
import Phaser from 'phaser';
import { IntentQueue } from '@/state/IntentQueue';
import { GameState } from '@/state/GameState';
import { World, Entity } from '@engine/ecs';
import * as Components from '@engine/gameplay/components';
import { MapData } from '@engine/map/MapData';
import { Terrain } from '@engine/map/Terrain';

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

export const HUD: React.FC<HUDProps> = ({ game }) => {
  const [intentQueue, setIntentQueue] = useState<IntentQueue | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [ecsWorld, setEcsWorld] = useState<World | null>(null);
  const [_, setTick] = useState(0); // Used to force re-renders

  // --- Selected Entity State ---
  const [selectedUnit, setSelectedUnit] = useState<Components.Unit | null>(null);
  const [selectedUnitType, setSelectedUnitType] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<Components.City | null>(null);
  const [selectedTile, setSelectedTile] = useState<Terrain | null>(null);

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

    return () => {
      game.events.off('game-ready', handleGameReady);
      game.events.off('ui-update', forceUpdate);
    };
  }, [game]);

  useEffect(() => {
    if (!gameState || !ecsWorld) return;

    const { selectedEntity } = gameState;
    if (selectedEntity !== null) {
      const unit = ecsWorld.getComponent(selectedEntity, Components.Unit);
      const unitType = ecsWorld.getComponent(selectedEntity, Components.UnitType);
      const city = ecsWorld.getComponent(selectedEntity, Components.City);
      const transform = ecsWorld.getComponent(selectedEntity, Components.TransformTile);
      
      setSelectedUnit(unit ?? null);
      setSelectedUnitType(unitType?.type ?? null);
      setSelectedCity(city ?? null);

      // Access map data from GameScene
      const gameScene = game.scene.getScene('GameScene');
      if (transform && gameScene && 'mapData' in gameScene) {
        const map = (gameScene as { mapData: MapData }).mapData;
        const terrain = map.getTerrainAt(transform.tx, transform.ty);
        setSelectedTile(terrain ?? null);
      } else {
        setSelectedTile(null);
      }
    } else {
      setSelectedUnit(null);
      setSelectedUnitType(null);
      setSelectedCity(null);
      setSelectedTile(null);
    }
  }, [gameState, ecsWorld, gameState?.selectedEntity, gameState?.moveMode, _]); // Re-run when selection, move mode, or tick changes

  const handleEndTurn = () => {
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

  if (!gameState) {
    return null; // Don't render anything until the game is ready
  }

  const isMoveMode = gameState.moveMode;
  const hasSelection = gameState.selectedEntity !== null;

  return (
    <>
      {/* Left side HUD */}
      <div style={hudStyle}>
        <div>
          <strong>Turn: {gameState.turn}</strong>
        </div>
        <button style={buttonStyle} onClick={handleEndTurn}>
          End Turn
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
          </div>
        )}

        {selectedCity && (
          <div style={panelStyle}>
            <h4>Selected City</h4>
            <div>Population: {selectedCity.population}</div>
            <div style={{ marginTop: '10px' }}>
              <strong>Produce Unit:</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '5px' }}>
                <button
                  style={{ ...buttonStyle, fontSize: '12px', padding: '5px 10px' }}
                  onClick={() => handleProduceUnit('settler')}
                >
                  Settler
                </button>
                <button
                  style={{ ...buttonStyle, fontSize: '12px', padding: '5px 10px' }}
                  onClick={() => handleProduceUnit('scout')}
                >
                  Scout
                </button>
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
    </>
  );
};
