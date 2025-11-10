# Game Session Repository Pattern

This directory implements the **Repository Pattern** for game session storage, making it easy to switch between different storage backends.

## Current Implementation

**InMemoryGameSessionRepository** - Similar to H2 in-memory mode
- Fast, no setup required
- Data lost on server restart
- Perfect for development

## Easy Database Migration

To switch to a database, just implement `IGameSessionRepository` and swap it in:

```typescript
// In GameSessionService constructor:
// Before (in-memory):
this.repository = new InMemoryGameSessionRepository();

// After (SQLite - like H2 file mode):
this.repository = new SqliteGameSessionRepository('games.db');

// Or PostgreSQL:
this.repository = new PostgresGameSessionRepository(connectionString);
```

## Recommended: SQLite (H2 Equivalent)

For Node.js/TypeScript, **SQLite** is the closest equivalent to H2:

- ✅ File-based (like H2 file mode)
- ✅ Zero configuration
- ✅ Can run in-memory (like H2 in-memory)
- ✅ Easy to switch to PostgreSQL later (same SQL)
- ✅ Perfect for development and small deployments

### Setup SQLite

1. Install: `npm install better-sqlite3`
2. Implement `SqliteGameSessionRepository` (see stub file)
3. Swap in `GameSessionService` constructor
4. Done! No other code changes needed.

## Architecture

```
GameSessionService (business logic)
    ↓ uses
IGameSessionRepository (interface)
    ↓ implemented by
InMemoryGameSessionRepository (current)
SqliteGameSessionRepository (future)
PostgresGameSessionRepository (future)
```

The service layer doesn't know or care which storage backend is used!

