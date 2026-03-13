import { WebSocket } from "ws";

import { GameEngine } from "./game.js";
import {
  ClientMessage,
  JoinAckMessage,
  MoveMessage,
  PongMessage,
} from "./types.js";
import { createId } from "./utils.js";
import { SessionManager } from "./session-manager.js";

const DEFAULT_PLAYER_NAME = "Jugador";
const DEFAULT_PLAYER_COLOR = "#2ec4b6";

export class ClientMessageParser {
  static parse(raw: string): ClientMessage | null {
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
      const name =
        typeof parsed.name === "string" ? parsed.name : DEFAULT_PLAYER_NAME;
      const color =
        typeof parsed.color === "string" ? parsed.color : DEFAULT_PLAYER_COLOR;
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
}

export class MessageRouter {
  constructor(
    private readonly engine: GameEngine,
    private readonly sessions: SessionManager,
  ) {}

  /**
   * Handles incoming messages from clients by parsing the message, validating the player's session, and routing the message to the appropriate handler based on its type (join, move, ping). The method ensures that players must join before sending other types of messages and provides error responses for invalid actions.
   * @param socket WebSocket - The WebSocket connection of the client sending the message.
   * @param message ClientMessage - The parsed message from the client.
   * @returns void
   */
  handle(socket: WebSocket, message: ClientMessage): void {
    if (message.type === "join") {
      this.handleJoin(socket, message.name, message.color);
      return;
    }

    const playerId = this.sessions.getPlayerId(socket);
    if (!playerId) {
      this.sessions.send(socket, {
        type: "error",
        message: "Send a join message first.",
      });
      return;
    }

    if (message.type === "move") {
      this.handleMove(playerId, message);
      return;
    }

    this.handlePing(socket, message);
  }

  /**
   * Handles a join message from a client by validating the player's session, creating a new player in the game engine with the provided name and color, associating the player's ID with their WebSocket session, and sending a join acknowledgment message back to the client containing their assigned player ID, the game world bounds, and the current game state.
   * @param socket WebSocket - The WebSocket connection of the client sending the join message.
   * @param name string - The display name of the player joining the game, which is included in the join message payload.
   * @param color string - The color representing the player in the game, which is included in the join message payload.
   * @returns void
   */
  private handleJoin(socket: WebSocket, name: string, color: string): void {
    if (this.sessions.getPlayerId(socket)) {
      this.sessions.send(socket, {
        type: "error",
        message: "Player already joined.",
      });
      return;
    }

    const playerId = createId("player");
    this.engine.addPlayer(playerId, name, color);
    this.sessions.setPlayerId(socket, playerId);

    const joinAck: JoinAckMessage = {
      type: "joinAck",
      playerId,
      bounds: this.engine.getBounds(),
      state: this.engine.getState(),
    };
    this.sessions.send(socket, joinAck);
  }

  /**
   * Handles a move message from a client by updating the target position of the corresponding player in the game engine based on the coordinates provided in the move message. This allows the game loop to move the player towards the specified target position during the next update cycle.
   * @param playerId string - The unique identifier of the player whose target position is being updated, which is determined from the client's WebSocket session.
   * @param message MoveMessage - The move message containing the target coordinates (targetX and targetY) that the player wants to move towards.
   * @returns void
   */
  private handleMove(playerId: string, message: MoveMessage): void {
    this.engine.setPlayerTarget(playerId, message.targetX, message.targetY);
  }

  private handlePing(socket: WebSocket, message: { timestamp: number }): void {
    const pong: PongMessage = {
      type: "pong",
      timestamp: message.timestamp,
      serverTime: Date.now(),
    };
    this.sessions.send(socket, pong);
  }
}

/**
 * Type guard function to check if a value is a non-null object (Record<string, unknown>). This is used to validate the structure of parsed JSON messages before accessing their properties.
 * @param value unknown - The value to check.
 * @returns boolean - True if the value is a non-null object, false otherwise.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
