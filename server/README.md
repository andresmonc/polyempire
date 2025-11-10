# PolyEmpire API Server

REST API server for multiplayer game sessions.

## Setup

```bash
cd server
npm install
```

## Development

```bash
npm run dev
```

Server will run on `http://localhost:3000`

## Production

```bash
npm run build
npm start
```

## Architecture

```
server/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Express app setup
│   ├── routes/               # API route handlers
│   │   └── games.ts          # Game endpoints
│   ├── services/             # Business logic
│   │   ├── GameSessionService.ts
│   │   └── ActionValidator.ts
│   ├── models/               # Data models
│   │   └── GameSession.ts
│   └── middleware/           # Express middleware
│       └── errorHandler.ts
├── package.json
└── tsconfig.json
```

## API Endpoints

### Games
- `POST /api/games` - Create a new game session
  ```json
  {
    "name": "My Game",
    "playerName": "Player 1",
    "civilizationId": "romans"
  }
  ```

- `GET /api/games/:id` - Get game session info

- `POST /api/games/:id/join` - Join an existing game
  ```json
  {
    "playerName": "Player 2",
    "civilizationId": "greeks"
  }
  ```

- `POST /api/games/:id/actions` - Submit a game action
  ```json
  {
    "playerId": 1,
    "intent": {
      "type": "MoveTo",
      "payload": {
        "entity": 1,
        "target": { "tx": 5, "ty": 5 }
      }
    }
  }
  ```

- `GET /api/games/:id/state?since=<timestamp>` - Get game state updates (with polling support)

## Shared Types

Types are shared between frontend and backend via the `/shared` folder at the project root. The server imports from `@shared/types`.
