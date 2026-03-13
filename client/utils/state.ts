// state.ts
// Variables and functions to manage the local game state, including players, food, world bounds, and the local player's ID

import type { Player, Food, WorldBounds } from "../../server/types.js";

export let players: Player[] = [];
export let food: Food[] = [];
export let bounds: WorldBounds = { width: 3000, height: 3000 };
export let myPlayerId: string | null = null;

/**
 * Function to apply a snapshot of the game state received from the server, updating the local players, food, and world bounds.
 * @param state the game state snapshot containing the current players and food arrays
 * @param worldBounds the current world bounds to update the local state with
 */
export function applySnapshot(
  state: { players: Player[]; food: Food[] },
  worldBounds: WorldBounds,
): void {
  players = state.players;
  food = state.food;
  bounds = worldBounds;
}

/**
 * Function to get the local player's information based on the stored player ID, returning undefined if the player is not found or not set.
 * @returns the local player object or undefined if not found
 */
export function getLocalPlayer(): Player | undefined {
  if (!myPlayerId) return undefined;
  return players.find((player) => player.id === myPlayerId);
}

/**
 * Function to set the local player's ID after receiving a join acknowledgment from the server, allowing the client to identify itself in the game state.
 * @param playerId the unique identifier for the local player assigned by the server
 */
export function setMyPlayerId(playerId: string | null): void {
  myPlayerId = playerId;
}

/**
 * Function to remove a player from the local state based on their ID, typically called when a player disconnects or is eliminated from the game.
 * @param playerId the unique identifier of the player to remove from the local state
 */
export function removePlayerById(playerId: string): void {
  players = players.filter((player) => player.id !== playerId);
  if (myPlayerId === playerId) {
    myPlayerId = null;
  }
}

/**
 * Function to reset the entire local game state, clearing all players, food, and resetting world bounds and player ID. This can be used when the local player dies or disconnects to prepare for a new game session.
 */
export function resetState(): void {
  players = [];
  food = [];
  bounds = { width: 3000, height: 3000 };
  myPlayerId = null;
}
