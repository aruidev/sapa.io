// render.ts
// Drawing functions and rendering logic for the game, including drawing the world background, food items, players, and heads-up display (HUD) with player information and total player count. 
// Also includes camera calculations to center the view on the local player while keeping within world bounds.  

import { players, food, bounds, getLocalPlayer } from "./state.js";

/**
 * Function to draw the entire game scene, including the world background, food items, players, and HUD.
 * @param ctx canvas rendering context
 * @param canvas the canvas element to get dimensions for camera calculations
 */
export function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const me = getLocalPlayer();
  const camera = getCameraPosition(me, canvas);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  drawWorldBackground(ctx);
  drawFood(ctx);
  drawPlayers(ctx);

  ctx.restore();

  drawHud(ctx, me, canvas);
}

/**
 * Function to draw the world background, which is a simple dark rectangle with a border.
 * @param ctx canvas rendering context
 */
function drawWorldBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, bounds.width, bounds.height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, bounds.width, bounds.height);
}

/**
 * Function to draw the food items in the game.
 * @param ctx canvas rendering context
 */
function drawFood(ctx: CanvasRenderingContext2D) {
  for (const item of food) {
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2);
    ctx.fillStyle = item.color;
    ctx.fill();
  }
}

/**
 * Function to draw the players in the game, including their circles and colors. 
 * @param ctx canvas rendering context
 */
function drawPlayers(ctx: CanvasRenderingContext2D) {
  for (const player of players) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
    ctx.fillStyle = player.color || "lime";
    ctx.fill();
  }
}

/**
 * Function to draw the heads-up display (HUD) showing the player's size and the total number of players.
 * @param ctx canvas rendering context
 * @param me the local player object to display size information
 * @param canvas the canvas element to get dimensions for positioning the HUD
 */
function drawHud(ctx: CanvasRenderingContext2D, me: any, canvas: HTMLCanvasElement) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(12, 12, 190, 50);
  ctx.fillStyle = "#fff";
  ctx.font = "16px monospace";
  const sizeText = me ? me.size.toFixed(1) : "--";
  ctx.fillText(`Size: ${sizeText}`, 22, 33);
  ctx.fillText(`Players: ${players.length}`, 22, 53);
}

/**
 * Function to calculate the camera position based on the local player's position, ensuring the camera stays within world bounds.
 * @param me the local player object to center the camera on
 * @param canvas the canvas element to get dimensions for calculating the camera offset
 * @returns the x and y coordinates for the camera position
 */
function getCameraPosition(me: any, canvas: HTMLCanvasElement) {
  if (!me) return { x: 0, y: 0 };
  const halfWidth = canvas.width / 2;
  const halfHeight = canvas.height / 2;
  return {
    x: clamp(me.x - halfWidth, 0, Math.max(0, bounds.width - canvas.width)),
    y: clamp(me.y - halfHeight, 0, Math.max(0, bounds.height - canvas.height)),
  };
}

/**
 * Function to clamp a value between a minimum and maximum range, used for keeping the camera within world bounds.
 * @param value the value to clamp
 * @param min the minimum allowed value
 * @param max the maximum allowed value
 * @returns the clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
