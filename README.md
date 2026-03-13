# sapa.io

Multiplayer agar.io-style (2D) game built with TypeScript and WebSockets.

## What this project is

`sapa.io` is a simple real-time game prototype:
- Each player controls a cell/circle.
- Eating food increases your size.
- A larger player can consume a smaller one if the size advantage rule is met.

The main goal is to demonstrate a minimal client-server architecture for multiplayer games.

## Tech stack

- Runtime: Node.js
- Language: TypeScript
- HTTP server: Express
- Real-time transport: WebSocket (`ws`)
- Client rendering: Native Canvas 2D

## Project structure

- `server/index.ts`: composition/bootstrap (Express + HTTP/HTTPS + WebSocket wiring).
- `server/game.ts`: `GameEngine` (movement, collisions, growth, food respawn).
- `server/game-config.ts`: centralized gameplay configuration object (`gameConfig`).
- `server/game-physics.ts`: shared math/collision helpers for the engine.
- `server/game-loop.ts`: `GameLoopCoordinator` (tick scheduling, eliminations, state broadcast).
- `server/message-handler.ts`: `ClientMessageParser` + `MessageRouter` for client message handling.
- `server/session-manager.ts`: `SessionManager` for WebSocket session/player mapping and send/broadcast.
- `server/types.ts`: message contracts and shared state types (consumed by server and client).
- `server/utils.ts`: shared server utilities (e.g. ID generation).
- `client/main.ts`: client bootstrap (HTTPS guard, canvas loop, server message handling, mouse -> move messages).
- `client/index.html`: client entry point.
- `client/styles.css`: base styles for menu/canvas.
- `client/utils/network.ts`: `connectAndJoin` and WebSocket lifecycle handlers.
- `client/utils/state.ts`: local client state (`players`, `food`, `bounds`, `myPlayerId`) + snapshot/update helpers.
- `client/utils/render.ts`: world/player/food/HUD rendering and camera transform.
- `client/utils/ui.ts`: menu wiring and start flow.
- `client/utils/utils.ts`: shared client helpers (`clamp`, `screenToWorld`).

## How it works (summary)

1. The client opens `wss://localhost:3000/game`.
2. From the start menu, it sends `{ type: "join", name, color }`.
3. The server creates a player and replies with `joinAck` containing `playerId`, `bounds`, and initial state.
4. The client sends `move` messages using mouse target coordinates in world space.
5. The server updates the world at `30 ticks/s` (`GameLoopCoordinator`) and broadcasts `gameState` to all clients.
6. If the local player is eliminated (`playerDead`), the client closes WS, resets local state, hides the canvas, and shows the menu again.
7. If a player disconnects, the client removes it from local state via `playerDisconnect`.

## Core engine rules

- World: `3000 x 3000` (from `gameConfig.bounds`).
- Target food count: `250` entities (auto-replenished).
- Player initial size: `24`.
- Speed: decreases as size grows (with a configurable minimum).
- Player-vs-player consume rule: requires size advantage (`gameConfig.player.eatMultiplier`).

## Message protocol

Client -> server:
- `join { name, color }`
- `move { targetX, targetY }`
- `ping { timestamp }`

Server -> client:
- `joinAck { playerId, bounds, state }`
- `gameState { tick, timestamp, bounds, state }`
- `playerDead { playerId, killerId, killerName, killerColor }`
- `playerDisconnect { playerId }`
- `pong { timestamp, serverTime }`
- `error { message }`

## Run locally

Requirements:
- Node.js 20+ recommended
- TLS certificate and key files (required, WSS-only)

Install:

```bash
npm install
```

TypeScript build:

```bash
npm run build
```

Set TLS environment variables before starting the server:

PowerShell:

```powershell
$env:TLS_KEY_PATH = "C:\\path\\to\\localhost-key.pem"
$env:TLS_CERT_PATH = "C:\\path\\to\\localhost-cert.pem"
```

Start compiled server:

```bash
npm run start
```

Development mode (no manual build):

```bash
npm run dev
```

Open in browser:
- `https://localhost:3000`

Useful endpoint:
- `GET /health` -> basic server status (`ok`, player count, current tick), available at `https://localhost:3000/health`.

## Notes

- The server is authoritative: the real game state lives in the backend and the client only renders snapshots.
- The app is WSS-only: if TLS vars are missing or the page is opened over HTTP, the game connection is intentionally blocked.
- The client is split into small modules (`network`, `state`, `render`, `ui`, `utils`) to keep responsibilities isolated.
- The client currently sends `move` on every `mousemove`; for scaling, throttling/rate limiting is recommended.

