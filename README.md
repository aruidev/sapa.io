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

- `server/index.ts`: HTTP + WebSocket server, sessions, message parsing/validation, tick loop.
- `server/game.ts`: game engine (movement, collisions, growth, food respawn).
- `server/types.ts`: message contracts and shared state types.
- `client/main.ts`: WS connection, snapshot handling, mouse input, canvas rendering.
- `client/index.html`: client entry point.
- `client/styles.css`: base styles.

## How it works (summary)

1. The client opens `ws://localhost:3000/game` (or `wss` over HTTPS).
2. It sends `{ type: "join" }`.
3. The server creates a player and replies with `joinAck` containing `playerId`, `bounds`, and initial state.
4. The client sends `move` messages using mouse target coordinates in world space.
5. The server updates the world at `30 ticks/s` and broadcasts `gameState` to all clients.
6. If a player disconnects, the server emits `playerDisconnect`.

## Core engine rules

- World: `3000 x 3000`.
- Target food count: `250` entities (auto-replenished).
- Player initial size: `24`.
- Speed: decreases as size grows (with a configurable minimum).
- Player-vs-player consume rule: requires size advantage (`PLAYER_EAT_MULTIPLIER`).

## Message protocol

Client -> server:
- `join`
- `move { targetX, targetY }`
- `ping { timestamp }`

Server -> client:
- `joinAck { playerId, bounds, state }`
- `gameState { tick, timestamp, bounds, state }`
- `playerDisconnect { playerId }`
- `pong { timestamp, serverTime }`
- `error { message }`

## Run locally

Requirements:
- Node.js 20+ recommended

Install:

```bash
npm install
```

TypeScript build:

```bash
npm run build
```

Start compiled server:

```bash
npm run node:start
```

Development mode (no manual build):

```bash
npm run node:dev
```

Open in browser:
- `http://localhost:3000`

Useful endpoint:
- `GET /health` -> basic server status (`ok`, player count, current tick).

## Notes

- The server is authoritative: the real game state lives in the backend and the client only renders snapshots.
- The client currently sends `move` on every `mousemove`; for scaling, throttling/rate limiting is recommended.

