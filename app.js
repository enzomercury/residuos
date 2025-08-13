// === CONFIGURACIÓN ===
// URL del modelo Teachable Machine (dejá la barra final "/")
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/Km83pE-_3/";

// Tamaño del lienzo para dibujar el frame y overlay
const CANVAS_W = 480;
const CANVAS_H = 360;

// === Variables de estado ===
let model, maxPredictions;
let webcam; // tmImage.Webcam
let running = false;
let useBackCamera = true; // intentar cámara trasera en móviles
let rafId = null;

const els = {
  video: document.getElementById("video"),
  canvas: document.getElementById("canvas"),
  status: document.getElementById("status"),
  btnStart: document.getElementById("btnStart"),
  btnStop: document.getElementById("btnStop"),
  btnFlip: document.getElementById("btnFlip"),
  bars: document.getElementById("bars"),
  bestLabel: document.getElementById("bestLabel"),
  badge: document.getElementById("badge"),
};

const ctx = els.canvas.getContext("2d");

function setStatus(msg){ els.status.textContent = msg; }
function enableCtrls(start, stop, flip){
  els.btnStart.disabled = !start;
  els.btnStop.disabled = !stop;
  els.btnFlip.disabled = !flip;
}

function classToVerdict(name){
  // Ajustá según los nombres reales de tus clases
  const n = name.toLowerCase();
  if (n.includes("recicl")) return "RECICLABLE";
  if (n.includes("no") && n.includes("recicl")) return "NO RECICLABLE";
  // Heurística simple: si no coincide, mostramos el nombre tal cual
  return name.toUpperCase();
}

// Crear barras de confianza
function ensureBars(count){
  if (els.bars.childElementCount !== count){
    els.bars.innerHTML = "";
    for (let i = 0; i < count; i++){
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.innerHTML = `
        <div class="row">
          <span class="cls">Clase</span>
          <span class="pct">0.00</span>
        </div>
        <div class="meter"><i style="--p:0%"></i></div>
      `;
      els.bars.appendChild(bar);
    }
  }
}

// Actualizar una barra
function updateBar(idx, label, prob){
  const bar = els.bars.children[idx];
  bar.querySelector(".cls").textContent = label;
  bar.querySelector(".pct").textContent = prob.toFixed(2);
  bar.querySelector("i").style.setProperty("--p", `${Math.round(prob*100)}%`);
}

async function loadModel(){
  setStatus("Cargando modelo…");
  const modelURL = MODEL_URL + "model.json";
  const metadataURL = MODEL_URL + "metadata.json";
  model = await window.tmImage.load(modelURL, metadataURL);
  maxPredictions = model.getTotalClasses();
  ensureBars(maxPredictions);
  setStatus("Modelo listo");
}

async function setupWebcam(){
  setStatus("Solicitando acceso a la cámara…");
  const flip = true; // espejar para UI
  // tmImage.Webcam también acepta constraints por detrás
  webcam = new window.tmImage.Webcam(CANVAS_W, CANVAS_H, flip);

  // Intento forzar facingMode
  const constraints = {
    video: {
      width: CANVAS_W,
      height: CANVAS_H,
      facingMode: useBackCamera ? { ideal: "environment" } : "user"
    },
    audio: false
  };
  await webcam.setup(constraints); // pide permiso
  await webcam.play();
  setStatus("Cámara activa");
}

function drawFrame(){
  ctx.drawImage(webcam.canvas, 0, 0, CANVAS_W, CANVAS_H);
}

async function predict(){
  // Evitar pérdidas de memoria
  const preds = await tf.tidy(() => model.predict(webcam.canvas));
  // preds es un array de objetos {className, probability}
  let best = { className: "—", probability: 0 };
  preds.forEach((p, i) => {
    updateBar(i, p.className, p.probability);
    if (p.probability > best.probability) best = p;
  });
  els.bestLabel.textContent = `${classToVerdict(best.className)} (${(best.probability*100).toFixed(1)}%)`;
  els.badge.textContent = best.probability >= 0.5 ? "Alta confianza" : "Baja confianza";
}

async function loop(){
  if (!running) return;
  webcam.update();
  drawFrame();
  await predict();
  rafId = requestAnimationFrame(loop);
}

// === Controladores UI ===
els.btnStart.addEventListener("click", async () => {
  try{
    if (!model) await loadModel();
    await setupWebcam();
    running = true;
    enableCtrls(false, true, true);
    loop();
  }catch(err){
    console.error(err);
    setStatus("Error al iniciar la cámara. Revisa permisos/HTTPS.");
    enableCtrls(true, false, false);
  }
});

els.btnStop.addEventListener("click", () => {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (webcam) webcam.stop();
  setStatus("Cámara detenida");
  enableCtrls(true, false, true);
});

els.btnFlip.addEventListener("click", async () => {
  // Cambiar cámara: detener, invertir flag y reiniciar
  try{
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (webcam) webcam.stop();
    useBackCamera = !useBackCamera;
    await setupWebcam();
    running = true;
    loop();
  }catch(err){
    console.error(err);
    setStatus("No se pudo cambiar de cámara");
  }
});

// Render inicial
(function initCanvas(){
  ctx.fillStyle = "#111";
  ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  ctx.fillStyle = "#fff";
  ctx.font = "16px system-ui";
  ctx.fillText("EcoCheck IA — listo para iniciar", 16, 28);
})();
