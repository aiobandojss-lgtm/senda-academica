import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { hashContrasena } from "../src/seguridad/contrasenas";
import {
  conCookie,
  crearCarrera,
  crearCuota,
  crearEstudiante,
  crearExcepcion,
  crearUsuario,
  fechaDesdeHoy,
  ingresar,
  inscritosEn,
  llamar,
  pedir,
  sesionDe,
} from "./utilidades";

// Tarea 3.2: registro, edición, búsqueda y desactivación de estudiantes, con inscripción automática (D15)
// y proyecciones por rol (D18). Spec `carreras-estudiantes` y `autenticacion` ("Docente consulta sus estudiantes").

const CONTRASENA = "Prueba2026*";
const aviso = () => env.AVISO_PRIVACIDAD_VERSION;

let hash: string;
let admin: string;
let adminId: number;
let tokenDocenteA: string;
let tokenDocenteB: string;
let carreraId: number;
const cursos: Record<string, number> = {};

type Estudiante = {
  id: number;
  tipoDocumento: string;
  documento: string;
  nombres: string;
  apellidos: string;
  correo: string;
  celular: string | null;
  activo: boolean;
  carrera: { id: number; codigo: string; nombre: string };
  semestreActual: number;
  cohorte: string;
  fechaIngreso: string;
  estadoCartera: string;
};

const nuevo = (documento: string, extra: Record<string, unknown> = {}) => ({
  tipoDocumento: "CC",
  documento,
  nombres: "Paola Andrea",
  apellidos: "Zapata Arango",
  correo: `${documento}@correo.test`,
  carreraId,
  semestre: 1,
  cohorte: "2026-2",
  fechaIngreso: "2026-08-03",
  ...extra,
});

const registrar = async (cuerpo: Record<string, unknown>) => {
  const respuesta = await llamar(admin, "POST", "/estudiantes", cuerpo);
  return { respuesta, cuerpo: (await respuesta.clone().json()) as { estudiante: Estudiante; contrasenaTemporal: string } };
};

const crearCurso = async (nombre: string, semestre: number, docenteId: number, activo = true) => {
  const curso = await (await llamar(admin, "POST", "/cursos", { carreraId, nombre, semestre, docenteId })).json<{ id: number }>();
  if (!activo) await llamar(admin, "PATCH", `/cursos/${curso.id}`, { activo: false });
  return curso.id;
};

beforeAll(async () => {
  hash = await hashContrasena(CONTRASENA);
  adminId = await crearUsuario({ documento: "7340000001", rol: "admin", avisoVersion: aviso() }, hash);
  const docenteA = await crearUsuario({ documento: "7340000002", rol: "docente", avisoVersion: aviso() }, hash);
  const docenteB = await crearUsuario({ documento: "7340000003", rol: "docente", avisoVersion: aviso() }, hash);
  admin = await sesionDe("7340000001", CONTRASENA);
  tokenDocenteA = await sesionDe("7340000002", CONTRASENA);
  tokenDocenteB = await sesionDe("7340000003", CONTRASENA);

  // Carrera con cursos ANTES de registrar a los estudiantes
  carreraId = await crearCarrera("TL-EST", { duracion: 4 });
  cursos.primeroA = await crearCurso("Primero de Ana", 1, docenteA);
  cursos.primeroB = await crearCurso("Primero de Bruno", 1, docenteB);
  cursos.primeroInactivo = await crearCurso("Primero inactivo", 1, docenteA, false);
  cursos.segundo = await crearCurso("Segundo de Ana", 2, docenteA);
});

describe("POST /api/estudiantes", () => {
  it("registra al estudiante con contraseña temporal y lo inscribe en los cursos activos de su semestre", async () => {
    const { respuesta, cuerpo } = await registrar(nuevo("7340000101", { celular: "310 555 0101" }));

    expect(respuesta.status).toBe(201);
    expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
    expect(cuerpo.estudiante).toMatchObject({
      documento: "7340000101",
      nombres: "Paola Andrea",
      celular: "3105550101",
      activo: true,
      carrera: { id: carreraId, codigo: "TL-EST" },
      semestreActual: 1,
      cohorte: "2026-2",
      fechaIngreso: "2026-08-03",
      estadoCartera: "al_dia",
    });
    expect(cuerpo.contrasenaTemporal).toHaveLength(10);

    const id = cuerpo.estudiante.id;
    expect(await inscritosEn(cursos.primeroA)).toContain(id);
    expect(await inscritosEn(cursos.primeroB)).toContain(id);
    expect(await inscritosEn(cursos.primeroInactivo)).not.toContain(id);
    expect(await inscritosEn(cursos.segundo)).not.toContain(id);

    const fila = await env.DB.prepare("SELECT password_hash, debe_cambiar_password FROM usuarios WHERE id = ?")
      .bind(id)
      .first<{ password_hash: string; debe_cambiar_password: number }>();
    expect(fila?.debe_cambiar_password).toBe(1);
    expect(fila?.password_hash).not.toContain(cuerpo.contrasenaTemporal);
    expect((await ingresar("7340000101", cuerpo.contrasenaTemporal)).status).toBe(200);
  });

  it("rechaza un documento ya registrado e indica cuál", async () => {
    const { respuesta } = await registrar(nuevo("7340000002"));

    expect(respuesta.status).toBe(409);
    const error = await respuesta.json<{ codigo: string; mensaje: string }>();
    expect(error.codigo).toBe("DOCUMENTO_REPETIDO");
    expect(error.mensaje).toContain("7340000002");
  });

  it("rechaza una carrera desactivada y un semestre fuera de la carrera", async () => {
    const inactiva = await crearCarrera("TL-EST-OFF", { activa: 0 });

    const enInactiva = await registrar(nuevo("7340000102", { carreraId: inactiva }));
    const fuera = await registrar(nuevo("7340000103", { semestre: 5 }));

    expect(enInactiva.respuesta.status).toBe(409);
    expect(await enInactiva.respuesta.json()).toMatchObject({ codigo: "CARRERA_INACTIVA" });
    expect(fuera.respuesta.status).toBe(400);
    expect(await fuera.respuesta.json()).toMatchObject({ codigo: "SEMESTRE_FUERA_DE_CARRERA" });
  });

  it("valida la cohorte y la fecha de ingreso", async () => {
    const cohorte = await registrar(nuevo("7340000104", { cohorte: "2026" }));
    const fecha = await registrar(nuevo("7340000105", { fechaIngreso: "03/08/2026" }));

    expect(await cohorte.respuesta.json()).toMatchObject({ campo: "cohorte" });
    expect(await fecha.respuesta.json()).toMatchObject({ campo: "fechaIngreso" });
  });
});

describe("PATCH /api/estudiantes/:id", () => {
  it("cambio de semestre: queda inscrito en los cursos nuevos y conserva los anteriores", async () => {
    const { cuerpo } = await registrar(nuevo("7340000201"));
    const id = cuerpo.estudiante.id;

    const respuesta = await llamar(admin, "PATCH", `/estudiantes/${id}`, { semestreActual: 2 });

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ id, semestreActual: 2 });
    expect(await inscritosEn(cursos.segundo)).toContain(id);
    expect(await inscritosEn(cursos.primeroA)).toContain(id);
  });

  it("no cambia a un semestre que la carrera no tiene", async () => {
    const { cuerpo } = await registrar(nuevo("7340000202"));

    const respuesta = await llamar(admin, "PATCH", `/estudiantes/${cuerpo.estudiante.id}`, { semestreActual: 9 });

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ codigo: "SEMESTRE_FUERA_DE_CARRERA" });
  });

  it("edita sus datos personales", async () => {
    const { cuerpo } = await registrar(nuevo("7340000203"));

    const respuesta = await llamar(admin, "PATCH", `/estudiantes/${cuerpo.estudiante.id}`, {
      apellidos: "Zapata Ríos",
      correo: "nuevo@correo.test",
      celular: "",
    });

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ apellidos: "Zapata Ríos", correo: "nuevo@correo.test", celular: null });
  });

  it("responde 404 si el id no es de un estudiante", async () => {
    const respuesta = await llamar(admin, "PATCH", `/estudiantes/${adminId}`, { nombres: "Otro" });

    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toMatchObject({ codigo: "ESTUDIANTE_NO_ENCONTRADO" });
  });
});

describe("GET /api/estudiantes: búsqueda y filtros", () => {
  it("busca por número de documento", async () => {
    await registrar(nuevo("7340000301"));

    const lista = await (await llamar(admin, "GET", "/estudiantes?q=7340000301")).json<Estudiante[]>();

    expect(lista.map((e) => e.documento)).toEqual(["7340000301"]);
  });

  it("busca por nombre sin importar tildes ni mayúsculas", async () => {
    await registrar(nuevo("7340000302", { nombres: "Angie Paola", apellidos: "Muñoz González" }));

    const lista = await (await llamar(admin, "GET", "/estudiantes?q=MUNOZ%20gonzalez")).json<Estudiante[]>();

    expect(lista.map((e) => e.documento)).toEqual(["7340000302"]);
  });

  it("filtra por carrera", async () => {
    const otra = await crearCarrera("TL-EST-OTRA");
    await registrar(nuevo("7340000303", { carreraId: otra }));

    const lista = await (await llamar(admin, "GET", `/estudiantes?carrera=${otra}`)).json<Estudiante[]>();

    expect(lista.map((e) => e.documento)).toEqual(["7340000303"]);
  });

  it("filtra por estado de cartera: bloqueado, con excepción, en riesgo y al día", async () => {
    const cartera = await crearCarrera("TL-CARTERA");
    const bloqueado = await crearEstudiante({ documento: "7340000401", carreraId: cartera, semestre: 1 }, hash);
    const conExcepcion = await crearEstudiante({ documento: "7340000402", carreraId: cartera, semestre: 1 }, hash);
    const enRiesgo = await crearEstudiante({ documento: "7340000403", carreraId: cartera, semestre: 1 }, hash);
    await crearEstudiante({ documento: "7340000404", carreraId: cartera, semestre: 1 }, hash);
    await crearCuota(bloqueado, fechaDesdeHoy(-45));
    await crearCuota(conExcepcion, fechaDesdeHoy(-45));
    await crearExcepcion(conExcepcion, fechaDesdeHoy(10), adminId);
    await crearCuota(enRiesgo, fechaDesdeHoy(-10));

    const porEstado = async (estado: string) =>
      (await (await llamar(admin, "GET", `/estudiantes?carrera=${cartera}&estado=${estado}`)).json<Estudiante[]>()).map((e) => e.documento);

    expect(await porEstado("bloqueado")).toEqual(["7340000401"]);
    expect(await porEstado("con_excepcion")).toEqual(["7340000402"]);
    expect(await porEstado("en_riesgo")).toEqual(["7340000403"]);
    expect(await porEstado("al_dia")).toEqual(["7340000404"]);
  });

  it("rechaza un estado de cartera desconocido", async () => {
    const respuesta = await llamar(admin, "GET", "/estudiantes?estado=moroso");

    expect(respuesta.status).toBe(400);
  });

  it("solo la usa el administrador", async () => {
    expect((await llamar(tokenDocenteA, "GET", "/estudiantes")).status).toBe(403);
  });
});

describe("desactivar y reactivar un estudiante", () => {
  it("estudiante retirado: no ingresa, pierde su sesión y conserva su información e inscripciones", async () => {
    const { cuerpo } = await registrar(nuevo("7340000501"));
    const id = cuerpo.estudiante.id;
    await env.DB.prepare("UPDATE usuarios SET debe_cambiar_password = 0, aviso_version_aceptada = ?, aviso_aceptado_en = '2026-11-01T12:00:00Z', password_hash = ? WHERE id = ?")
      .bind(aviso(), hash, id)
      .run();
    const sesion = await sesionDe("7340000501", CONTRASENA);

    expect((await llamar(admin, "POST", `/usuarios/${id}/desactivar`)).status).toBe(200);

    expect((await pedir("/auth/yo", conCookie(sesion))).status).toBe(401);
    expect((await ingresar("7340000501", CONTRASENA)).status).toBe(403);
    const lista = await (await llamar(admin, "GET", "/estudiantes?q=7340000501")).json<Estudiante[]>();
    expect(lista[0]).toMatchObject({ id, activo: false, semestreActual: 1 });
    expect(await inscritosEn(cursos.primeroA)).toContain(id);
  });

  it("al reactivarlo queda inscrito en los cursos creados mientras estaba inactivo", async () => {
    const { cuerpo } = await registrar(nuevo("7340000502", { semestre: 3 }));
    const id = cuerpo.estudiante.id;
    await llamar(admin, "POST", `/usuarios/${id}/desactivar`);
    const docenteId = await crearUsuario({ documento: "7340000503", rol: "docente" }, hash);
    const nuevoCurso = await crearCurso("Tercero nuevo", 3, docenteId);
    expect(await inscritosEn(nuevoCurso)).not.toContain(id);

    const respuesta = await llamar(admin, "POST", `/usuarios/${id}/reactivar`);

    expect(respuesta.status).toBe(200);
    expect(await inscritosEn(nuevoCurso)).toContain(id);
  });
});

describe("GET /api/cursos/:id/estudiantes", () => {
  it("el docente del curso recibe nombres y apellidos, sin documento, correo ni celular (D18)", async () => {
    await registrar(nuevo("7340000601", { celular: "3005550601" }));

    const respuesta = await llamar(tokenDocenteA, "GET", `/cursos/${cursos.primeroA}/estudiantes`);

    expect(respuesta.status).toBe(200);
    const lista = await respuesta.json<Record<string, unknown>[]>();
    expect(lista.length).toBeGreaterThan(0);
    for (const estudiante of lista) {
      expect(Object.keys(estudiante).sort()).toEqual(["apellidos", "id", "nombres"]);
    }
    expect(JSON.stringify(lista)).not.toContain("7340000601");
  });

  it("el docente de otro curso no la puede ver", async () => {
    const respuesta = await llamar(tokenDocenteB, "GET", `/cursos/${cursos.primeroA}/estudiantes`);

    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ codigo: "ACCESO_DENEGADO" });
  });

  it("el administrador sí la ve, y un curso inexistente responde 404", async () => {
    expect((await llamar(admin, "GET", `/cursos/${cursos.primeroA}/estudiantes`)).status).toBe(200);
    expect((await llamar(admin, "GET", "/cursos/999999/estudiantes")).status).toBe(404);
  });
});
