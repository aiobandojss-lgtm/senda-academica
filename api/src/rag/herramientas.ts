import { utcABogota } from "../dominio/fechas";
import { actividadesPublicadasDe } from "../rutas/actividades";
import { estadoDeCuenta } from "../rutas/cartera";
import type { GeneradorEmbeddings, IndiceVectorial } from "./servicios";

// Herramientas de solo lectura del asistente (spec `asistente-academico`; RAG design.md D4 a D6). El modelo decide
// cuál usar, pero nunca de quién: el estudiante y su carrera llegan en el contexto, que arma la API con la sesión.
// Los argumentos que escriba el modelo (o que alguien le dicte en la pregunta) no pueden cambiarlo.
// Privacidad (D6): ninguna devuelve documento, correo, celular, apellidos ni ids de personas.

export type ContextoHerramientas = {
  db: D1Database;
  estudianteId: number;
  carreraId: number;
  embeddings: GeneradorEmbeddings;
  indice: IndiceVectorial;
};

// Guarda 1 contra alucinaciones (D5): por debajo de este parecido, un fragmento no cuenta como fuente.
// Valor inicial; lo ajusta la evaluación (tarea 4.1)
export const UMBRAL_SIMILITUD = 0.55;
// Se piden más candidatos de los que se usan: algunos se descartan por umbral o porque ya no existen en D1 (D3)
const CANDIDATOS = 10;
const MAXIMO_RESULTADOS = 4;
const MAXIMO_CONSULTA = 500;

const SIN_RESULTADOS = {
  resultados: [],
  aviso: "No hay información sobre eso en los documentos de la Fundación. Responde que no tienes esa información.",
};

// Lo que el modelo ve de cada herramienta (nombre, para qué sirve y sus parámetros en JSON Schema).
// El adaptador de cada modelo (tarea 3.2) las traduce a su formato de function calling
export const DEFINICIONES_HERRAMIENTAS = [
  {
    nombre: "buscar_documentos",
    descripcion:
      "Busca en los documentos oficiales de la Fundación (reglamento, calendario académico, plan de estudios de la carrera del estudiante y preguntas frecuentes). Úsala para preguntas sobre normas, fechas, notas mínimas, entregas, pagos o el programa.",
    parametros: {
      type: "object",
      properties: { consulta: { type: "string", description: "Qué buscar, en español, con las palabras clave de la pregunta" } },
      required: ["consulta"],
    },
  },
  {
    nombre: "mis_actividades_pendientes",
    descripcion: "Talleres y evaluaciones publicados en los cursos del estudiante que todavía no ha entregado, con su fecha límite.",
    parametros: { type: "object", properties: {} },
  },
  {
    nombre: "mis_notas",
    descripcion: "Notas de las entregas ya calificadas del estudiante, con el comentario del docente.",
    parametros: { type: "object", properties: {} },
  },
  {
    nombre: "mi_estado_de_cuenta",
    descripcion: "Estado de cuenta del estudiante: cuánto debe, cuánto está vencido y sus cuotas con fecha de vencimiento y saldo.",
    parametros: { type: "object", properties: {} },
  },
] as const;

export type NombreHerramienta = (typeof DEFINICIONES_HERRAMIENTAS)[number]["nombre"];

// Ejecuta una herramienta. Un nombre desconocido o un argumento inválido devuelven { error } para que el modelo
// pueda corregirse; las fallas de Workers AI o Vectorize (ServicioIaNoDisponible) sí se propagan (D11).
export async function ejecutarHerramienta(nombre: string, argumentos: unknown, contexto: ContextoHerramientas): Promise<unknown> {
  switch (nombre) {
    case "buscar_documentos":
      return buscarDocumentos(argumentos, contexto);
    case "mis_actividades_pendientes":
      return misActividadesPendientes(contexto);
    case "mis_notas":
      return misNotas(contexto);
    case "mi_estado_de_cuenta":
      return miEstadoDeCuenta(contexto);
    default:
      return { error: `La herramienta ${nombre} no existe. Usa solo las herramientas disponibles.` };
  }
}

type FilaFragmento = { id: number; titulo: string; seccion: string; contenido: string };

// "Documento – Sección": el formato de cita de la spec (con raya, no guion)
export const citaDe = (documento: string, seccion: string) => `${documento} – ${seccion}`;

async function buscarDocumentos(argumentos: unknown, { db, carreraId, embeddings, indice }: ContextoHerramientas) {
  const consultaRecibida = (argumentos as { consulta?: unknown } | null)?.consulta;
  const consulta = typeof consultaRecibida === "string" ? consultaRecibida.trim().slice(0, MAXIMO_CONSULTA) : "";
  if (!consulta) return { error: "Falta la consulta: escribe qué buscar en los documentos." };

  const [vector] = await embeddings.generar([consulta]);
  const coincidencias = (await indice.buscar(vector, { carreraId, maximo: CANDIDATOS })).filter((c) => c.similitud >= UMBRAL_SIMILITUD);
  if (coincidencias.length === 0) return SIN_RESULTADOS;

  // El texto se lee de D1 (D3): lo que ya no existe ahí (un vector viejo que Vectorize aún no borra) se descarta.
  // La carrera se verifica otra vez en D1, por si los metadatos de un vector estuvieran mal.
  const ids = coincidencias.map((c) => c.fragmentoId);
  const { results } = await db
    .prepare(
      `SELECT f.id, d.titulo, f.seccion, f.contenido
         FROM fragmentos f JOIN documentos d ON d.id = f.documento_id
        WHERE f.id IN (${ids.map(() => "?").join(", ")}) AND (d.carrera_id IS NULL OR d.carrera_id = ?)`,
    )
    .bind(...ids, carreraId)
    .all<FilaFragmento>();
  const porId = new Map(results.map((f) => [f.id, f]));

  const resultados = coincidencias
    .flatMap((c) => {
      const f = porId.get(c.fragmentoId);
      if (!f) return [];
      return [
        {
          // La cita ya armada: el modelo la copia tal cual, en lugar de componerla (design.md D2, tarea 3.2)
          fuente: citaDe(f.titulo, f.seccion),
          documento: f.titulo,
          seccion: f.seccion,
          contenido: f.contenido,
          similitud: Math.round(c.similitud * 1000) / 1000,
        },
      ];
    })
    .slice(0, MAXIMO_RESULTADOS);
  return resultados.length > 0 ? { resultados } : SIN_RESULTADOS;
}

async function misActividadesPendientes({ db, estudianteId }: ContextoHerramientas) {
  const ahora = new Date().toISOString();
  const pendientes = (await actividadesPublicadasDe(db, estudianteId)).filter((a) => a.entrega_id === null);
  return {
    pendientes: pendientes.map((a) => ({
      curso: a.curso_nombre,
      actividad: a.titulo,
      tipo: a.tipo,
      fechaLimite: `${utcABogota(a.fecha_limite)} (hora de Colombia)`,
      // Una vencida todavía se puede entregar, como tardía (reglamento, "Entregas de talleres")
      vencida: a.fecha_limite < ahora,
    })),
  };
}

type FilaNota = { curso: string; actividad: string; nota: number; comentario: string | null; entregado_en: string; fecha_limite: string };

async function misNotas({ db, estudianteId }: ContextoHerramientas) {
  const { results } = await db
    .prepare(
      `SELECT k.nombre AS curso, a.titulo AS actividad, en.nota, en.comentario, en.entregado_en, a.fecha_limite
         FROM entregas en
         JOIN actividades a ON a.id = en.actividad_id
         JOIN cursos k ON k.id = a.curso_id
        WHERE en.estudiante_id = ? AND en.nota IS NOT NULL
        ORDER BY en.calificado_en DESC, en.id DESC`,
    )
    .bind(estudianteId)
    .all<FilaNota>();
  return {
    notas: results.map((n) => ({
      curso: n.curso,
      actividad: n.actividad,
      nota: n.nota,
      comentario: n.comentario,
      // "Tardía" se calcula, no se guarda (D20 del MVP)
      tardia: n.entregado_en > n.fecha_limite,
    })),
  };
}

async function miEstadoDeCuenta({ db, estudianteId }: ContextoHerramientas) {
  // El mismo cálculo que ve el estudiante en su pantalla de estado de cuenta (sin pagos anulados)
  const cuenta = await estadoDeCuenta(db, estudianteId, { paraEstudiante: true });
  const excepcion = cuenta.excepciones.find((e) => e.vigente);
  return {
    estadoCartera: cuenta.estadoCartera,
    totalAdeudado: cuenta.totalAdeudado,
    totalVencido: cuenta.totalVencido,
    cuotas: cuenta.cuotas.map((c) => ({
      concepto: c.concepto,
      valor: c.valor,
      fechaVencimiento: c.fechaVencimiento,
      pagado: c.pagado,
      saldo: c.saldo,
      estado: c.estado,
      diasAtraso: c.diasAtraso,
    })),
    // Solo la fecha: el motivo es un asunto entre el estudiante y la administración
    ...(excepcion ? { excepcionDeMoraHasta: excepcion.hasta } : {}),
  };
}
