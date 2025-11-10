import { IGameClient } from './GameClient';
import { LocalGameClient } from './LocalGameClient';
import { RestGameClient } from './RestGameClient';
import { NetworkConfig } from './types';

/**
 * Factory to create the appropriate game client based on configuration
 */
export function createGameClient(
  mode: 'local' | 'rest',
  config?: NetworkConfig,
): IGameClient {
  switch (mode) {
    case 'rest':
      return new RestGameClient(config);
    case 'local':
    default:
      return new LocalGameClient();
  }
}

