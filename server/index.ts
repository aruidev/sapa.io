import express from "express";
import { createServer } from "node:http";
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

const PORT = Number(process.env.PORT ?? 3000);
const TICK_RATE = 30;
const TICK_INTERVAL_MS = 1000 / TICK_RATE;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/game" });
const engine = new GameEngine();

const sessions = new Map<WebSocket, { playerId: string | null }>();

app.use("/client", express.static(path.join(projectRoot, "client")));
app.use("/dist", express.static(path.join(projectRoot, "dist")));

app.get("/", (_req, res) => {
	res.sendFile(path.join(projectRoot, "client", "index.html"));
});

app.get("/health", (_req, res) => {
	res.json({ ok: true, players: engine.getState().players.length, tick: engine.getTick() });
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
			engine.addPlayer(playerId);
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
			engine.setPlayerTarget(session.playerId, moveMessage.targetX, moveMessage.targetY);
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

	engine.update(deltaMs);

	const payload: GameStateMessage = {
		type: "gameState",
		tick: engine.getTick(),
		timestamp: now,
		bounds: engine.getBounds(),
		state: engine.getState(),
	};
	broadcast(payload);
}, TICK_INTERVAL_MS);

server.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
	console.log(`WebSocket endpoint ws://localhost:${PORT}/game`);
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
		return { type: "join" };
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

function createId(prefix: string): string {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
