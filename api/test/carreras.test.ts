import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { crearCarrera, crearEstudiante, crearUsuario, llamar, sesionDe } from "./utilidades";

// Tarea 3.1: catálogo de carreras (spec `carreras-estudiantes`). Solo el administrador.

const CONTRASENA = "Prueba2026*";
const ADMIN = { documento: "7310000001", rol: "admin" as const };
const DOCENTE = { documento: "7310000002", rol: "docente" as const };

let admin: string;
let docente: string;
let hash: string;

type Carrera = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  duracionSemestres: number;
  activa: boolean;
  estudiantesActivos: number;
  cursosActivos: number;
};

beforeAll(async () => {
  hash = await hashContrasena(CONTRASENA);
  await crearUsuario({ ...ADMIN, avisoVersion: env.AVISO_PRIVACIDAD_VERSION }, hash);
  await crearUsuario({ ...DOCENTE, avisoVersion: env.AVISO_PRIVACIDAD_VERSION }, hash);
  admin = await sesionDe(ADMIN.documento, CONTRASENA);
  docente = await sesionDe(DOCENTE.documento, CONTRASENA);
});

describe("POST /api/carreras", () => {
  it("crea la carrera con el código en mayúsculas y la devuelve", async () => {
    const respuesta = await llamar(admin, "POST", "/carreras", {
      codigo: " tl-mus ",
      nombre: "Técnico Laboral en Música",
      descripcion: "Forma músicos de base.",
      duracionSemestres: 4,
    });

    expect(respuesta.status).toBe(201);
    const carrera = await respuesta.json<Carrera>();
    expect(carrera).toMatchObject({
      codigo: "TL-MUS",
      nombre: "Técnico Laboral en Música",
      descripcion: "Forma músicos de base.",
      duracionSemestres: 4,
      activa: true,
      estudiantesActivos: 0,
      cursosActivos: 0,
    });
    expect(carrera.id).toBeGreaterThan(0);
  });

  it("rechaza un código repetido, aunque cambien las mayúsculas, e indica el código", async () => {
    await crearCarrera("TL-REP");

    const respuesta = await llamar(admin, "POST", "/carreras", { codigo: "tl-rep", nombre: "Otra", duracionSemestres: 2 });

    expect(respuesta.status).toBe(409);
    const error = await respuesta.json<{ codigo: string; mensaje: string }>();
    expect(error.codigo).toBe("CODIGO_CARRERA_REPETIDO");
    expect(error.mensaje).toContain("TL-REP");
  });

  it("dice qué campo está mal, en español", async () => {
    const respuesta = await llamar(admin, "POST", "/carreras", { codigo: "TL-X", nombre: "  ", duracionSemestres: 4 });

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({
      codigo: "SOLICITUD_INVALIDA",
      mensaje: "Escribe el nombre de la carrera",
      campo: "nombre",
    });
  });

  it("rechaza una duración fuera de 1 a 12 semestres", async () => {
    const respuesta = await llamar(admin, "POST", "/carreras", { codigo: "TL-LARGA", nombre: "Larga", duracionSemestres: 13 });

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ campo: "duracionSemestres" });
  });

  it("solo la usa el administrador", async () => {
    const respuesta = await llamar(docente, "POST", "/carreras", { codigo: "TL-DOC", nombre: "No", duracionSemestres: 2 });

    expect(respuesta.status).toBe(403);
  });
});

describe("GET /api/carreras", () => {
  it("lista las carreras con sus estudiantes y cursos activos", async () => {
    const carreraId = await crearCarrera("TL-LISTA");
    await crearEstudiante({ documento: "7310000101", carreraId, semestre: 1 }, hash);
    await crearEstudiante({ documento: "7310000102", carreraId, semestre: 1, activo: 0 }, hash);

    const respuesta = await llamar(admin, "GET", "/carreras");

    expect(respuesta.status).toBe(200);
    const carrera = (await respuesta.json<Carrera[]>()).find((c) => c.id === carreraId);
    expect(carrera).toMatchObject({ codigo: "TL-LISTA", estudiantesActivos: 1, cursosActivos: 0, activa: true });
  });
});

describe("PATCH /api/carreras/:id", () => {
  it("edita el nombre y la duración", async () => {
    const id = await crearCarrera("TL-EDIT");

    const respuesta = await llamar(admin, "PATCH", `/carreras/${id}`, { nombre: "Nombre nuevo", duracionSemestres: 6 });

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ id, nombre: "Nombre nuevo", duracionSemestres: 6 });
  });

  it("desactiva una carrera con estudiantes: sus estudiantes conservan su información", async () => {
    const id = await crearCarrera("TL-DESAC");
    await crearEstudiante({ documento: "7310000201", carreraId: id, semestre: 1 }, hash);

    const respuesta = await llamar(admin, "PATCH", `/carreras/${id}`, { activa: false });

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ id, activa: false, estudiantesActivos: 1 });
  });

  it("no deja la duración por debajo del semestre de un curso existente", async () => {
    const carreraId = await crearCarrera("TL-CORTA", { duracion: 4 });
    const docenteId = await crearUsuario({ documento: "7310000301", rol: "docente" }, hash);
    const curso = await llamar(admin, "POST", "/cursos", { carreraId, nombre: "Semestre 3", semestre: 3, docenteId });
    expect(curso.status).toBe(201);

    const respuesta = await llamar(admin, "PATCH", `/carreras/${carreraId}`, { duracionSemestres: 2 });

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ codigo: "DURACION_MENOR_QUE_CURSOS" });
  });

  it("responde 404 si la carrera no existe", async () => {
    const respuesta = await llamar(admin, "PATCH", "/carreras/999999", { nombre: "Nada" });

    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toMatchObject({ codigo: "CARRERA_NO_ENCONTRADA" });
  });

  it("rechaza un cuerpo sin cambios", async () => {
    const id = await crearCarrera("TL-VACIA");

    const respuesta = await llamar(admin, "PATCH", `/carreras/${id}`, {});

    expect(respuesta.status).toBe(400);
  });
});
