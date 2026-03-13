// main.ts
// Main entry point for the client application, handling WebSocket communication, game state management, rendering, and user input for controlling the player character. 
// It sets up the canvas, manages the game loop, and processes messages from the server to update the game state accordingly. 
// It also includes event listeners for resizing the canvas and handling mouse movement to control player movement in the game world.

import type { ServerMessage, Player } from "../server/types.js";
import { connectAndJoin, ws } from "./utils/network.js";
import {
  bounds,
  applySnapshot,
  getLocalPlayer,
  setMyPlayerId,
  removePlayerById,
  resetState,
} from "./utils/state.js";
import { draw } from "./utils/render.js";
import { setupUI } from "./utils/ui.js";
import { clamp, screenToWorld } from "./utils/utils.js";

type PlayerDeadMessage = {
  type: "playerDead";
  playerId: string;
};

type IncomingMessage = ServerMessage | PlayerDeadMessage;

if (window.location.protocol !== "https:") {
  throw new Error("This app requires HTTPS. WebSocket transport is WSS-only.");
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderingContext = canvas.getContext("2d");

if (!renderingContext) {
  throw new Error("2D rendering context is not available.");
}

const ctx = renderingContext;
const menu = document.getElementById("menu") as HTMLDivElement;

/**
 * Function to resize the canvas to fill the entire browser window.
 */
function resizeCanvas(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

/**
 * Function to calculate the camera position based on the local player's position, ensuring the camera stays within world bounds.
 * @param me the local player object to center the camera on
 * @returns the x and y coordinates for the camera position
 */

function getCameraPosition(me: Player | undefined): { x: number; y: number } {
  if (!me) {
    return { x: 0, y: 0 };
  }

  const halfWidth = canvas.width / 2;
  const halfHeight = canvas.height / 2;

  return {
    x: clamp(me.x - halfWidth, 0, Math.max(0, bounds.width - canvas.width)),
    y: clamp(me.y - halfHeight, 0, Math.max(0, bounds.height - canvas.height)),
  };
}

/**
 * Function to handle incoming messages from the server.
 * Updating the local game state based on the message type (e.g., join acknowledgment, game state updates, player disconnections, and player deaths). 
 * It also handles errors by logging them to the console.
 * @param data incoming message data from the server
 * @returns void
 */
function handleServerMessage(data: IncomingMessage): void {
  if (data.type === "joinAck") {
    setMyPlayerId(data.playerId);
    applySnapshot(data.state, data.bounds);
    return;
  }

  if (data.type === "gameState") {
    applySnapshot(data.state, data.bounds);
    return;
  }

  if (data.type === "playerDisconnect") {
    removePlayerById(data.playerId);
    return;
  }

  if (data.type === "playerDead") {
    ws?.close();
    resetState();
    canvas.style.display = "none";
    menu.style.display = "flex";
    alert("¡Has muerto! Puedes elegir nombre y color para volver a jugar.");
    return;
  }

  if (data.type === "error") {
    console.error("Server error:", data.message);
  }
}

// Set up the user interface and start the game loop
setupUI((name: string, color: string) => {
  connectAndJoin(name, color, handleServerMessage);
});

// Initial canvas setup and event listeners
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

/**
 * Function to continuously render the game state on the canvas using requestAnimationFrame for smooth animations. 
 */
function renderLoop(): void {
  draw(ctx, canvas);
  requestAnimationFrame(renderLoop);
}
renderLoop();

canvas.addEventListener("mousemove", (event: MouseEvent) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  const me = getLocalPlayer();
  const camera = getCameraPosition(me);
  const worldTarget = screenToWorld(event.clientX, event.clientY, camera, bounds);

  ws.send(
    JSON.stringify({
      type: "move",
      targetX: worldTarget.x,
      targetY: worldTarget.y,
    }),
  );
});