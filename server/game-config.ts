import { WorldBounds } from "./types.js";

const bounds: WorldBounds = {
  width: 3000,
  height: 3000,
};

export const gameConfig = {
  bounds,
  food: {
    targetCount: 250,
    sizeMin: 3,
    sizeMax: 7,
    colors: ["#8bd450", "#f0d95c", "#63d2ff", "#ff8fb1", "#ffb347"],
  },
  player: {
    initialSize: 24,
    baseSpeed: 320,
    minSpeed: 70,
    eatMultiplier: 1.12,
  },
  spawn: {
    maxRespawnAttempts: 20,
  },
};