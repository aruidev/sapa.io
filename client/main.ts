import type {
  Food,
  GameState,
  Player,
  ServerMessage,
  WorldBounds,
} from "../server/types.js";

if (window.location.protocol !== "https:") {
  throw new Error("This app requires HTTPS. WebSocket transport is WSS-only.");
}

const ws = new WebSocket(`wss://${window.location.host}/game`);

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderingContext = canvas.getContext("2d");

if (!renderingContext) {
  throw new Error("2D rendering context is not available.");
}

const ctx = renderingContext;
const TWO_PI = Math.PI * 2;

let players: Player[] = [];
let food: Food[] = [];
let bounds: WorldBounds = { width: 3000, height: 3000 };
let myPlayerId: string | null = null;

function applySnapshot(state: GameState, worldBounds: WorldBounds): void {
  players = state.players;
  food = state.food;
  bounds = worldBounds;
}

// --- Menú de inicio ---
const menu = document.getElementById("menu") as HTMLDivElement;
const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const playerNameInput = document.getElementById("playerName") as HTMLInputElement;
const playerColorInput = document.getElementById("playerColor") as HTMLInputElement;

let gameStarted = false;

startBtn.addEventListener("click", () => {
  alert("¡Bienvenido a Agar.io! Usa el mouse para moverte. Come la comida y otros jugadores para crecer. ¡Diviértete!");
  const name = playerNameInput.value.trim() || "Jugador";
  const color = playerColorInput.value;
  // Enviar datos al servidor
  ws.send(
    JSON.stringify({
      type: "join",
      name,
      color,
    })
  );
  // Ocultar menú y mostrar canvas
  menu.style.display = "none";
  canvas.style.display = "block";
  gameStarted = true;
});

// Al cargar, mostrar menú y ocultar canvas
window.addEventListener("DOMContentLoaded", () => {
  menu.style.display = "flex";
  canvas.style.display = "none";
});
function resizeCanvas(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

ws.addEventListener("open", () => {
  ws.send(JSON.stringify({ type: "join" }));
});

ws.addEventListener("message", (event) => {
  const data = JSON.parse(event.data) as ServerMessage;

  if (data.type === "joinAck") {
    myPlayerId = data.playerId;
    applySnapshot(data.state, data.bounds);
    return;
  }

  if (data.type === "gameState") {
    applySnapshot(data.state, data.bounds);
    return;
  }

  if (data.type === "playerDisconnect") {
    players = players.filter((player) => player.id !== data.playerId);
    if (data.playerId === myPlayerId) {
      myPlayerId = null;
    }
    return;
  }

  if (data.type === "error") {
    console.error("Server error:", data.message);
  }
});

ws.addEventListener("close", () => {
  console.warn("WebSocket connection closed.");
});

ws.addEventListener("error", (event) => {
  console.error("WebSocket error:", event);
});

function draw(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const me = getLocalPlayer();
  const camera = getCameraPosition(me);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  drawWorldBackground();
  drawFood();
  drawPlayers();

  ctx.restore();

  drawHud(me);

  requestAnimationFrame(draw);
}

function drawWorldBackground(): void {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, bounds.width, bounds.height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, bounds.width, bounds.height);
}

function drawFood(): void {
  for (const item of food) {
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.size, 0, TWO_PI);
    ctx.fillStyle = item.color;
    ctx.fill();
  }
}

function drawPlayers(): void {
  for (const player of players) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size, 0, TWO_PI);
    ctx.fillStyle = player.color || "lime";
    ctx.fill();

    if (player.id === myPlayerId) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
  }
}

function drawHud(me: Player | undefined): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(12, 12, 190, 50);

  ctx.fillStyle = "#ffffff";
  ctx.font = "16px monospace";
  const sizeText = me ? me.size.toFixed(1) : "--";
  ctx.fillText(`Size: ${sizeText}`, 22, 33);
  ctx.fillText(`Players: ${players.length}`, 22, 53);
}

function getLocalPlayer(): Player | undefined {
  if (!myPlayerId) {
    return undefined;
  }

  return players.find((player) => player.id === myPlayerId);
}

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

function screenToWorld(
  screenX: number,
  screenY: number,
): { x: number; y: number } {
  const camera = getCameraPosition(getLocalPlayer());
  return {
    x: clamp(screenX + camera.x, 0, bounds.width),
    y: clamp(screenY + camera.y, 0, bounds.height),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

draw();

canvas.addEventListener("mousemove", (event) => {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }

  const worldTarget = screenToWorld(event.clientX, event.clientY);

  ws.send(
    JSON.stringify({
      type: "move",
      targetX: worldTarget.x,
      targetY: worldTarget.y,
    }),
  );
});
