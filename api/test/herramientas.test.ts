import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFINICIONES_HERRAMIENTAS, ejecutarHerramienta, type ContextoHerramientas } from "../src/rag/herramientas";
import { EmbeddingsWorkersAi, IndiceVectorize } from "../src/rag/servicios";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { AiFalsa, direccion, VectorizeFalso } from "./ia-falsa";
import { crearCarrera, crearCuota, crearEstudiante, crearUsuario, fechaDesdeHoy } from "./utilidades";

// Tarea RAG 3.1: herramientas de solo lectura del asistente (spec `asistente-academico`: "Datos propios del
// estudiante", "Privacidad de los datos enviados al modelo" y "Respuestas basadas en documentos"; design.md D2 a D6).
// El estudiante sale del contexto (la sesión), nunca de los argumentos que escribe el modelo.

const ANA = { documento: "8310000011", celular: "3001112233" };
const BETO = { documento: "8310000012", celular: "3004445566" };
const CONSULTA = "¿cuál es la nota mínima para aprobar?";

let carreraA: number;
let carreraB: number;
let anaId: number;
let betoId: number;
let ai: AiFalsa;
let vectores: VectorizeFalso;

const contexto = (estudianteId: number, carreraId: number): ContextoHerramientas => ({
  db: env.DB,
  estudianteId,
  carreraId,
  embeddings: new EmbeddingsWorkersAi(ai as unknown as Ai, env.MODELO_EMBEDDINGS),
  indice: new IndiceVectorize(vectores as unknown as VectorizeIndex, "produccion"),
});
const deAna = () => contexto(anaId, carreraA);

async function insertar(sql: string, ...valores: unknown[]): Promise<number> {
  return (await env.DB.prepare(sql).bind(...valores).run()).meta.last_row_id;
}

// Fragmento en D1 y su vector en el índice falso, con un vector elegido por la prueba
async function sembrarFragmento(f: { clave: string; titulo: string; carreraId: number | null; seccion: string; contenido: string; vector: number[] }) {
  await env.DB.prepare(
    "INSERT INTO documentos (clave, titulo, tipo, carrera_id, contenido) VALUES (?, ?, 'otro', ?, 'x') ON CONFLICT (clave) DO NOTHING",
  )
    .bind(f.clave, f.titulo, f.carreraId)
    .run();
  const id = await insertar(
    "INSERT INTO fragmentos (documento_id, orden, seccion, contenido) VALUES ((SELECT id FROM documentos WHERE clave = ?), (SELECT count(*) FROM fragmentos), ?, ?)",
    f.clave,
    f.seccion,
    f.contenido,
  );
  vectores.vectores.set(`produccion:${id}`, {
    id: `produccion:${id}`,
    values: f.vector,
    namespace: "produccion",
    metadata: { carrera_id: f.carreraId ?? 0, tipo: "otro" },
  });
  return id;
}

beforeAll(async () => {
  const hash = await hashContrasena("Prueba2026*");
  carreraA = await crearCarrera("TL-HA");
  carreraB = await crearCarrera("TL-HB");
  anaId = await crearEstudiante({ documento: ANA.documento, carreraId: carreraA, semestre: 1 }, hash);
  betoId = await crearEstudiante({ documento: BETO.documento, carreraId: carreraA, semestre: 1 }, hash);
  await env.DB.prepare("UPDATE usuarios SET nombres = 'Ana María', apellidos = 'Ríos Lara', celular = ? WHERE id = ?").bind(ANA.celular, anaId).run();
  await env.DB.prepare("UPDATE usuarios SET celular = ? WHERE id = ?").bind(BETO.celular, betoId).run();
  const docenteId = await crearUsuario({ documento: "8310000013", rol: "docente" }, hash);

  const cursoId = await insertar(
    "INSERT INTO cursos (carrera_id, nombre, semestre, docente_id) VALUES (?, 'Lógica de programación', 1, ?)",
    carreraA,
    docenteId,
  );
  await insertar("INSERT INTO inscripciones (curso_id, estudiante_id) VALUES (?, ?), (?, ?)", cursoId, anaId, cursoId, betoId);
  const actividad = (titulo: string, publicada: 0 | 1, fechaLimite = "2026-12-01T04:59:00Z") =>
    insertar(
      "INSERT INTO actividades (curso_id, tipo, titulo, instrucciones, fecha_limite, publicada) VALUES (?, 'taller', ?, 'Resolver', ?, ?)",
      cursoId,
      titulo,
      fechaLimite,
      publicada,
    );
  const taller1 = await actividad("Taller 1", 1);
  const taller2 = await actividad("Taller 2", 1, "2026-11-10T04:59:00Z");
  await actividad("Taller 3 en borrador", 0);
  const entregar = (actividadId: number, estudianteId: number, nota: number | null, comentario: string | null) =>
    insertar(
      `INSERT INTO entregas (actividad_id, estudiante_id, archivo_key, nombre_archivo, tipo_mime, tamano_bytes, entregado_en, nota, comentario)
       VALUES (?, ?, 'entregas/x.pdf', 'x.pdf', 'application/pdf', 10, '2026-11-09T15:00:00Z', ?, ?)`,
      actividadId,
      estudianteId,
      nota,
      comentario,
    );
  await entregar(taller2, anaId, 3.8, "Buen trabajo");
  await entregar(taller1, betoId, 4.5, "Excelente");

  await crearCuota(anaId, fechaDesdeHoy(-10), 180_000);
  await crearCuota(betoId, fechaDesdeHoy(-10), 500_000);
});

beforeEach(async () => {
  ai = new AiFalsa();
  vectores = new VectorizeFalso();
  await env.DB.prepare("DELETE FROM documentos").run();
});

describe("Herramientas de datos propios", () => {
  it("mis_actividades_pendientes: solo las publicadas sin entrega de la estudiante, con la fecha límite en hora de Colombia", async () => {
    const resultado = (await ejecutarHerramienta("mis_actividades_pendientes", {}, deAna())) as { pendientes: object[] };
    expect(resultado.pendientes).toEqual([
      { curso: "Lógica de programación", actividad: "Taller 1", tipo: "taller", fechaLimite: "2026-11-30 23:59 (hora de Colombia)", vencida: false },
    ]);
  });

  it("mis_notas: solo las entregas calificadas de la estudiante, nunca las de un compañero", async () => {
    const resultado = (await ejecutarHerramienta("mis_notas", {}, deAna())) as { notas: object[] };
    expect(resultado.notas).toEqual([
      { curso: "Lógica de programación", actividad: "Taller 2", nota: 3.8, comentario: "Buen trabajo", tardia: false },
    ]);
  });

  it("mi_estado_de_cuenta: el total y las cuotas de la estudiante, sin las de otro estudiante", async () => {
    const resultado = (await ejecutarHerramienta("mi_estado_de_cuenta", {}, deAna())) as {
      totalAdeudado: number;
      cuotas: { saldo: number; estado: string }[];
    };
    expect(resultado.totalAdeudado).toBe(180_000);
    expect(resultado.cuotas).toEqual([expect.objectContaining({ saldo: 180_000, estado: "vencida" })]);
  });

  it("los argumentos del modelo no cambian de estudiante: pedir los datos de otro devuelve los propios", async () => {
    const intento = { estudiante_id: betoId, estudianteId: betoId, documento: BETO.documento };
    const notas = JSON.stringify(await ejecutarHerramienta("mis_notas", intento, deAna()));
    const cuenta = JSON.stringify(await ejecutarHerramienta("mi_estado_de_cuenta", intento, deAna()));
    expect(notas).toContain("3.8");
    expect(notas).not.toContain("4.5");
    expect(cuenta).not.toContain("500000");
  });

  it("ninguna herramienta devuelve el documento, el correo, el celular ni los apellidos de la estudiante", async () => {
    const salidas = await Promise.all(
      ["mis_actividades_pendientes", "mis_notas", "mi_estado_de_cuenta"].map((nombre) => ejecutarHerramienta(nombre, {}, deAna())),
    );
    const texto = JSON.stringify(salidas);
    for (const dato of [ANA.documento, `${ANA.documento}@correo.test`, ANA.celular, "Ríos"]) {
      expect(texto).not.toContain(dato);
    }
  });
});

describe("buscar_documentos", () => {
  it("busca en el espacio del entorno y filtra con carrera_id en [0, carrera de la estudiante]", async () => {
    ai.fijarVector(CONSULTA, direccion({ 0: 1 }));
    await ejecutarHerramienta("buscar_documentos", { consulta: CONSULTA }, deAna());
    expect(vectores.consultas[0]).toMatchObject({ namespace: "produccion", filter: { carrera_id: { $in: [0, carreraA] } } });
  });

  it("devuelve el texto desde D1 con su documento y sección, de mayor a menor parecido", async () => {
    ai.fijarVector(CONSULTA, direccion({ 0: 0.8, 1: 0.6 }));
    await sembrarFragmento({ clave: "reglamento", titulo: "Reglamento estudiantil", carreraId: null, seccion: "Asistencia", contenido: "Obligatoria.", vector: direccion({ 1: 1 }) });
    await sembrarFragmento({ clave: "reglamento", titulo: "Reglamento estudiantil", carreraId: null, seccion: "Evaluación", contenido: "La mínima es 3.0.", vector: direccion({ 0: 1 }) });

    const resultado = (await ejecutarHerramienta("buscar_documentos", { consulta: CONSULTA }, deAna())) as {
      resultados: { documento: string; seccion: string; contenido: string; similitud: number }[];
    };

    expect(resultado.resultados.map(({ documento, seccion, contenido }) => ({ documento, seccion, contenido }))).toEqual([
      { documento: "Reglamento estudiantil", seccion: "Evaluación", contenido: "La mínima es 3.0." },
      { documento: "Reglamento estudiantil", seccion: "Asistencia", contenido: "Obligatoria." },
    ]);
    expect(resultado.resultados[0].similitud).toBeCloseTo(0.8);
  });

  it("cada resultado trae la cita ya armada para que el modelo la copie tal cual (tarea 3.2)", async () => {
    ai.fijarVector(CONSULTA, direccion({ 0: 1 }));
    await sembrarFragmento({ clave: "reglamento", titulo: "Reglamento estudiantil", carreraId: null, seccion: "Evaluación", contenido: "La mínima es 3.0.", vector: direccion({ 0: 1 }) });

    const resultado = (await ejecutarHerramienta("buscar_documentos", { consulta: CONSULTA }, deAna())) as { resultados: { fuente: string }[] };

    expect(resultado.resultados[0].fuente).toBe("Reglamento estudiantil – Evaluación");
  });

  it("descarta los resultados de Vectorize cuyo fragmento ya no existe en D1 (vector viejo aún no borrado)", async () => {
    ai.fijarVector(CONSULTA, direccion({ 0: 0.8, 1: 0.6 }));
    const viejo = await sembrarFragmento({ clave: "calendario", titulo: "Calendario", carreraId: null, seccion: "Parciales", contenido: "Fecha vieja.", vector: direccion({ 0: 1 }) });
    await sembrarFragmento({ clave: "calendario", titulo: "Calendario", carreraId: null, seccion: "Parciales", contenido: "Fecha nueva.", vector: direccion({ 1: 1 }) });
    // Se reemplazó el documento: D1 ya no tiene el fragmento viejo, pero Vectorize todavía conserva su vector
    await env.DB.prepare("DELETE FROM fragmentos WHERE id = ?").bind(viejo).run();

    const resultado = (await ejecutarHerramienta("buscar_documentos", { consulta: CONSULTA }, deAna())) as { resultados: { contenido: string }[] };

    expect(resultado.resultados.map((r) => r.contenido)).toEqual(["Fecha nueva."]);
  });

  it("nunca devuelve un documento de otra carrera, aunque sus metadatos en Vectorize estén mal (doble verificación en D1)", async () => {
    ai.fijarVector(CONSULTA, direccion({ 0: 1 }));
    const id = await sembrarFragmento({ clave: "plan-hb", titulo: "Plan TL-HB", carreraId: carreraB, seccion: "Semestre 1", contenido: "Contabilidad.", vector: direccion({ 0: 1 }) });
    vectores.vectores.get(`produccion:${id}`)!.metadata = { carrera_id: 0 };

    const resultado = (await ejecutarHerramienta("buscar_documentos", { consulta: CONSULTA }, deAna())) as { resultados: unknown[] };

    expect(resultado.resultados).toEqual([]);
  });

  it("con similitud por debajo del umbral (0,55) responde que no hay resultados", async () => {
    ai.fijarVector(CONSULTA, direccion({ 0: 0.5, 1: 0.866 }));
    await sembrarFragmento({ clave: "faq", titulo: "Preguntas frecuentes", carreraId: null, seccion: "Cafetería", contenido: "No hay.", vector: direccion({ 0: 1 }) });

    const resultado = (await ejecutarHerramienta("buscar_documentos", { consulta: CONSULTA }, deAna())) as { resultados: unknown[]; aviso?: string };

    expect(resultado.resultados).toEqual([]);
    expect(resultado.aviso).toMatch(/no hay información/i);
  });

  it("devuelve como máximo 4 fragmentos", async () => {
    ai.fijarVector(CONSULTA, direccion({ 0: 1 }));
    for (let i = 0; i < 6; i++) {
      await sembrarFragmento({ clave: "faq", titulo: "FAQ", carreraId: null, seccion: `P${i}`, contenido: `R${i}`, vector: direccion({ 0: 1, [i + 1]: 0.1 }) });
    }
    const resultado = (await ejecutarHerramienta("buscar_documentos", { consulta: CONSULTA }, deAna())) as { resultados: unknown[] };
    expect(resultado.resultados).toHaveLength(4);
  });

  it("una consulta vacía devuelve un error que el modelo puede leer, sin llamar a la IA", async () => {
    const resultado = await ejecutarHerramienta("buscar_documentos", { consulta: "  " }, deAna());
    expect(resultado).toMatchObject({ error: expect.any(String) });
    expect(ai.llamadas).toHaveLength(0);
  });
});

describe("Definiciones para el modelo", () => {
  it("expone exactamente las 4 herramientas de solo lectura del diseño (D4)", () => {
    expect(DEFINICIONES_HERRAMIENTAS.map((d) => d.nombre).sort()).toEqual([
      "buscar_documentos",
      "mi_estado_de_cuenta",
      "mis_actividades_pendientes",
      "mis_notas",
    ]);
  });

  it("una herramienta desconocida devuelve un error, no una excepción", async () => {
    expect(await ejecutarHerramienta("borrar_notas", {}, deAna())).toMatchObject({ error: expect.any(String) });
  });
});
