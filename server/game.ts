import { gameConfig } from "./game-config.js";
import {
  canConsume,
  clamp,
  distanceBetween,
  growRadius,
  pickRandom,
  randomBetween,
} from "./game-physics.js";
import { Food, GameState, Player, WorldBounds } from "./types.js";
import { createId } from "./utils.js";

interface PlayerTarget {
  x: number;
  y: number;
}

export class GameEngine {
  private readonly players = new Map<string, Player>();
  private readonly food = new Map<string, Food>();
  private readonly playerTargets = new Map<string, PlayerTarget>();
  private tick = 0;

  constructor(private readonly bounds: WorldBounds = gameConfig.bounds) {
    this.replenishFood();
  }

  /**
   * Gets the boundaries of the game world.
   * @returns The world boundaries.
   */
  getBounds(): WorldBounds {
    return { ...this.bounds };
  }

  /**
   * Gets the current tick count (number of game updates that have occurred).
   * @returns number - The current tick count.
   */
  getTick(): number {
    return this.tick;
  }

  /**
   * Adds a new player to the game with the specified ID, name, and color. The player is spawned at a random location that does not overlap with existing players. The player's initial size is determined by the game configuration. The method returns the newly created player object.
   * @param id string - The unique identifier for the player.
   * @param name string - The display name of the player.
   * @param color string - The color representing the player in the game.
   * @returns Player - The newly created player object with its initial properties set.
   */
  addPlayer(id: string, name: string, color: string): Player {
    const spawn = this.findSpawnPoint(gameConfig.player.initialSize);
    const player: Player = {
      id,
      x: spawn.x,
      y: spawn.y,
      size: gameConfig.player.initialSize,
      color,
      name,
    };

    this.players.set(id, player);
    this.playerTargets.set(id, { x: player.x, y: player.y });
    return { ...player };
  }

  /**
   * Removes a player from the game based on their unique identifier. This method deletes the player's data from the internal storage and also removes any target information associated with that player. It returns a boolean value indicating whether the player was successfully removed (true) or if the player was not found (false).
   * @param id string - The unique identifier of the player to be removed.
   * @returns boolean - True if the player was successfully removed, false if the player was not found.
   */
  removePlayer(id: string): boolean {
    this.playerTargets.delete(id);
    return this.players.delete(id);
  }

  /**
   * Sets the target position for a player based on their unique identifier.
   * @param id string - The unique identifier of the player.
   * @param targetX number - The x-coordinate of the target position.
   * @param targetY number - The y-coordinate of the target position.
   * @returns void
   */
  setPlayerTarget(id: string, targetX: number, targetY: number): void {
    if (!this.players.has(id)) {
      return;
    }

    this.playerTargets.set(id, {
      x: clamp(targetX, 0, this.bounds.width),
      y: clamp(targetY, 0, this.bounds.height),
    });
  }

  /**
   * Updates the game state based on the elapsed time.
   * @param deltaMs number - The elapsed time in milliseconds.
   * @returns string[] - An array of player IDs that were eliminated.
   */
  update(deltaMs: number): string[] {
    this.tick += 1;
    const deltaSeconds = Math.max(0, deltaMs / 1000);

    this.movePlayers(deltaSeconds);
    this.resolveFoodCollisions();
    const eliminated = this.resolvePlayerCollisions();
    this.replenishFood();
    return eliminated;
  }

  /**
   * Gets the current state of the game.
   * @returns GameState - The current game state.
   */
  getState(): GameState {
    return {
      players: [...this.players.values()].map((player) => ({ ...player })),
      food: [...this.food.values()].map((item) => ({ ...item })),
    };
  }

  /**
   * Moves all players towards their respective target positions based on their speed and the elapsed time since the last update. The speed of each player is determined by the game configuration and is affected by the player's size (larger players move slower). The method ensures that players do not move outside the boundaries of the game world.
   * @param deltaSeconds number - The elapsed time in seconds since the last update.
   * @returns void
   */
  private movePlayers(deltaSeconds: number): void {
    for (const player of this.players.values()) {
      const target = this.playerTargets.get(player.id);
      if (!target) {
        continue;
      }

      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 0.0001) {
        continue;
      }

      const speed = Math.max(
        gameConfig.player.minSpeed,
        gameConfig.player.baseSpeed /
          Math.sqrt(player.size / gameConfig.player.initialSize),
      );
      const maxTravel = speed * deltaSeconds;
      const ratio = Math.min(1, maxTravel / distance);

      player.x = clamp(
        player.x + dx * ratio,
        player.size,
        this.bounds.width - player.size,
      );
      player.y = clamp(
        player.y + dy * ratio,
        player.size,
        this.bounds.height - player.size,
      );
    }
  }

  /**
   * Resolves collisions between players and food items. If a player can consume a food item (determined by the canConsume function), the player's size is increased based on the growRadius function, and the food item is removed from the game. This method iterates through all players and food items to check for collisions and applies the necessary updates to the game state.
   * @returns void
   */
  private resolveFoodCollisions(): void {
    for (const player of this.players.values()) {
      for (const foodItem of this.food.values()) {
        if (!canConsume(player, foodItem)) {
          continue;
        }

        player.size = growRadius(player.size, foodItem.size);
        this.food.delete(foodItem.id);
      }
    }
  }

  /**
   * Resolves collisions between players. If a player is large enough to consume another player, the larger player's size is increased and the smaller player is eliminated.
   * @returns string[] - An array of player IDs that were eliminated.
   */
  private resolvePlayerCollisions(): string[] {
    const players = [...this.players.values()];
    const consumed = new Set<string>();

    for (let i = 0; i < players.length; i += 1) {
      const a = players[i];
      if (!a || consumed.has(a.id)) {
        continue;
      }

      for (let j = i + 1; j < players.length; j += 1) {
        const b = players[j];
        if (!b || consumed.has(b.id)) {
          continue;
        }

        const eater = a.size >= b.size ? a : b;
        const prey = eater.id === a.id ? b : a;

        if (eater.size < prey.size * gameConfig.player.eatMultiplier) {
          continue;
        }

        if (!canConsume(eater, prey)) {
          continue;
        }

        eater.size = growRadius(eater.size, prey.size * 0.85);
        consumed.add(prey.id);
      }
    }

    for (const playerId of consumed) {
      this.players.delete(playerId);
      this.playerTargets.delete(playerId);
    }
    return Array.from(consumed);
  }

  /**
   * Replenishes the food supply in the game world.
   * @returns void
   */
  private replenishFood(): void {
    while (this.food.size < gameConfig.food.targetCount) {
      const size = randomBetween(gameConfig.food.sizeMin, gameConfig.food.sizeMax);
      const position = this.findSpawnPoint(size);
      const item: Food = {
        id: createId("food"),
        x: position.x,
        y: position.y,
        size,
        color: pickRandom(gameConfig.food.colors),
      };
      this.food.set(item.id, item);
    }
  }

  /**
   * Finds a valid spawn point for a new food item, ensuring it does not overlap with any existing players.
   * @param size number - The size of the food item to be spawned, which is used to determine the minimum distance from players to avoid overlap. 
   * @returns { x: number; y: number } - The coordinates of the valid spawn point.
   */
  private findSpawnPoint(size: number): { x: number; y: number } {
    for (let attempts = 0; attempts < gameConfig.spawn.maxRespawnAttempts; attempts += 1) {
      const x = randomBetween(size, this.bounds.width - size);
      const y = randomBetween(size, this.bounds.height - size);

      const overlappingPlayer = [...this.players.values()].some(
        (player) =>
          distanceBetween(x, y, player.x, player.y) < player.size + size + 12,
      );

      if (!overlappingPlayer) {
        return { x, y };
      }
    }

    return {
      x: randomBetween(size, this.bounds.width - size),
      y: randomBetween(size, this.bounds.height - size),
    };
  }
}
