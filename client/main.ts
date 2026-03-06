type Player = {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
};

type Food = {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
};

type WorldBounds = {
  width: number;
  height: number;
};

type GameState = {
  players: Player[];
  food: Food[];
};

type ServerMessage =
  | { type: "joinAck"; playerId: string; bounds: WorldBounds; state: GameState }
  | { type: "gameState"; tick: number; timestamp: number; bounds: WorldBounds; state: GameState }
  | { type: "error"; message: string }
  | { type: "pong"; timestamp: number; serverTime: number }
  | { type: "playerDisconnect"; playerId: string };

const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${wsProtocol}//${window.location.host}/game`);

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderingContext = canvas.getContext("2d");

if (!renderingContext) {
  throw new Error("2D rendering context is not available.");
}

const ctx = renderingContext;

let players: Player[] = [];
let food: Food[] = [];
let bounds: WorldBounds = { width: 3000, height: 3000 };
let myPlayerId: string | null = null;

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
    players = data.state.players;
    food = data.state.food;
    bounds = data.bounds;
    return;
  }

  if (data.type === "gameState") {
    players = data.state.players;
    food = data.state.food;
    bounds = data.bounds;
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
    ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2);
    ctx.fillStyle = item.color;
    ctx.fill();
  }
}

function drawPlayers(): void {
  for (const player of players) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
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

function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
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
