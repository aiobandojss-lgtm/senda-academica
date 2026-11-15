import { Hono } from "hono";

// TEMPORAL (tarea 1.8): mide en el Worker desplegado el costo de CPU de PBKDF2-SHA256 (design.md D5).
// Se elimina, junto con el secreto DIAGNOSTICO_TOKEN, en cuanto se registre la medición.

type EnvDiagnostico = Env & { DIAGNOSTICO_TOKEN?: string };

const ITERACIONES_PERMITIDAS = new Set([10_000, 25_000, 50_000, 100_000]);
const codificador = new TextEncoder();

// Compara en tiempo constante para no filtrar el token por diferencias de tiempo de respuesta
function tokenValido(recibido: string | undefined, esperado: string | undefined): boolean {
  if (!recibido || !esperado) return false;
  const a = codificador.encode(recibido);
  const b = codificador.encode(esperado);
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

export const diagnosticoTemporal = new Hono<{ Bindings: EnvDiagnostico }>();

diagnosticoTemporal.post("/pbkdf2", async (c) => {
  // Sin el token correcto la ruta responde como si no existiera
  if (!tokenValido(c.req.header("x-diagnostico"), c.env.DIAGNOSTICO_TOKEN)) return c.notFound();

  const iteraciones = Number(c.req.query("iteraciones"));
  if (!ITERACIONES_PERMITIDAS.has(iteraciones)) return c.json({ error: "iteraciones no permitidas" }, 400);

  // Mismo trabajo que verificar una contraseña: importar la clave y derivar 32 bytes con sal de 16
  const clave = await crypto.subtle.importKey("raw", codificador.encode("Demo2026*"), "PBKDF2", false, ["deriveBits"]);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteraciones }, clave, 256);

  return c.json({ iteraciones });
});
