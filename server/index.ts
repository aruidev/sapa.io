import express from "express";
import { readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";

import { GameEngine } from "./game.js";
import {
  ClientMessage,
  ErrorMessage,
  GameStateMessage,
  JoinAckMessage,
  MoveMessage,
  PlayerDisconnectMessage,
  PongMessage,
  ServerMessage,
} from "./types.js";
import { createId } from "./utils.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const TICK_RATE = 30;
const TICK_INTERVAL_MS = 1000 / TICK_RATE;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

const tlsKeyPath = process.env.TLS_KEY_PATH;
const tlsCertPath = process.env.TLS_CERT_PATH;
const isRender = Boolean(process.env.RENDER);
const useTls = !isRender && Boolean(tlsKeyPath && tlsCertPath);

const app = express();
const server = (() => {
  if (!useTls) {
    return createHttpServer(app);
  }

  try {
    const tlsKey = readFileSync(tlsKeyPath as string);
    const tlsCert = readFileSync(tlsCertPath as string);
    return createServer({ key: tlsKey, cert: tlsCert }, app);
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unknown file read error";
    throw new Error(`Failed to load TLS credentials: ${details}`);
  }
})();
const wss = new WebSocketServer({ server, path: "/game" });
const engine = new GameEngine();

const sessions = new Map<WebSocket, { playerId: string | null }>();

app.use("/client", express.static(path.join(projectRoot, "client")));
app.use("/dist", express.static(path.join(projectRoot, "dist")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(projectRoot, "client", "index.html"));
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    players: engine.getState().players.length,
    tick: engine.getTick(),
  });
});

wss.on("connection", (socket) => {
  sessions.set(socket, { playerId: null });

  socket.on("message", (rawData) => {
    const message = parseClientMessage(rawData.toString());
    if (!message) {
      send(socket, { type: "error", message: "Invalid message payload." });
      return;
    }

    const session = sessions.get(socket);
    if (!session) {
      return;
    }

    if (message.type === "join") {
      if (session.playerId) {
        send(socket, { type: "error", message: "Player already joined." });
        return;
      }

      const playerId = createId("player");
      const name = typeof message.name === "string" ? message.name : "Jugador";
      const color =
        typeof message.color === "string" ? message.color : "#2ec4b6";
      engine.addPlayer(playerId, name, color);
      session.playerId = playerId;

      const joinAck: JoinAckMessage = {
        type: "joinAck",
        playerId,
        bounds: engine.getBounds(),
        state: engine.getState(),
      };
      send(socket, joinAck);
      return;
    }

    if (!session.playerId) {
      send(socket, { type: "error", message: "Send a join message first." });
      return;
    }

    if (message.type === "move") {
      const moveMessage = message as MoveMessage;
      engine.setPlayerTarget(
        session.playerId,
        moveMessage.targetX,
        moveMessage.targetY,
      );
      return;
    }

    if (message.type === "ping") {
      const pong: PongMessage = {
        type: "pong",
        timestamp: message.timestamp,
        serverTime: Date.now(),
      };
      send(socket, pong);
    }
  });

  socket.on("close", () => {
    handleDisconnect(socket);
  });

  socket.on("error", () => {
    handleDisconnect(socket);
  });
});

let lastTickTime = Date.now();
setInterval(() => {
  const now = Date.now();
  const deltaMs = now - lastTickTime;
  lastTickTime = now;

  const eliminatedIds = engine.update(deltaMs);

  // Notifica a los jugadores eliminados
  for (const id of eliminatedIds) {
    for (const [socket, session] of sessions.entries()) {
      if (session.playerId === id && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "playerDead", playerId: id }));
      }
    }
  }

  const payload: GameStateMessage = {
    type: "gameState",
    tick: engine.getTick(),
    timestamp: now,
    bounds: engine.getBounds(),
    state: engine.getState(),
  };
  broadcast(payload);
}, TICK_INTERVAL_MS);

server.listen(PORT, HOST, () => {
  const protocol = useTls ? "https" : "http";
  const wsProtocol = useTls ? "wss" : "ws";
  console.log(`Server listening on ${protocol}://${HOST}:${PORT}`);
  console.log(`WebSocket endpoint ${wsProtocol}://${HOST}:${PORT}/game`);
});

function handleDisconnect(socket: WebSocket): void {
  const session = sessions.get(socket);
  if (!session) {
    return;
  }

  if (session.playerId) {
    engine.removePlayer(session.playerId);
    const disconnectMsg: PlayerDisconnectMessage = {
      type: "playerDisconnect",
      playerId: session.playerId,
    };
    broadcast(disconnectMsg);
  }

  sessions.delete(socket);
}

function broadcast(message: ServerMessage): void {
  const payload = JSON.stringify(message);
  for (const socket of sessions.keys()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

function send(socket: WebSocket, message: ServerMessage | ErrorMessage): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
}

function parseClientMessage(raw: string): ClientMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    return null;
  }

  if (parsed.type === "join") {
    const name = typeof parsed.name === "string" ? parsed.name : "Jugador";
    const color = typeof parsed.color === "string" ? parsed.color : "#2ec4b6";
    return { type: "join", name, color };
  }

  if (
    parsed.type === "move" &&
    typeof parsed.targetX === "number" &&
    Number.isFinite(parsed.targetX) &&
    typeof parsed.targetY === "number" &&
    Number.isFinite(parsed.targetY)
  ) {
    return { type: "move", targetX: parsed.targetX, targetY: parsed.targetY };
  }

  if (
    parsed.type === "ping" &&
    typeof parsed.timestamp === "number" &&
    Number.isFinite(parsed.timestamp)
  ) {
    return { type: "ping", timestamp: parsed.timestamp };
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
