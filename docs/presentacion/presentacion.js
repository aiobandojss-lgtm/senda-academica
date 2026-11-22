// Lógica compartida de la presentación: los bloques, los 16 pasos y la sincronización entre ventanas.
// La cargan diapositivas.html (lo que ve el jurado) y guion.html (lo que lee Aymer).
// Aquí NO está el texto que se lee: vive solo en guion.html (TEXTOS), así la página del jurado nunca lo carga.
// Es un módulo ES: cada página importa solo lo que usa (import { ... } from "./presentacion.js").

export const BLOQUES = [
  { nombre: "El problema", segundos: 50 },
  { nombre: "Demo en vivo", segundos: 240 },
  { nombre: "Sin inventar", segundos: 120 },
  { nombre: "Cómo se construyó", segundos: 150 },
  { nombre: "Cierre", segundos: 40 },
];

// Cada paso: su id (lo enlaza con su texto en guion.html), el bloque, la diapositiva que se proyecta, el título y su tiempo
export const PASOS = [
  { id: "portada", bloque: 0, diapositiva: "portada", titulo: "Portada", segundos: 15 },
  { id: "problema", bloque: 0, diapositiva: "problema", titulo: "El problema", segundos: 35 },
  { id: "plataforma", bloque: 1, diapositiva: "demo", titulo: "Vamos a la plataforma", segundos: 10 },
  { id: "entrega", bloque: 1, diapositiva: "demo", titulo: "Paola entrega su taller", segundos: 40 },
  { id: "califica", bloque: 1, diapositiva: "demo", titulo: "Liliana califica", segundos: 45 },
  { id: "nota", bloque: 1, diapositiva: "demo", titulo: "Paola ve su nota", segundos: 15 },
  { id: "asistente", bloque: 1, diapositiva: "demo", titulo: "El asistente", segundos: 65 },
  { id: "mora", bloque: 1, diapositiva: "demo", titulo: "Mora: bloqueo y pago", segundos: 65 },
  { id: "alucinacion", bloque: 2, diapositiva: "guardas", titulo: "La alucinación del 4.0", segundos: 30 },
  { id: "capas", bloque: 2, diapositiva: "guardas", titulo: "Las tres capas", segundos: 45 },
  { id: "medido", bloque: 2, diapositiva: "medido", titulo: "Medido, no opinado", segundos: 45 },
  { id: "cambio", bloque: 3, diapositiva: "spec", titulo: "Un cambio de OpenSpec", segundos: 30 },
  { id: "trazabilidad", bloque: 3, diapositiva: "spec", titulo: "Spec, prueba y trazabilidad", segundos: 35 },
  { id: "pipeline", bloque: 3, diapositiva: "spec", titulo: "Playwright y el pipeline", segundos: 50 },
  { id: "agente", bloque: 3, diapositiva: "spec", titulo: "El agente con reglas", segundos: 35 },
  { id: "cierre", bloque: 4, diapositiva: "cierre", titulo: "Cierre", segundos: 40 },
];

export const $ = (selector, raiz = document) => raiz.querySelector(selector);

// ---------- Estado compartido entre ventanas ----------
// tiempos[i]: milisegundos acumulados en el paso i. marca: cuándo empezó a correr el paso actual (si corre).
// rev: cuándo cambió por última vez; entre dos estados gana el más reciente.
const CLAVE = "senda-presentacion-v1";
const estadoInicial = () => ({ paso: 0, corriendo: false, marca: null, tiempos: PASOS.map(() => 0), rev: 0 });
export let estado = estadoInicial();

// Cada página registra cómo se pinta cuando cambia el estado, y qué hace cuando el cambio llega de otra ventana
let alCambiarEstado = () => {};
let alRecibirDeOtraVentana = () => {};
export function alCambiar(fn) { alCambiarEstado = fn; }
export function alRecibir(fn) { alRecibirDeOtraVentana = fn; }

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* sin almacenamiento: igual funciona */ }
}
export function cargar() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
    if (guardado && Array.isArray(guardado.tiempos) && guardado.tiempos.length === PASOS.length) estado = guardado;
  } catch { /* ignorado */ }
}

const canal = "BroadcastChannel" in window ? new BroadcastChannel("senda-presentacion") : null;
function publicar() {
  estado.rev = Date.now();
  guardar();
  canal?.postMessage({ tipo: "estado", estado });
  alCambiarEstado();
}
if (canal) {
  canal.onmessage = ({ data }) => {
    if (data?.tipo === "pedir") canal.postMessage({ tipo: "estado", estado });
    if (data?.tipo === "estado" && data.estado.rev > estado.rev) {
      estado = data.estado;
      guardar();
      alCambiarEstado();
      alRecibirDeOtraVentana();
    }
  };
}
// Al abrir una ventana, pide el estado a las que ya están abiertas
export function pedirEstado() {
  canal?.postMessage({ tipo: "pedir" });
}
// Respaldo para navegadores sin BroadcastChannel: el evento storage avisa a las otras ventanas
window.addEventListener("storage", (e) => {
  if (e.key !== CLAVE || canal) return;
  cargar();
  alCambiarEstado();
});

// ---------- Cronómetro y navegación ----------
export const transcurridoPaso = (i) => estado.tiempos[i] + (estado.corriendo && i === estado.paso ? Date.now() - estado.marca : 0);
export const total = () => PASOS.reduce((suma, _, i) => suma + transcurridoPaso(i), 0);
export const enBloque = (b) => PASOS.reduce((suma, p, i) => suma + (p.bloque === b ? transcurridoPaso(i) : 0), 0);

export function irA(i) {
  const destino = Math.min(PASOS.length - 1, Math.max(0, i));
  if (destino === estado.paso) return;
  if (estado.corriendo) {
    estado.tiempos[estado.paso] += Date.now() - estado.marca;
    estado.marca = Date.now();
  }
  estado.paso = destino;
  publicar();
}
export function siguiente() {
  // Avanzar desde la portada pone a correr el cronómetro, por si se olvidó
  if (!estado.corriendo && estado.paso === 0 && total() === 0) iniciarOPausar();
  irA(estado.paso + 1);
}
export function iniciarOPausar() {
  if (estado.corriendo) {
    estado.tiempos[estado.paso] += Date.now() - estado.marca;
    estado.corriendo = false;
    estado.marca = null;
  } else {
    estado.corriendo = true;
    estado.marca = Date.now();
  }
  publicar();
}
export function reiniciar() {
  estado = estadoInicial();
  publicar();
}

// Teclas que sirven en las dos páginas (también las de un control de presentaciones: Avanzar página y Retroceder página)
export function teclaDeNavegacion(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); siguiente(); return true; }
  if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); irA(estado.paso - 1); return true; }
  if (e.key === "Home") { irA(0); return true; }
  if (e.key === "End") { irA(PASOS.length - 1); return true; }
  if (e.key === "t" || e.key === "T") { iniciarOPausar(); return true; }
  return false;
}
