// network.ts
// WebSocket connection and communication with the server

export let ws: WebSocket | null = null;

/**
 * Function to connect to the WebSocket server and join the game
 * @param name Name of the player
 * @param color Color of the player
 * @param onMessage Callback to handle incoming messages from the server
 */
export function connectAndJoin(
  name: string,
  color: string,
  onMessage: (data: any) => void,
) {
  ws = new WebSocket(`wss://${window.location.host}/game`);

  ws.addEventListener("open", () => {
    ws!.send(JSON.stringify({ type: "join", name, color }));
  });

  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  });

  ws.addEventListener("close", () => {
    console.warn("WebSocket connection closed.");
  });

  ws.addEventListener("error", (event) => {
    console.error("WebSocket error:", event);
  });
}
