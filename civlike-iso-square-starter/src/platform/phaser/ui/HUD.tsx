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

export const HUD: React.FC<HUDProps> = ({ game }) => {
  const [intentQueue, setIntentQueue] = useState<IntentQueue | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [ecsWorld, setEcsWorld] = useState<World | null>(null);
  const [_, setTick] = useState(0); // Used to force re-renders

  // --- Selected Entity State ---
  const [selectedUnit, setSelectedUnit] = useState<Components.Unit | null>(null);
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
      const transform = ecsWorld.getComponent(selectedEntity, Components.TransformTile);
      
      setSelectedUnit(unit ?? null);

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
      setSelectedTile(null);
    }
  }, [gameState, ecsWorld, gameState?.selectedEntity, _]); // Re-run when selection or tick changes

  const handleEndTurn = () => {
    intentQueue?.push({ type: 'EndTurn' });
  };

  if (!gameState) {
    return null; // Don't render anything until the game is ready
  }

  return (
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
  );
};
