import { WebSocket } from "ws";

import { ServerMessage } from "./types.js";

interface Session {
  playerId: string | null;
}

export class SessionManager {
  private readonly sessions = new Map<WebSocket, Session>();

  /**
   * Registers a new WebSocket connection by creating a session for it with a null player ID. This method should be called when a client first connects to the server to initialize their session state.
   * @param socket WebSocket - The WebSocket connection of the client that has connected.
   * @returns void
   */
  register(socket: WebSocket): void {
    this.sessions.set(socket, { playerId: null });
  }

  /**
   * Unregisters a WebSocket connection by removing its session and returning the associated player ID.
   * @param socket WebSocket - The WebSocket connection to unregister.
   * @returns string | null - The player ID associated with the session, or null if no player is associated.
   */
  unregister(socket: WebSocket): string | null {
    const playerId = this.sessions.get(socket)?.playerId ?? null;
    this.sessions.delete(socket);
    return playerId;
  }

  /**
   * Sets the player ID for a given WebSocket connection.
   * @param socket WebSocket - The WebSocket connection for which to set the player ID.
   * @param playerId string - The player ID to associate with the session.
   * @returns boolean - True if the player ID was successfully set, false otherwise.
   */
  setPlayerId(socket: WebSocket, playerId: string): boolean {
    const session = this.sessions.get(socket);
    if (!session) {
      return false;
    }

    session.playerId = playerId;
    return true;
  }

  /**
   * Retrieves the player ID associated with a given WebSocket connection.
   * @param socket WebSocket - The WebSocket connection for which to retrieve the player ID.
   * @returns string | null - The player ID associated with the session, or null if no player is associated or if the session does not exist.
   */
  getPlayerId(socket: WebSocket): string | null {
    return this.sessions.get(socket)?.playerId ?? null;
  }

  /**
   * Checks if a given WebSocket connection has an associated session in the session manager.
   * @param socket WebSocket - The WebSocket connection to check for an associated session.
   * @returns boolean - True if the session manager has a session for the given WebSocket connection, false otherwise.
   */
  has(socket: WebSocket): boolean {
    return this.sessions.has(socket);
  }

  /**
   * Finds the WebSocket connection associated with a given player ID by iterating through the sessions and checking for a matching player ID. This is useful for sending targeted messages to specific players based on their unique identifiers.
   * @param playerId string - The player ID for which to find the associated WebSocket connection.
   * @returns WebSocket | null - The WebSocket connection associated with the player ID, or null if no such connection exists.
   */
  findSocketByPlayerId(playerId: string): WebSocket | null {
    for (const [socket, session] of this.sessions.entries()) {
      if (session.playerId === playerId) {
        return socket;
      }
    }

    return null;
  }

  /**
   * Broadcasts a message to all connected clients by iterating through the sessions and sending the message to each WebSocket connection that is currently open. The message is serialized to JSON format before being sent. This method is useful for sending game state updates or notifications to all players simultaneously.
   * @param message ServerMessage - The message to broadcast.
   * @return void
   */
  broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const socket of this.sessions.keys()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  /**
   * Sends a message to a specific WebSocket connection if it is open. The message is serialized to JSON format before being sent. This method is useful for sending targeted messages to individual players, such as join acknowledgments or notifications about their elimination.
   * @param socket WebSocket - The WebSocket connection to which the message should be sent.
   * @param message ServerMessage - The message to send to the specified WebSocket connection.
   * @returns void
   */
  send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(message));
  }
}
