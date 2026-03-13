import { GameEngine } from "./game.js";
import { GameStateMessage, Player, PlayerDeadMessage } from "./types.js";
import { SessionManager } from "./session-manager.js";

interface KillerInfo {
  killerId: string | null;
  killerName: string | null;
  killerColor: string | null;
}

export class GameLoopCoordinator {
  private lastTickTime = Date.now();

  constructor(
    private readonly engine: GameEngine,
    private readonly sessions: SessionManager,
    private readonly tickIntervalMs: number,
  ) {}

  start(): void {
    setInterval(() => {
      this.tick();
    }, this.tickIntervalMs);
  }

  /**
   * Calculates the new game state based on the elapsed time since the last tick, notifies players about any eliminations, and broadcasts the updated game state to all connected clients.
   */
  private tick(): void {
    const now = Date.now();
    const deltaMs = now - this.lastTickTime;
    this.lastTickTime = now;

    const eliminatedIds = this.engine.update(deltaMs);
    for (const playerId of eliminatedIds) {
      const killer = this.findKillerInfo(playerId);
      this.notifyPlayerDead(playerId, killer);
    }

    const payload: GameStateMessage = {
      type: "gameState",
      tick: this.engine.getTick(),
      timestamp: now,
      bounds: this.engine.getBounds(),
      state: this.engine.getState(),
    };
    this.sessions.broadcast(payload);
  }

  /**
   * Notifies a specific player that they have been eliminated, including information about the killer if available.
   * @param playerId string - The ID of the eliminated player.
   * @param killer KillerInfo - An object containing information about the killer, or null values if no killer could be determined.
   * @returns void
   */
  private notifyPlayerDead(playerId: string, killer: KillerInfo): void {
    const socket = this.sessions.findSocketByPlayerId(playerId);
    if (!socket) {
      return;
    }

    const message: PlayerDeadMessage = {
      type: "playerDead",
      playerId,
      killerId: killer.killerId,
      killerName: killer.killerName,
      killerColor: killer.killerColor,
    };
    this.sessions.send(socket, message);
  }

  /**
   * Finds information about the killer of a specific player. This is determined by finding the closest player that is larger than the eliminated player at the time of elimination.
   * @param playerId string - The ID of the eliminated player for whom to find killer information.
   * @returns KillerInfo - An object containing information about the killer, or null values if no killer could be determined.
   */
  private findKillerInfo(playerId: string): KillerInfo {
    const state = this.engine.getState();
    const eliminatedPlayer = state.players.find(
      (player) => player.id === playerId,
    );

    if (!eliminatedPlayer) {
      return {
        killerId: null,
        killerName: null,
        killerColor: null,
      };
    }

    let closestKiller: Player | null = null;
    let minDistance = Number.POSITIVE_INFINITY;

    for (const player of state.players) {
      if (player.id === playerId || player.size <= eliminatedPlayer.size) {
        continue;
      }

      const distance = Math.hypot(
        player.x - eliminatedPlayer.x,
        player.y - eliminatedPlayer.y,
      );
      if (distance >= minDistance) {
        continue;
      }

      minDistance = distance;
      closestKiller = player;
    }

    if (!closestKiller) {
      return {
        killerId: null,
        killerName: null,
        killerColor: null,
      } as KillerInfo;
    }

    return {
      killerId: closestKiller.id,
      killerName: closestKiller.name || "",
      killerColor: closestKiller.color || "#2ec4b6",
    } as KillerInfo;
  }
}
