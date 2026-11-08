# OpenLife World Sync

The first shared-world prototype uses authenticated HTTP endpoints. It is a foundation for testing player persistence; it is not yet a production real-time multiplayer implementation.

## Endpoints

- `GET /api/world/players` — returns up to 100 other non-banned players that have saved a position. Requires a Bearer token.
- `POST /api/world/position` — saves the authenticated player's `x`, `y`, and `z` coordinates. Requires a Bearer token. Coordinates must be finite numbers within +/-100000. Updates are limited to one per 150 ms per user.

Positions are stored in the server's SQLite `world_positions` table and survive server restarts when the database file is on persistent storage.

## Unity client

`OpenLifeApiClient.UpdateWorldPosition(Vector3 position, ...)` saves the local player's position.

`OpenLifeApiClient.GetWorldPlayers(...)` retrieves other saved player positions.

The game movement script does not yet call these methods, and remote player avatars are not yet spawned. A later Unity integration step must send updates at a modest interval (not every rendered frame), interpolate remote players, handle disconnects/stale positions, and use HTTPS on a deployed server.

## Deployment notes

Set a strong `JWT_SECRET` (at least 32 characters), configure `CORS_ORIGIN`, and use a persistent disk for `DB_FILE`. Do not commit a real `.env` file or credentials. The server has not been deployed or load-tested.
