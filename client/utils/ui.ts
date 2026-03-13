// ui.ts
// Menu and user interface related functions, such as setting up the main menu and handling user input for joining the game

/**
 * Function to set up the user interface, including the main menu and handling the start button click to connect and join the game.
 * @param connectAndJoin a function that takes the player's name and color to establish a connection and join the game, typically passed from the main application logic
 */
export function setupUI(connectAndJoin: (name: string, color: string) => void) {
  const menu = document.getElementById("menu") as HTMLDivElement;
  const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
  const playerNameInput = document.getElementById(
    "playerName",
  ) as HTMLInputElement;
  const playerColorInput = document.getElementById(
    "playerColor",
  ) as HTMLInputElement;
  const canvas = document.getElementById("game") as HTMLCanvasElement;

  startBtn.addEventListener("click", () => {
    alert(
      "¡Bienvenido a Sapa.io! Usa el mouse para moverte y comer comida para crecer. Evita a otros jugadores más grandes que tú. ¡Diviértete jugando!",
    );
    const name = playerNameInput.value.trim() || "Jugador";
    const color = playerColorInput.value;
    connectAndJoin(name, color);
    menu.style.display = "none";
    canvas.style.display = "block";
  });

  window.addEventListener("DOMContentLoaded", () => {
    menu.style.display = "flex";
    canvas.style.display = "none";
  });
}
