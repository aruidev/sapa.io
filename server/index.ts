import express from "express";
import { readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";

import { GameEngine } from "./game.js";
import { GameLoopCoordinator } from "./game-loop.js";
import { ClientMessageParser, MessageRouter } from "./message-handler.js";
import { SessionManager } from "./session-manager.js";
import { PlayerDisconnectMessage } from "./types.js";

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
  // If TLS is not being used, create and return a standard HTTP server using the Express app. This allows the server to handle incoming HTTP requests without encryption, which is suitable for local development or environments where TLS is not required.
  if (!useTls) {
    return createHttpServer(app);
  }

  // Attempt to read TLS credentials and create an HTTPS server. If the credentials cannot be loaded, an error is thrown with details about the failure.
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
const sessions = new SessionManager();
const messageRouter = new MessageRouter(engine, sessions);
const gameLoop = new GameLoopCoordinator(engine, sessions, TICK_INTERVAL_MS);

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
  sessions.register(socket);

  socket.on("message", (rawData) => {
    const message = ClientMessageParser.parse(rawData.toString());
    if (!message) {
      sessions.send(socket, {
        type: "error",
        message: "Invalid message payload.",
      });
      return;
    }

    if (!sessions.has(socket)) {
      return;
    }

    messageRouter.handle(socket, message);
  });

  socket.on("close", () => {
    handleDisconnect(socket);
  });

  socket.on("error", () => {
    handleDisconnect(socket);
  });
});

gameLoop.start();

server.listen(PORT, HOST, () => {
  const protocol = useTls ? "https" : "http";
  const wsProtocol = useTls ? "wss" : "ws";
  console.log(`Server listening on ${protocol}://${HOST}:${PORT}`);
  console.log(`WebSocket endpoint ${wsProtocol}://${HOST}:${PORT}/game`);
});

/**
 * Handles the disconnection of a client by unregistering their session, removing them from the game engine, and broadcasting a player disconnect message to all remaining clients.
 * @param socket WebSocket - The WebSocket connection of the client that has disconnected.
 * @returns void
 */
function handleDisconnect(socket: WebSocket): void {
  const playerId = sessions.unregister(socket);
  if (!playerId) {
    return;
  }

  engine.removePlayer(playerId);
  const disconnectMsg: PlayerDisconnectMessage = {
    type: "playerDisconnect",
    playerId,
  };
  sessions.broadcast(disconnectMsg);
}
