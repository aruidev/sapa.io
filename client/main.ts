// Conectar amb el servidor de WebSocket
const ws = new WebSocket("ws://localhost:8180");

// Recollir el canvas i configurar-lo per a que ocupi tota la pantalla
const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Rebere l'estat dels jugadors des del servidor
let players: any = {};
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  players = data.players;
};

/**
 * Dibuixar els jugadors al canvas. Esborra el canvas i després dibuixa un cercle per a cada jugador segons les seves coordenades i mida.
 */
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const id in players) {
    const p = players[id];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = "lime";
    ctx.fill();
  }
  requestAnimationFrame(draw);
}
draw();

/**
 * Enviar les coordenades del ratolí al servidor cada vegada que es mou. 
 * Quan el ratolí es mou, s'envia un missatge al servidor amb el tipus "move" i les coordenades x i y del ratolí.
 */
canvas.addEventListener("mousemove",(e)=>{
 ws.send(JSON.stringify({
  type:"move",
  x:e.clientX,
  y:e.clientY
 }))
})
