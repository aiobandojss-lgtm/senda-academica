import { Hono } from "hono";
import { z } from "zod";
import { hoyEnBogota } from "../dominio/mora";
import { responderError, validarJson } from "../errores";
import { responderPregunta, type Fuente, type TurnoHistorial } from "../rag/agente";
import { modeloDelAsistente } from "../rag/modelo";
import { serviciosRag, ServicioIaNoDisponible } from "../rag/servicios";
import { requiereRol } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";
import { texto } from "../validacion";

// Asistente Senda para estudiantes (spec `asistente-academico`; RAG design.md D8, D9 y D11). La sesión y el bloqueo
// por mora los aplica requiereSesion en cada petición, como en el resto de la plataforma.
export const asistente = new Hono<AppEnv>();
asistente.use("*", requiereRol("estudiante"));

export const LIMITE_DIARIO = 30;
// Turnos guardados que se le dan al modelo como contexto (D8)
const TURNOS_DE_HISTORIAL = 6;
// Mensajes que devuelve el historial para la pantalla
const MENSAJES_EN_PANTALLA = 60;

// Solo la pregunta nueva. zod descarta los demás campos: un "historial" enviado por el navegador nunca llega al
// modelo, así nadie puede fabricar un mensaje falso del asistente (prompt injection, D8)
const esquemaPregunta = z.object({ pregunta: texto("Escribe tu pregunta", 500, "La pregunta") });

// Las 00:00 de hoy en Colombia, en UTC (Colombia está siempre en UTC−5): el día del límite es el de Colombia (D9)
const inicioDelDiaUtc = (hoy: string) => `${hoy}T05:00:00Z`;

async function preguntasDeHoy(db: D1Database, usuarioId: number) {
  const fila = await db
    .prepare("SELECT COUNT(*) AS total FROM asistente_mensajes WHERE usuario_id = ? AND rol = 'usuario' AND creado_en >= ?")
    .bind(usuarioId, inicioDelDiaUtc(hoyEnBogota()))
    .first<{ total: number }>();
  return fila?.total ?? 0;
}

type FilaMensaje = { id: number; rol: "usuario" | "asistente"; contenido: string; fuentes_json: string | null; creado_en: string };

asistente.get("/mensajes", async (c) => {
  const usuario = c.var.usuario;
  const [{ results }, usadas] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, rol, contenido, fuentes_json, creado_en FROM (
         SELECT id, rol, contenido, fuentes_json, creado_en FROM asistente_mensajes WHERE usuario_id = ? ORDER BY id DESC LIMIT ?
       ) ORDER BY id`,
    )
      .bind(usuario.id, MENSAJES_EN_PANTALLA)
      .all<FilaMensaje>(),
    preguntasDeHoy(c.env.DB, usuario.id),
  ]);
  return c.json({
    mensajes: results.map((m) => ({
      id: m.id,
      rol: m.rol,
      contenido: m.contenido,
      fuentes: m.fuentes_json ? (JSON.parse(m.fuentes_json) as Fuente[]) : [],
      creadoEn: m.creado_en,
    })),
    preguntasRestantes: Math.max(0, LIMITE_DIARIO - usadas),
  });
});

asistente.post("/mensajes", validarJson(esquemaPregunta), async (c) => {
  const usuario = c.var.usuario;
  const { pregunta } = c.req.valid("json");
  const db = c.env.DB;

  // Antes de llamar al modelo: protege la cuota gratuita, que es de toda la cuenta (D9)
  const usadas = await preguntasDeHoy(db, usuario.id);
  if (usadas >= LIMITE_DIARIO) {
    return responderError(c, 429, "LIMITE_DIARIO", `Llegaste al límite de ${LIMITE_DIARIO} preguntas de hoy. Podrás preguntar de nuevo mañana.`);
  }

  const [perfil, anteriores] = await db.batch([
    db
      .prepare("SELECT e.carrera_id, k.nombre AS carrera FROM estudiantes e JOIN carreras k ON k.id = e.carrera_id WHERE e.usuario_id = ?")
      .bind(usuario.id),
    // El historial sale de la base y solo del propio estudiante (D8)
    db.prepare("SELECT rol, contenido FROM asistente_mensajes WHERE usuario_id = ? ORDER BY id DESC LIMIT ?").bind(usuario.id, TURNOS_DE_HISTORIAL),
  ]);
  const estudiante = perfil.results[0] as { carrera_id: number; carrera: string } | undefined;
  if (!estudiante) return responderError(c, 404, "ESTUDIANTE_NO_ENCONTRADO", "El estudiante no existe");

  const rag = serviciosRag(c.env);
  let resultado;
  try {
    resultado = await responderPregunta({
      modelo: modeloDelAsistente(c.env),
      contexto: { db, estudianteId: usuario.id, carreraId: estudiante.carrera_id, embeddings: rag.embeddings, indice: rag.indice },
      // D6: solo el nombre de pila y la carrera
      perfil: { nombrePila: usuario.nombres.trim().split(/\s+/)[0], carrera: estudiante.carrera },
      config: { producto: c.env.PRODUCTO_NOMBRE, fundacion: c.env.FUNDACION_NOMBRE, contacto: c.env.CONTACTO_FUNDACION },
      historial: (anteriores.results as TurnoHistorial[]).reverse(),
      pregunta,
    });
  } catch (error) {
    if (!(error instanceof ServicioIaNoDisponible)) throw error;
    // D11: no se guarda la pregunta (no cuenta para el límite). Habeas Data: el log no lleva la pregunta
    console.warn("Asistente no disponible", { error: error.message });
    return responderError(c, 503, "ASISTENTE_NO_DISPONIBLE", "El asistente no está disponible por ahora. Intenta de nuevo más tarde.");
  }

  await db.batch([
    db.prepare("INSERT INTO asistente_mensajes (usuario_id, rol, contenido) VALUES (?, 'usuario', ?)").bind(usuario.id, pregunta),
    db
      .prepare("INSERT INTO asistente_mensajes (usuario_id, rol, contenido, fuentes_json) VALUES (?, 'asistente', ?, ?)")
      .bind(usuario.id, resultado.respuesta, JSON.stringify(resultado.fuentes)),
  ]);
  // Para revisar el comportamiento del agente en los registros de Cloudflare, sin el contenido de la conversación
  console.log("Asistente respondió", {
    pasos: resultado.pasos,
    herramientas: resultado.herramientas,
    reemplazada: resultado.reemplazada,
    motivo: resultado.motivo,
    citasInvalidas: resultado.citasInvalidas,
  });

  return c.json({ respuesta: resultado.respuesta, fuentes: resultado.fuentes, preguntasRestantes: LIMITE_DIARIO - usadas - 1 });
});
