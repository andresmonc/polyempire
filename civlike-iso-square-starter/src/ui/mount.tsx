import React from 'react';
import ReactDOM from 'react-dom/client';
import Phaser from 'phaser';
import { HUD } from '@platform/phaser/ui/HUD';

/**
 * Mounts the React HUD component into the DOM.
 * This function is designed to be called from the main Phaser game entry point.
 * It safely checks for the existence of the root DOM element.
 *
 * @param game - The Phaser.Game instance. This can be used to communicate
 *               between the React UI and the Phaser game (e.g., via events).
 */
export function mountHud(game: Phaser.Game) {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <HUD game={game} />
      </React.StrictMode>,
    );
  } else {
    console.warn(
      'React root element not found. HUD will not be mounted. This is safe if you intend to run without a UI.',
    );
  }
}
