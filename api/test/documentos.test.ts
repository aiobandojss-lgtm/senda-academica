import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fragmentarDocumento } from "../src/dominio/fragmentacion";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { AiFalsa, pedirConIa, VectorizeFalso } from "./ia-falsa";
import { crearCarrera, crearEstudiante, crearUsuario, sesionDe } from "./utilidades";

// Tarea RAG 2.2: API del administrador para cargar, reemplazar y retirar los documentos del asistente
// (spec `base-conocimiento`; design.md D2 y D3). Workers AI y Vectorize se reemplazan por dobles (ia-falsa.ts).

const CONTRASENA = "Prueba2026*";
const ADMIN = { documento: "8220000001", rol: "admin" as const };
const DOCENTE = { documento: "8220000002", rol: "docente" as const };

const REGLAMENTO = `# Reglamento

## Evaluación

La nota mínima para aprobar es 3.0.

## Entregas de talleres

Una entrega tardía tiene un descuento de 0.5.`;

const CALENDARIO_VIEJO = "# Calendario\n\n## Parciales\n\nDel 1 al 5 de diciembre.";
const CALENDARIO_NUEVO = "# Calendario\n\n## Parciales\n\nDel 30 de noviembre al 4 de diciembre.\n\n## Receso\n\nDesde el 19 de diciembre.";

type DocumentoRespuesta = {
  documento: { id: number; clave: string; titulo: string; tipo: string; carreraId: number | null; fragmentos: number };
  espacio: string;
};
type DocumentoLista = {
  clave: string;
  titulo: string;
  tipo: string;
  carrera: { id: number; codigo: string; nombre: string } | null;
  fragmentos: number;
  actualizadoEn: string;
};

let admin: string;
let docente: string;
let estudiante: string;
let carreraId: number;
let ai: AiFalsa;
let vectores: VectorizeFalso;

const pedir = (token: string | null, metodo: "GET" | "PUT" | "DELETE", ruta: string, cuerpo?: unknown) =>
  pedirConIa({ ai, vectores }, token, metodo, ruta, cuerpo);

const cargar = (clave: string, cuerpo: Record<string, unknown>) => pedir(admin, "PUT", `/documentos/${clave}`, cuerpo);

const fragmentosDe = async (clave: string) =>
  (
    await env.DB.prepare(
      "SELECT f.id, f.seccion, f.contenido FROM fragmentos f JOIN documentos d ON d.id = f.documento_id WHERE d.clave = ? ORDER BY f.orden",
    )
      .bind(clave)
      .all<{ id: number; seccion: string; contenido: string }>()
  ).results;

beforeAll(async () => {
  const hash = await hashContrasena(CONTRASENA);
  carreraId = await crearCarrera("TL-DOC");
  await crearUsuario({ ...ADMIN, avisoVersion: env.AVISO_PRIVACIDAD_VERSION }, hash);
  await crearUsuario({ ...DOCENTE, avisoVersion: env.AVISO_PRIVACIDAD_VERSION }, hash);
  await crearEstudiante({ documento: "8220000003", carreraId, semestre: 1 }, hash);
  admin = await sesionDe(ADMIN.documento, CONTRASENA);
  docente = await sesionDe(DOCENTE.documento, CONTRASENA);
  estudiante = await sesionDe("8220000003", CONTRASENA);
});

beforeEach(async () => {
  ai = new AiFalsa();
  vectores = new VectorizeFalso();
  await env.DB.prepare("DELETE FROM documentos").run();
});

describe("Solo el administrador gestiona la base", () => {
  it("Estudiante intenta cargar un documento: recibe acceso denegado y no se guarda nada", async () => {
    const respuesta = await pedir(estudiante, "PUT", "/documentos/reglamento", { titulo: "R", tipo: "reglamento", contenido: REGLAMENTO });
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ codigo: "ACCESO_DENEGADO" });
    expect(ai.llamadas).toHaveLength(0);
    expect(await fragmentosDe("reglamento")).toHaveLength(0);
  });

  it("un docente tampoco puede listar, cargar ni retirar documentos", async () => {
    expect((await pedir(docente, "GET", "/documentos")).status).toBe(403);
    expect((await pedir(docente, "PUT", "/documentos/x", { titulo: "X", tipo: "otro", contenido: "## A\n\nB" })).status).toBe(403);
    expect((await pedir(docente, "DELETE", "/documentos/x")).status).toBe(403);
  });

  it("sin sesión responde no autenticado", async () => {
    expect((await pedir(null, "GET", "/documentos")).status).toBe(401);
  });
});

describe("PUT /api/documentos/:clave: carga e indexación", () => {
  it("Cargar reglamento: como documento general guarda los fragmentos por sección y responde cuántos se indexaron", async () => {
    const respuesta = await cargar("reglamento-estudiantil", { titulo: "Reglamento estudiantil", tipo: "reglamento", contenido: REGLAMENTO });

    expect(respuesta.status).toBe(201);
    const { documento, espacio } = await respuesta.json<DocumentoRespuesta>();
    expect(documento).toMatchObject({ clave: "reglamento-estudiantil", tipo: "reglamento", carreraId: null, fragmentos: 2 });
    expect(espacio).toBe("produccion");
    expect((await fragmentosDe("reglamento-estudiantil")).map((f) => f.seccion)).toEqual(["Evaluación", "Entregas de talleres"]);
  });

  it("cada fragmento queda en Vectorize con id y espacio del entorno, y carrera_id 0 por ser general", async () => {
    await cargar("reglamento", { titulo: "Reglamento estudiantil", tipo: "reglamento", contenido: REGLAMENTO });
    const fragmentos = await fragmentosDe("reglamento");

    expect(vectores.idsEn("produccion")).toEqual(fragmentos.map((f) => `produccion:${f.id}`).sort());
    for (const f of fragmentos) {
      const vector = vectores.vectores.get(`produccion:${f.id}`)!;
      expect(vector.metadata).toMatchObject({ carrera_id: 0, tipo: "reglamento" });
      expect(vector.values).toHaveLength(1024);
    }
  });

  it("el texto que se convierte en vector lleva el título del documento y la sección, para encontrarlo mejor", async () => {
    await cargar("reglamento", { titulo: "Reglamento estudiantil", tipo: "reglamento", contenido: REGLAMENTO });
    const textos = ai.llamadas.flatMap((l) => (l.entrada as { text: string[] }).text);
    expect(ai.llamadas[0].modelo).toBe(env.MODELO_EMBEDDINGS);
    expect(textos).toContain("Reglamento estudiantil – Entregas de talleres\n\nUna entrega tardía tiene un descuento de 0.5.");
  });

  it("un plan de estudios de una carrera queda con el id de esa carrera en los metadatos", async () => {
    const respuesta = await cargar("plan-tl-doc", { titulo: "Plan de estudios", tipo: "plan_estudios", carreraId, contenido: "## Semestre 1\n\nCursos." });
    expect(respuesta.status).toBe(201);
    const [vector] = vectores.vectores.values();
    expect(vector.metadata).toMatchObject({ carrera_id: carreraId, tipo: "plan_estudios" });
  });

  it("una carrera que no existe se rechaza sin llamar al servicio de IA", async () => {
    const respuesta = await cargar("plan-x", { titulo: "Plan", tipo: "plan_estudios", carreraId: 999_999, contenido: "## A\n\nB" });
    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toMatchObject({ codigo: "CARRERA_NO_ENCONTRADA" });
    expect(ai.llamadas).toHaveLength(0);
  });

  it("un documento sin texto (solo títulos) se rechaza", async () => {
    const respuesta = await cargar("vacio", { titulo: "Vacío", tipo: "otro", contenido: "# Título\n\n## Sección\n" });
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ codigo: "DOCUMENTO_SIN_TEXTO" });
  });

  it("valida el tipo y la clave", async () => {
    expect((await cargar("x", { titulo: "X", tipo: "receta", contenido: "## A\n\nB" })).status).toBe(400);
    expect((await cargar("con.punto", { titulo: "X", tipo: "otro", contenido: "## A\n\nB" })).status).toBe(400);
  });

  it("con MODELO_SIMULADO=1 (prueba E2E, tarea 4.2) guarda los fragmentos en D1 sin llamar a Workers AI ni a Vectorize", async () => {
    const respuesta = await pedirConIa(
      { ai, vectores, variables: { MODELO_SIMULADO: "1" }, origen: "http://localhost:4173" },
      admin,
      "PUT",
      "/documentos/reglamento-e2e",
      { titulo: "Reglamento estudiantil", tipo: "reglamento", contenido: REGLAMENTO },
    );

    expect(respuesta.status).toBe(201);
    expect((await respuesta.json<DocumentoRespuesta>()).espacio).toBe("simulado");
    expect((await fragmentosDe("reglamento-e2e")).map((f) => f.seccion)).toEqual(["Evaluación", "Entregas de talleres"]);
    expect(ai.llamadas).toEqual([]);
    expect(vectores.vectores.size).toBe(0);
  });

  it("en desarrollo (RAG_ESPACIO=local) los vectores van al espacio local y no tocan los de producción", async () => {
    const respuesta = await pedirConIa({ ai, vectores, variables: { RAG_ESPACIO: "local" } }, admin, "PUT", "/documentos/reglamento", {
      titulo: "Reglamento",
      tipo: "reglamento",
      contenido: REGLAMENTO,
    });
    expect(respuesta.status).toBe(201);
    expect((await respuesta.json<DocumentoRespuesta>()).espacio).toBe("local");
    expect(vectores.idsEn("local").every((id) => id.startsWith("local:"))).toBe(true);
    expect(vectores.idsEn("produccion")).toEqual([]);
  });
});

describe("Reemplazar y retirar", () => {
  it("Reemplazar calendario: elimina los fragmentos y vectores anteriores y deja solo los nuevos", async () => {
    await cargar("calendario", { titulo: "Calendario", tipo: "calendario", contenido: CALENDARIO_VIEJO });
    const viejos = await fragmentosDe("calendario");

    const respuesta = await cargar("calendario", { titulo: "Calendario académico", tipo: "calendario", contenido: CALENDARIO_NUEVO });

    expect(respuesta.status).toBe(200);
    expect((await respuesta.json<DocumentoRespuesta>()).documento).toMatchObject({ titulo: "Calendario académico", fragmentos: 2 });
    const nuevos = await fragmentosDe("calendario");
    expect(nuevos.map((f) => f.contenido).join(" ")).not.toContain("Del 1 al 5 de diciembre");
    // Los ids nunca se reutilizan (AUTOINCREMENT): un vector viejo jamás apunta a un fragmento nuevo
    expect(Math.min(...nuevos.map((f) => f.id))).toBeGreaterThan(Math.max(...viejos.map((f) => f.id)));
    expect(vectores.idsEn("produccion")).toEqual(nuevos.map((f) => `produccion:${f.id}`).sort());
    const { count } = (await env.DB.prepare("SELECT count(*) AS count FROM documentos WHERE clave = 'calendario'").first<{ count: number }>())!;
    expect(count).toBe(1);
  });

  it("Retirar documento: borra sus fragmentos y sus vectores, así que ninguna búsqueda posterior lo encuentra; retirarlo otra vez responde que no existe", async () => {
    await cargar("faq", { titulo: "Preguntas frecuentes", tipo: "preguntas_frecuentes", contenido: "## ¿Hay app?\n\nNo, es web." });

    const respuesta = await pedir(admin, "DELETE", "/documentos/faq");

    expect(respuesta.status).toBe(204);
    expect(await fragmentosDe("faq")).toHaveLength(0);
    expect(vectores.vectores.size).toBe(0);
    const otraVez = await pedir(admin, "DELETE", "/documentos/faq");
    expect(otraVez.status).toBe(404);
    expect(await otraVez.json()).toMatchObject({ codigo: "DOCUMENTO_NO_ENCONTRADO" });
  });

  it("si el servicio de IA falla al reemplazar, responde 503 y el documento anterior queda intacto", async () => {
    await cargar("calendario", { titulo: "Calendario", tipo: "calendario", contenido: CALENDARIO_VIEJO });
    const antes = await fragmentosDe("calendario");
    ai.falla = true;

    const respuesta = await cargar("calendario", { titulo: "Calendario", tipo: "calendario", contenido: CALENDARIO_NUEVO });

    expect(respuesta.status).toBe(503);
    expect(await respuesta.json()).toMatchObject({ codigo: "SERVICIO_IA_NO_DISPONIBLE" });
    expect(await fragmentosDe("calendario")).toEqual(antes);
  });

  it("si Vectorize falla al guardar, responde 503 para que el administrador vuelva a cargarlo", async () => {
    vectores.fallaAlGuardar = true;
    const respuesta = await cargar("reglamento", { titulo: "Reglamento", tipo: "reglamento", contenido: REGLAMENTO });
    expect(respuesta.status).toBe(503);
    expect(await respuesta.json()).toMatchObject({ codigo: "SERVICIO_IA_NO_DISPONIBLE" });
  });
});

describe("GET /api/documentos", () => {
  it("Documento indexado: lista los documentos con su carrera y el número de fragmentos indexados", async () => {
    await cargar("reglamento", { titulo: "Reglamento estudiantil", tipo: "reglamento", contenido: REGLAMENTO });
    await cargar("plan-tl-doc", { titulo: "Plan de estudios", tipo: "plan_estudios", carreraId, contenido: "## Semestre 1\n\nCursos." });

    const respuesta = await pedir(admin, "GET", "/documentos");

    expect(respuesta.status).toBe(200);
    const lista = await respuesta.json<DocumentoLista[]>();
    expect(lista.map(({ clave, fragmentos, carrera }) => ({ clave, fragmentos, carrera: carrera?.codigo ?? null }))).toEqual([
      { clave: "plan-tl-doc", fragmentos: 1, carrera: "TL-DOC" },
      { clave: "reglamento", fragmentos: fragmentarDocumento(REGLAMENTO).length, carrera: null },
    ]);
  });
});
