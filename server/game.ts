import { Food, GameState, Player, WorldBounds } from "./types.js";
import { createId } from "./utils.js";

interface PlayerTarget {
	x: number;
	y: number;
}

const DEFAULT_BOUNDS: WorldBounds = {
	width: 3000,
	height: 3000,
};

const FOOD_TARGET_COUNT = 250;
const FOOD_SIZE_MIN = 3;
const FOOD_SIZE_MAX = 7;
const PLAYER_INITIAL_SIZE = 24;
const BASE_PLAYER_SPEED = 320;
const MIN_PLAYER_SPEED = 70;
const PLAYER_EAT_MULTIPLIER = 1.12;
const MAX_RESPAWN_ATTEMPTS = 20;

const FOOD_COLORS = ["#8bd450", "#f0d95c", "#63d2ff", "#ff8fb1", "#ffb347"];
const PLAYER_COLORS = ["#2ec4b6", "#f25f5c", "#ffe066", "#247ba0", "#70c1b3"];

export class GameEngine {
	private readonly players = new Map<string, Player>();
	private readonly food = new Map<string, Food>();
	private readonly playerTargets = new Map<string, PlayerTarget>();
	private tick = 0;

	constructor(private readonly bounds: WorldBounds = DEFAULT_BOUNDS) {
		this.replenishFood();
	}

	getBounds(): WorldBounds {
		return { ...this.bounds };
	}

	getTick(): number {
		return this.tick;
	}

	addPlayer(id: string): Player {
		const spawn = this.findSpawnPoint(PLAYER_INITIAL_SIZE);
		const player: Player = {
			id,
			x: spawn.x,
			y: spawn.y,
			size: PLAYER_INITIAL_SIZE,
			color: pickRandom(PLAYER_COLORS),
		};

		this.players.set(id, player);
		this.playerTargets.set(id, { x: player.x, y: player.y });
		return { ...player };
	}

	removePlayer(id: string): boolean {
		this.playerTargets.delete(id);
		return this.players.delete(id);
	}

	setPlayerTarget(id: string, targetX: number, targetY: number): void {
		if (!this.players.has(id)) {
			return;
		}

		this.playerTargets.set(id, {
			x: clamp(targetX, 0, this.bounds.width),
			y: clamp(targetY, 0, this.bounds.height),
		});
	}

	update(deltaMs: number): void {
		this.tick += 1;
		const deltaSeconds = Math.max(0, deltaMs / 1000);

		this.movePlayers(deltaSeconds);
		this.resolveFoodCollisions();
		this.resolvePlayerCollisions();
		this.replenishFood();
	}

	getState(): GameState {
		return {
			players: [...this.players.values()].map((player) => ({ ...player })),
			food: [...this.food.values()].map((item) => ({ ...item })),
		};
	}

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
				MIN_PLAYER_SPEED,
				BASE_PLAYER_SPEED / Math.sqrt(player.size / PLAYER_INITIAL_SIZE),
			);
			const maxTravel = speed * deltaSeconds;
			const ratio = Math.min(1, maxTravel / distance);

			player.x = clamp(player.x + dx * ratio, player.size, this.bounds.width - player.size);
			player.y = clamp(player.y + dy * ratio, player.size, this.bounds.height - player.size);
		}
	}

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

	private resolvePlayerCollisions(): void {
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

				if (eater.size < prey.size * PLAYER_EAT_MULTIPLIER) {
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
	}

	private replenishFood(): void {
		while (this.food.size < FOOD_TARGET_COUNT) {
			const size = randomBetween(FOOD_SIZE_MIN, FOOD_SIZE_MAX);
			const position = this.findSpawnPoint(size);
			const item: Food = {
				id: createId("food"),
				x: position.x,
				y: position.y,
				size,
				color: pickRandom(FOOD_COLORS),
			};
			this.food.set(item.id, item);
		}
	}

	private findSpawnPoint(size: number): { x: number; y: number } {
		for (let attempts = 0; attempts < MAX_RESPAWN_ATTEMPTS; attempts += 1) {
			const x = randomBetween(size, this.bounds.width - size);
			const y = randomBetween(size, this.bounds.height - size);

			const overlappingPlayer = [...this.players.values()].some(
				(player) => distanceBetween(x, y, player.x, player.y) < player.size + size + 12,
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

function canConsume(a: { x: number; y: number; size: number }, b: { x: number; y: number; size: number }): boolean {
	const distance = distanceBetween(a.x, a.y, b.x, b.y);
	return distance <= Math.max(0, a.size - b.size * 0.3);
}

function growRadius(currentSize: number, eatenSize: number): number {
	return Math.sqrt(currentSize ** 2 + eatenSize ** 2);
}

function distanceBetween(ax: number, ay: number, bx: number, by: number): number {
	return Math.hypot(ax - bx, ay - by);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function randomBetween(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function pickRandom<T>(values: T[]): T {
	return values[Math.floor(Math.random() * values.length)] as T;
}
