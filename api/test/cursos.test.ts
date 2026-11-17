import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { crearCarrera, crearEstudiante, crearUsuario, inscritosEn, llamar, sesionDe } from "./utilidades";

// Tarea 3.1: cursos por carrera, edición y la inscripción automática al crear o reactivar un curso
// (spec `carreras-estudiantes`, design.md D15 y D18)

const CONTRASENA = "Prueba2026*";
const aviso = () => env.AVISO_PRIVACIDAD_VERSION;

let hash: string;
let admin: string;
let tokenDocenteA: string;
let tokenDocenteB: string;
let tokenEstudiante: string;
let carreraId: number;
let docenteA: number;
let docenteB: number;
let docenteInactivo: number;
const estudiantes: Record<string, number> = {};

type CursoAdmin = {
  id: number;
  nombre: string;
  semestre: number;
  activo: boolean;
  carrera: { id: number; codigo: string; nombre: string };
  docente: { id: number; nombres: string; apellidos: string; activo: boolean } | null;
  inscritos: number;
};

const crearCurso = (cuerpo: Record<string, unknown>) =>
  llamar(admin, "POST", "/cursos", { carreraId, nombre: "Curso de prueba", semestre: 1, docenteId: docenteA, ...cuerpo });

beforeAll(async () => {
  hash = await hashContrasena(CONTRASENA);
  await crearUsuario({ documento: "7320000001", rol: "admin", avisoVersion: aviso() }, hash);
  docenteA = await crearUsuario({ documento: "7320000002", rol: "docente", nombres: "Ana", avisoVersion: aviso() }, hash);
  docenteB = await crearUsuario({ documento: "7320000003", rol: "docente", nombres: "Bruno", avisoVersion: aviso() }, hash);
  docenteInactivo = await crearUsuario({ documento: "7320000004", rol: "docente", activo: 0 }, hash);

  // Carrera de 4 semestres con estudiantes registrados ANTES de que existan sus cursos
  carreraId = await crearCarrera("TL-CUR", { duracion: 4 });
  estudiantes.primeroA = await crearEstudiante({ documento: "7320000101", carreraId, semestre: 1 }, hash);
  estudiantes.primeroB = await crearEstudiante({ documento: "7320000102", carreraId, semestre: 1 }, hash);
  estudiantes.primeroRetirado = await crearEstudiante({ documento: "7320000103", carreraId, semestre: 1, activo: 0 }, hash);
  estudiantes.segundo = await crearEstudiante({ documento: "7320000104", carreraId, semestre: 2 }, hash);

  admin = await sesionDe("7320000001", CONTRASENA);
  tokenDocenteA = await sesionDe("7320000002", CONTRASENA);
  tokenDocenteB = await sesionDe("7320000003", CONTRASENA);
  tokenEstudiante = await sesionDe("7320000101", CONTRASENA);
});

describe("POST /api/cursos", () => {
  it("curso creado después de registrar a los estudiantes: inscribe a los activos de su semestre", async () => {
    const respuesta = await crearCurso({ nombre: "Fundamentos", semestre: 1 });

    expect(respuesta.status).toBe(201);
    const curso = await respuesta.json<CursoAdmin>();
    expect(curso).toMatchObject({
      nombre: "Fundamentos",
      semestre: 1,
      activo: true,
      carrera: { id: carreraId, codigo: "TL-CUR" },
      docente: { id: docenteA, nombres: "Ana", activo: true },
      inscritos: 2,
    });
    // Ni el retirado (desactivado) ni el de segundo semestre
    expect(await inscritosEn(curso.id)).toEqual([estudiantes.primeroA, estudiantes.primeroB]);
  });

  it("rechaza un semestre fuera de la carrera e indica los válidos", async () => {
    const respuesta = await crearCurso({ semestre: 6 });

    expect(respuesta.status).toBe(400);
    const error = await respuesta.json<{ codigo: string; mensaje: string }>();
    expect(error.codigo).toBe("SEMESTRE_FUERA_DE_CARRERA");
    expect(error.mensaje).toContain("1 al 4");
  });

  it("rechaza una carrera desactivada", async () => {
    const inactiva = await crearCarrera("TL-INACT", { activa: 0 });

    const respuesta = await crearCurso({ carreraId: inactiva });

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ codigo: "CARRERA_INACTIVA" });
  });

  it("rechaza una carrera que no existe", async () => {
    const respuesta = await crearCurso({ carreraId: 999999 });

    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toMatchObject({ codigo: "CARRERA_NO_ENCONTRADA" });
  });

  it("rechaza un docente desactivado", async () => {
    const respuesta = await crearCurso({ docenteId: docenteInactivo });

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ codigo: "DOCENTE_INACTIVO" });
  });

  it("rechaza como docente a alguien que no es docente", async () => {
    const respuesta = await crearCurso({ docenteId: estudiantes.primeroA });

    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toMatchObject({ codigo: "DOCENTE_NO_ENCONTRADO" });
  });

  it("solo la usa el administrador", async () => {
    const respuesta = await llamar(tokenDocenteA, "POST", "/cursos", { carreraId, nombre: "No", semestre: 1, docenteId: docenteA });

    expect(respuesta.status).toBe(403);
  });
});

describe("asignar docente", () => {
  it("el curso aparece en la lista del docente asignado, y al reasignarlo pasa al otro", async () => {
    const curso = await (await crearCurso({ nombre: "Asignado a Ana", semestre: 2 })).json<CursoAdmin>();

    const deAna = await (await llamar(tokenDocenteA, "GET", "/cursos")).json<{ id: number }[]>();
    expect(deAna.map((c) => c.id)).toContain(curso.id);

    const reasignado = await llamar(admin, "PATCH", `/cursos/${curso.id}`, { docenteId: docenteB });
    expect(reasignado.status).toBe(200);
    expect(await reasignado.json()).toMatchObject({ docente: { id: docenteB } });

    const deAnaDespues = await (await llamar(tokenDocenteA, "GET", "/cursos")).json<{ id: number }[]>();
    const deBruno = await (await llamar(tokenDocenteB, "GET", "/cursos")).json<{ id: number }[]>();
    expect(deAnaDespues.map((c) => c.id)).not.toContain(curso.id);
    expect(deBruno.map((c) => c.id)).toContain(curso.id);
  });

  it("el docente recibe solo los datos de sus cursos, sin datos de otros docentes (D18)", async () => {
    const lista = await (await llamar(tokenDocenteB, "GET", "/cursos")).json<Record<string, unknown>[]>();

    expect(lista.length).toBeGreaterThan(0);
    for (const curso of lista) {
      expect(Object.keys(curso).sort()).toEqual(["carrera", "id", "inscritos", "nombre", "porCalificar", "semestre"]);
    }
  });

  // Desde la tarea 4.1, el estudiante recibe aquí los cursos en que está inscrito
  it("el estudiante recibe solo los cursos en que está inscrito", async () => {
    const lista = await (await llamar(tokenEstudiante, "GET", "/cursos")).json<{ id: number; semestre: number }[]>();

    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((c) => c.semestre === 1)).toBe(true);
  });
});

describe("PATCH /api/cursos/:id", () => {
  it("no permite cambiar el semestre ni la carrera de un curso creado", async () => {
    const curso = await (await crearCurso({ nombre: "Semestre fijo" })).json<CursoAdmin>();

    const semestre = await llamar(admin, "PATCH", `/cursos/${curso.id}`, { semestre: 2 });
    const carrera = await llamar(admin, "PATCH", `/cursos/${curso.id}`, { carreraId: await crearCarrera("TL-OTRA") });

    expect(semestre.status).toBe(400);
    expect(await semestre.json()).toMatchObject({ codigo: "SOLICITUD_INVALIDA", campo: "semestre" });
    expect(carrera.status).toBe(400);
    expect(await carrera.json()).toMatchObject({ campo: "carreraId" });
  });

  it("al desactivar un curso conserva sus inscripciones", async () => {
    const curso = await (await crearCurso({ nombre: "Se desactiva" })).json<CursoAdmin>();

    const respuesta = await llamar(admin, "PATCH", `/cursos/${curso.id}`, { activo: false });

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ activo: false, inscritos: 2 });
    expect(await inscritosEn(curso.id)).toEqual([estudiantes.primeroA, estudiantes.primeroB]);
  });

  it("curso reactivado: inscribe a los estudiantes que llegaron mientras estaba inactivo", async () => {
    const curso = await (await crearCurso({ nombre: "Se reactiva", semestre: 2 })).json<CursoAdmin>();
    expect(await inscritosEn(curso.id)).toEqual([estudiantes.segundo]);
    await llamar(admin, "PATCH", `/cursos/${curso.id}`, { activo: false });
    // Pasa a segundo semestre mientras el curso está inactivo: nadie lo inscribe
    const nuevo = await crearEstudiante({ documento: "7320000201", carreraId, semestre: 2 }, hash);

    const respuesta = await llamar(admin, "PATCH", `/cursos/${curso.id}`, { activo: true });

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ activo: true, inscritos: 2 });
    expect(await inscritosEn(curso.id)).toEqual([estudiantes.segundo, nuevo]);
  });

  it("rechaza un docente desactivado al reasignar", async () => {
    const curso = await (await crearCurso({ nombre: "Reasignar" })).json<CursoAdmin>();

    const respuesta = await llamar(admin, "PATCH", `/cursos/${curso.id}`, { docenteId: docenteInactivo });

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ codigo: "DOCENTE_INACTIVO" });
  });

  it("responde 404 si el curso no existe", async () => {
    const respuesta = await llamar(admin, "PATCH", "/cursos/999999", { nombre: "Nada" });

    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toMatchObject({ codigo: "CURSO_NO_ENCONTRADO" });
  });
});

describe("GET /api/cursos (administrador)", () => {
  it("lista todos los cursos y filtra por carrera", async () => {
    const otra = await crearCarrera("TL-FILTRO");
    await llamar(admin, "POST", "/cursos", { carreraId: otra, nombre: "De otra carrera", semestre: 1, docenteId: docenteB });

    const todos = await (await llamar(admin, "GET", "/cursos")).json<CursoAdmin[]>();
    const filtrados = await (await llamar(admin, "GET", `/cursos?carrera=${otra}`)).json<CursoAdmin[]>();

    expect(todos.some((c) => c.carrera.id === carreraId) && todos.some((c) => c.carrera.id === otra)).toBe(true);
    expect(filtrados.map((c) => c.nombre)).toEqual(["De otra carrera"]);
  });
});
