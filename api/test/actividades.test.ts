import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { crearCarrera, crearEstudiante, crearUsuario, llamar, sesionDe } from "./utilidades";

// Tarea 4.1: actividades por curso (spec `actividades-entregas`, "Publicación de actividades" y "Edición de
// actividades") y la lista de cursos del estudiante

const CONTRASENA = "Prueba2026*";
const aviso = () => env.AVISO_PRIVACIDAD_VERSION;

let admin: string;
let tokenDocenteA: string;
let tokenDocenteB: string;
let tokenInscrito: string;
let tokenAjeno: string;
let cursoId: number;
let inscritoId: number;

type Actividad = {
  id: number;
  cursoId: number;
  tipo: "taller" | "evaluacion";
  titulo: string;
  instrucciones: string;
  fechaLimite: string;
  publicada: boolean;
  apoyo: { nombre: string } | null;
};

const nueva = (extra: Record<string, unknown> = {}) => ({
  tipo: "taller",
  titulo: "Taller 1: variables",
  instrucciones: "Resuelve los ejercicios del capítulo 2.",
  fechaLimite: "2026-11-23T23:59",
  ...extra,
});

const crear = async (extra: Record<string, unknown> = {}, token = tokenDocenteA) =>
  llamar(token, "POST", `/cursos/${cursoId}/actividades`, nueva(extra));

beforeAll(async () => {
  const hash = await hashContrasena(CONTRASENA);
  await crearUsuario({ documento: "7360000001", rol: "admin", avisoVersion: aviso() }, hash);
  const docenteA = await crearUsuario({ documento: "7360000002", rol: "docente", nombres: "Ana", avisoVersion: aviso() }, hash);
  await crearUsuario({ documento: "7360000003", rol: "docente", avisoVersion: aviso() }, hash);

  const carreraId = await crearCarrera("TL-ACT");
  const otraCarrera = await crearCarrera("TL-ACT-OTRA");
  inscritoId = await crearEstudiante({ documento: "7360000101", carreraId, semestre: 1 }, hash);
  await crearEstudiante({ documento: "7360000102", carreraId: otraCarrera, semestre: 1 }, hash);

  admin = await sesionDe("7360000001", CONTRASENA);
  tokenDocenteA = await sesionDe("7360000002", CONTRASENA);
  tokenDocenteB = await sesionDe("7360000003", CONTRASENA);
  tokenInscrito = await sesionDe("7360000101", CONTRASENA);
  tokenAjeno = await sesionDe("7360000102", CONTRASENA);

  // El curso se crea después del estudiante: queda inscrito (D15)
  cursoId = (await (await llamar(admin, "POST", "/cursos", { carreraId, nombre: "Lógica", semestre: 1, docenteId: docenteA })).json<{ id: number }>()).id;
});

describe("POST /api/cursos/:id/actividades", () => {
  it("Fecha límite en hora de Colombia: el docente crea un taller con fecha límite el 23 de noviembre a las 11:59 p. m. y queda guardada como las 4:59 a. m. del 24 en UTC", async () => {
    const respuesta = await crear();

    expect(respuesta.status).toBe(201);
    expect(await respuesta.json()).toMatchObject({
      cursoId,
      tipo: "taller",
      titulo: "Taller 1: variables",
      fechaLimite: "2026-11-24T04:59:00Z",
      publicada: false,
      apoyo: null,
    });
  });

  it("valida el tipo y la fecha límite, señalando el campo", async () => {
    const tipo = await crear({ tipo: "quiz" });
    const fecha = await crear({ fechaLimite: "23/11/2026" });

    expect(tipo.status).toBe(400);
    expect(await tipo.json()).toMatchObject({ campo: "tipo" });
    expect(await fecha.json()).toMatchObject({ campo: "fechaLimite" });
  });

  it("solo la crea el docente del curso", async () => {
    expect((await crear({}, tokenDocenteB)).status).toBe(403);
    expect((await crear({}, tokenInscrito)).status).toBe(403);
    expect((await crear({}, admin)).status).toBe(403);
  });
});

describe("borradores y publicación", () => {
  it("borrador no visible: el estudiante no lo ve en la lista ni lo puede abrir", async () => {
    const borrador = await (await crear({ titulo: "Borrador secreto" })).json<Actividad>();

    const lista = await (await llamar(tokenInscrito, "GET", `/cursos/${cursoId}/actividades`)).json<Actividad[]>();
    const directa = await llamar(tokenInscrito, "GET", `/actividades/${borrador.id}`);

    expect(lista.map((a) => a.id)).not.toContain(borrador.id);
    expect(directa.status).toBe(404);
  });

  it("publicar taller: el estudiante del curso lo ve con su fecha límite y sin entregar", async () => {
    const actividad = await (await crear({ titulo: "Taller publicado" })).json<Actividad>();

    const publicada = await llamar(tokenDocenteA, "PATCH", `/actividades/${actividad.id}`, { publicada: true });
    expect(publicada.status).toBe(200);

    const lista = await (await llamar(tokenInscrito, "GET", `/cursos/${cursoId}/actividades`)).json<(Actividad & { entrega: unknown })[]>();
    expect(lista.find((a) => a.id === actividad.id)).toMatchObject({
      titulo: "Taller publicado",
      fechaLimite: "2026-11-24T04:59:00Z",
      entrega: { estado: "sin_entregar", nota: null },
    });
    expect((await llamar(tokenInscrito, "GET", `/actividades/${actividad.id}`)).status).toBe(200);
  });

  it("el docente ve también sus borradores, con el conteo de entregas", async () => {
    const lista = await (await llamar(tokenDocenteA, "GET", `/cursos/${cursoId}/actividades`)).json<(Actividad & { entregas: number })[]>();

    expect(lista.some((a) => !a.publicada)).toBe(true);
    expect(lista.every((a) => typeof a.entregas === "number")).toBe(true);
  });

  it("volver a borrador sin entregas: deja de ser visible", async () => {
    const actividad = await (await crear({ titulo: "Publicada por error", publicada: true })).json<Actividad>();

    const respuesta = await llamar(tokenDocenteA, "PATCH", `/actividades/${actividad.id}`, { publicada: false });

    expect(respuesta.status).toBe(200);
    expect((await llamar(tokenInscrito, "GET", `/actividades/${actividad.id}`)).status).toBe(404);
  });

  it("volver a borrador con entregas: se rechaza", async () => {
    const actividad = await (await crear({ titulo: "Ya entregada", publicada: true })).json<Actividad>();
    await env.DB.prepare(
      "INSERT INTO entregas (actividad_id, estudiante_id, archivo_key, nombre_archivo, tipo_mime, tamano_bytes, entregado_en) VALUES (?, ?, 'x', 'x.pdf', 'application/pdf', 10, '2026-11-20T15:00:00Z')",
    )
      .bind(actividad.id, inscritoId)
      .run();

    const respuesta = await llamar(tokenDocenteA, "PATCH", `/actividades/${actividad.id}`, { publicada: false });

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ codigo: "ACTIVIDAD_CON_ENTREGAS" });
  });
});

describe("edición y permisos", () => {
  it("el docente edita el título y la fecha límite (en hora de Colombia)", async () => {
    const actividad = await (await crear()).json<Actividad>();

    const respuesta = await llamar(tokenDocenteA, "PATCH", `/actividades/${actividad.id}`, {
      titulo: "Taller 1 (corregido)",
      fechaLimite: "2026-11-25T18:00",
    });

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ titulo: "Taller 1 (corregido)", fechaLimite: "2026-11-25T23:00:00Z" });
  });

  it("otro docente no la edita ni ve las actividades del curso", async () => {
    const actividad = await (await crear()).json<Actividad>();

    expect((await llamar(tokenDocenteB, "PATCH", `/actividades/${actividad.id}`, { titulo: "No" })).status).toBe(403);
    expect((await llamar(tokenDocenteB, "GET", `/cursos/${cursoId}/actividades`)).status).toBe(403);
  });

  it("un estudiante que no está inscrito en el curso no ve sus actividades", async () => {
    expect((await llamar(tokenAjeno, "GET", `/cursos/${cursoId}/actividades`)).status).toBe(403);
  });

  it("el administrador consulta las actividades de cualquier curso", async () => {
    expect((await llamar(admin, "GET", `/cursos/${cursoId}/actividades`)).status).toBe(200);
  });

  it("un curso inexistente responde 404", async () => {
    expect((await llamar(tokenDocenteA, "GET", "/cursos/999999/actividades")).status).toBe(404);
  });
});

describe("GET /api/cursos (estudiante)", () => {
  it("el estudiante lista sus cursos con el nombre del docente, sin sus datos de contacto", async () => {
    const respuesta = await llamar(tokenInscrito, "GET", "/cursos");

    expect(respuesta.status).toBe(200);
    const cursos = await respuesta.json<Record<string, unknown>[]>();
    expect(cursos.map((c) => c.id)).toEqual([cursoId]);
    expect(cursos[0]).toMatchObject({ nombre: "Lógica", semestre: 1, docente: { nombres: "Ana" }, actual: true });
    expect(Object.keys(cursos[0].docente as object).sort()).toEqual(["apellidos", "nombres"]);
  });
});

describe("inicio del estudiante y del docente (tarea 4.4)", () => {
  it("pendientes del estudiante: publicadas sin entregar de sus cursos actuales, por fecha límite, con su avance", async () => {
    const lejana = await (await crear({ titulo: "Pendiente lejana", fechaLimite: "2099-12-01T10:00", publicada: true })).json<Actividad>();
    const cercana = await (await crear({ titulo: "Pendiente cercana", fechaLimite: "2099-01-01T10:00", publicada: true })).json<Actividad>();
    const borrador = await (await crear({ titulo: "Borrador oculto", fechaLimite: "2098-01-01T10:00" })).json<Actividad>();

    const respuesta = await llamar(tokenInscrito, "GET", "/actividades/pendientes");

    expect(respuesta.status).toBe(200);
    const { pendientes, publicadas, entregadas } = await respuesta.json<{
      pendientes: (Actividad & { curso: { id: number; nombre: string } })[];
      publicadas: number;
      entregadas: number;
    }>();
    const ids = pendientes.map((p) => p.id);
    expect(ids).not.toContain(borrador.id);
    expect(ids.indexOf(cercana.id)).toBeLessThan(ids.indexOf(lejana.id));
    expect(pendientes[0].curso).toEqual({ id: cursoId, nombre: "Lógica" });
    // Una de las publicadas ya tiene entrega (la de "volver a borrador con entregas")
    expect(entregadas).toBe(1);
    expect(publicadas).toBe(pendientes.length + entregadas);
  });

  it("solo los estudiantes tienen pendientes", async () => {
    expect((await llamar(tokenDocenteA, "GET", "/actividades/pendientes")).status).toBe(403);
  });

  it("el docente ve en sus cursos cuántas entregas tiene por calificar", async () => {
    const cursos = await (await llamar(tokenDocenteA, "GET", "/cursos")).json<{ id: number; porCalificar: number }[]>();

    expect(cursos.find((c) => c.id === cursoId)?.porCalificar).toBe(1);
  });
});
