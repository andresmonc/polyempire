import { Router, type Request, type Response } from 'express';
import { gameSessionService } from '../services/GameSessionService';
import { ActionValidator } from '../services/ActionValidator';
import type {
  CreateGameRequest,
  CreateGameResponse,
  JoinGameRequest,
  JoinGameResponse,
  SubmitActionRequest,
  ActionResponse,
  GameStateUpdate,
} from '@shared/types';

const router = Router();

/**
 * POST /api/games
 * Create a new game session
 */
router.post('/', async (req: Request<{}, CreateGameResponse, CreateGameRequest>, res: Response) => {
  try {
    const { name, playerName, civilizationId } = req.body;

    if (!name || !playerName || !civilizationId) {
      return res.status(400).json({ error: 'Missing required fields' } as any);
    }

    const { sessionId, playerId, game } = await gameSessionService.createGame(
      name,
      playerName,
      civilizationId,
      req.body.mapWidth || 20, // Default to 20 if not provided (matches map.sample.json)
      req.body.mapHeight || 12, // Default to 12 if not provided
    );

    res.json({
      sessionId,
      playerId,
      game: game.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message } as any);
  }
});

/**
 * GET /api/games/:id
 * Get game session info
 */
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const game = await gameSessionService.getGame(id);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' } as any);
    }

    // Return extended info with turn status
    res.json(game.getExtendedInfo());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message } as any);
  }
});

/**
 * POST /api/games/:id/join
 * Join an existing game
 */
router.post(
  '/:id/join',
  async (req: Request<{ id: string }, JoinGameResponse, JoinGameRequest>, res: Response) => {
    try {
      const { id } = req.params;
      const { playerName, civilizationId } = req.body;

      if (!playerName || !civilizationId) {
        return res.status(400).json({ error: 'Missing required fields' } as any);
      }

      // mapWidth and mapHeight are optional - server uses stored dimensions from game creation
      const { playerId, game } = await gameSessionService.joinGame(
        id,
        playerName,
        civilizationId,
        req.body.mapWidth,
        req.body.mapHeight,
      );

      res.json({
        playerId,
        game: game.toJSON(),
      });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('not found') || message.includes('finished')) {
        return res.status(404).json({ error: message } as any);
      }
      if (message.includes('already')) {
        return res.status(409).json({ error: message } as any);
      }
      res.status(500).json({ error: message } as any);
    }
  },
);

/**
 * POST /api/games/:id/actions
 * Submit a game action
 */
router.post(
  '/:id/actions',
  async (req: Request<{ id: string }, ActionResponse, SubmitActionRequest>, res: Response) => {
    try {
      const { id } = req.params;
      const { playerId, intent } = req.body;

      if (playerId === undefined || !intent) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
        });
      }

      // Validate intent structure
      const validation = ActionValidator.validate(intent);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
        });
      }

      // Submit action
      await gameSessionService.submitAction(id, playerId, intent);

      const game = await gameSessionService.getGame(id);
      if (!game) {
        return res.status(404).json({
          success: false,
          error: 'Game not found',
        });
      }

      res.json({
        success: true,
        turn: game.currentTurn,
      });
    } catch (error) {
      const message = (error as Error).message;
      res.status(400).json({
        success: false,
        error: message,
      });
    }
  },
);

/**
 * GET /api/games/:id/state
 * Get game state updates (with polling support)
 */
router.get('/:id/state', async (req: Request<{ id: string }, GameStateUpdate>, res: Response) => {
  try {
    const { id } = req.params;
    const since = req.query.since as string | undefined;
    const requestFullState = req.query.fullState === 'true' || req.query.fullState === true;
    
    console.log(`[GET /games/${id}/state] Query params:`, { since, fullState: req.query.fullState, requestFullState });

    const game = await gameSessionService.getGame(id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' } as any);
    }

    // If fullState is requested, pass empty string to getStateUpdates to trigger full state
    const sinceTimestamp = requestFullState ? '' : (since || game.getLastStateUpdate());
    console.log(`[GET /games/${id}/state] requestFullState: ${requestFullState}, sinceTimestamp: ${sinceTimestamp}`);
    const { actions, lastUpdate, fullState } = await gameSessionService.getStateUpdates(id, sinceTimestamp);
    console.log(`[GET /games/${id}/state] Returning ${actions.length} actions, fullState: ${!!fullState}, entities: ${fullState?.entities?.length || 0}`);

    // If no updates, return 304 Not Modified
    if (actions.length === 0 && since && !fullState) {
      return res.status(304).send();
    }

    // Convert actions to Intent[] format
    const intentActions = actions.map(a => a.intent);

    res.json({
      sessionId: id,
      turn: game.currentTurn,
      currentPlayerId: game.currentPlayerId,
      actions: intentActions,
      fullState,
      timestamp: lastUpdate,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message } as any);
  }
});

/**
 * POST /api/games/:id/war
 * Declare war between two players (triggers sequential turn mode)
 */
router.post('/:id/war', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const { player1Id, player2Id } = req.body;

    if (player1Id === undefined || player2Id === undefined) {
      return res.status(400).json({ error: 'Missing player IDs' } as any);
    }

    await gameSessionService.declareWar(id, player1Id, player2Id);
    const game = await gameSessionService.getGame(id);
    
    res.json({
      success: true,
      game: game?.getExtendedInfo(),
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message } as any);
  }
});

/**
 * DELETE /api/games/:id/war
 * End war between two players (returns to simultaneous turn mode)
 */
router.delete('/:id/war', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const { player1Id, player2Id } = req.body;

    if (player1Id === undefined || player2Id === undefined) {
      return res.status(400).json({ error: 'Missing player IDs' } as any);
    }

    await gameSessionService.endWar(id, player1Id, player2Id);
    const game = await gameSessionService.getGame(id);
    
    res.json({
      success: true,
      game: game?.getExtendedInfo(),
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message } as any);
  }
});

export default router;

