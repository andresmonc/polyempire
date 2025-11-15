import React from 'react';
import { IntentQueue } from '@/state/IntentQueue';
import { Entity } from '@engine/ecs';
import { BuildingsData } from '@/utils/buildingFactory';
import { MapData } from '@engine/map/MapData';

interface TileContextMenuProps {
  x: number;
  y: number;
  tx: number;
  ty: number;
  cityEntity: Entity;
  intentQueue: IntentQueue;
  buildingsData: BuildingsData;
  mapData: MapData;
  onClose: () => void;
}

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  border: '2px solid #555',
  borderRadius: '8px',
  padding: '10px',
  minWidth: '200px',
  maxWidth: '300px',
  maxHeight: '400px',
  overflowY: 'auto',
  zIndex: 10000,
  fontFamily: 'sans-serif',
  color: 'white',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
};

const menuHeaderStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 'bold',
  marginBottom: '10px',
  paddingBottom: '8px',
  borderBottom: '1px solid #555',
};

const menuItemStyle: React.CSSProperties = {
  padding: '8px 12px',
  margin: '4px 0',
  backgroundColor: '#333',
  border: '1px solid #555',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
  transition: 'background-color 0.2s',
};

const menuItemHoverStyle: React.CSSProperties = {
  backgroundColor: '#444',
};

const disabledMenuItemStyle: React.CSSProperties = {
  ...menuItemStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '5px',
  right: '5px',
  background: 'none',
  border: 'none',
  color: '#aaa',
  fontSize: '20px',
  cursor: 'pointer',
  padding: '0 8px',
};

export const TileContextMenu: React.FC<TileContextMenuProps> = ({
  x,
  y,
  tx,
  ty,
  cityEntity,
  intentQueue,
  buildingsData,
  mapData,
  onClose,
}) => {
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Add event listener after a short delay to avoid closing immediately on right-click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Get terrain at this tile
  const terrain = mapData.getTerrainAt(tx, ty);
  const terrainId = terrain?.id || '';

  // Filter buildings that can be built on this terrain
  const availableBuildings = Object.entries(buildingsData).filter(([_, building]) => {
    // If building has terrain requirements, check if this tile matches
    if (building.terrainRequirements && building.terrainRequirements.length > 0) {
      return building.terrainRequirements.includes(terrainId);
    }
    // If no terrain requirements, building can be built anywhere
    return true;
  });

  const handleBuildBuilding = (buildingType: string) => {
    intentQueue.push({
      type: 'BuildBuilding',
      payload: {
        cityEntity,
        buildingType,
        tx,
        ty,
      },
    });
    onClose();
  };

  // Position menu near cursor, but keep it on screen
  const menuX = Math.min(x, window.innerWidth - 250);
  const menuY = Math.min(y, window.innerHeight - 400);

  if (availableBuildings.length === 0) {
    return (
      <div ref={menuRef} style={{ ...menuStyle, left: `${menuX}px`, top: `${menuY}px` }}>
        <button style={closeButtonStyle} onClick={onClose}>
          ×
        </button>
        <div style={menuHeaderStyle}>Build Building</div>
        <div style={{ padding: '10px', color: '#aaa', fontSize: '14px' }}>
          No buildings available for this terrain ({terrainId})
        </div>
      </div>
    );
  }

  return (
    <div ref={menuRef} style={{ ...menuStyle, left: `${menuX}px`, top: `${menuY}px` }}>
      <button style={closeButtonStyle} onClick={onClose}>
        ×
      </button>
      <div style={menuHeaderStyle}>Build Building</div>
      <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>
        Tile: ({tx}, {ty}) - {terrain?.name || terrainId}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {availableBuildings.map(([buildingType, building]) => {
          const isHovered = hoveredItem === buildingType;
          return (
            <div
              key={buildingType}
              style={isHovered ? { ...menuItemStyle, ...menuItemHoverStyle } : menuItemStyle}
              onMouseEnter={() => setHoveredItem(buildingType)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => handleBuildBuilding(buildingType)}
              title={building.description || building.name}
            >
              <div style={{ fontWeight: 'bold' }}>{building.name}</div>
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                Cost: {building.productionCost} production
                {building.population && ` • +${building.population} population`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

