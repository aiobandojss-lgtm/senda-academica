import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { BYTES, crearCarrera, crearEstudiante, crearUsuario, llamar, sesionDe, subirArchivo } from "./utilidades";

// Tarea 4.3: descarga protegida de archivos, calificación y seguimiento del docente
// (spec `actividades-entregas`: "Seguimiento de entregas", "Calificación", "Acceso privado a los archivos")

const CONTRASENA = "Prueba2026*";
const aviso = () => env.AVISO_PRIVACIDAD_VERSION;

let admin: string;
let tokenDocente: string;
let tokenOtroDocente: string;
let tokenAutor: string;
let tokenCompanero: string;
let tokenAjeno: string;
let actividadId: number;
let entregaId: number;

type Fila = { estudiante: Record<string, unknown>; entrega: { id: number | null; estado: string; nota: number | null } };

const calificar = (cuerpo: Record<string, unknown>, token = tokenDocente) => llamar(token, "PUT", `/entregas/${entregaId}/calificacion`, cuerpo);
const descargar = (token: string, id = entregaId) => llamar(token, "GET", `/archivos/entregas/${id}`);

beforeAll(async () => {
  const hash = await hashContrasena(CONTRASENA);
  await crearUsuario({ documento: "7380000001", rol: "admin", avisoVersion: aviso() }, hash);
  const docenteId = await crearUsuario({ documento: "7380000002", rol: "docente", avisoVersion: aviso() }, hash);
  await crearUsuario({ documento: "7380000003", rol: "docente", avisoVersion: aviso() }, hash);
  const carreraId = await crearCarrera("TL-CAL");
  const otra = await crearCarrera("TL-CAL-OTRA");
  await crearEstudiante({ documento: "7380000101", carreraId, semestre: 1 }, hash);
  await crearEstudiante({ documento: "7380000102", carreraId, semestre: 1 }, hash);
  await crearEstudiante({ documento: "7380000103", carreraId: otra, semestre: 1 }, hash);

  admin = await sesionDe("7380000001", CONTRASENA);
  tokenDocente = await sesionDe("7380000002", CONTRASENA);
  tokenOtroDocente = await sesionDe("7380000003", CONTRASENA);
  tokenAutor = await sesionDe("7380000101", CONTRASENA);
  tokenCompanero = await sesionDe("7380000102", CONTRASENA);
  tokenAjeno = await sesionDe("7380000103", CONTRASENA);

  const cursoId = (await (await llamar(admin, "POST", "/cursos", { carreraId, nombre: "Curso", semestre: 1, docenteId })).json<{ id: number }>()).id;
  actividadId = (
    await (
      await llamar(tokenDocente, "POST", `/cursos/${cursoId}/actividades`, {
        tipo: "taller",
        titulo: "Taller 3: memoria",
        instrucciones: "Entrega tu informe.",
        fechaLimite: "2099-12-31T23:59",
        publicada: true,
      })
    ).json<{ id: number }>()
  ).id;
  const entrega = await subirArchivo(tokenAutor, `/actividades/${actividadId}/entrega`, "Mi taller ñandú.pdf", BYTES.pdf);
  entregaId = (await entrega.json<{ id: number }>()).id;
});

describe("GET /api/actividades/:id/entregas (seguimiento del docente)", () => {
  it("revisar quién entregó: todos los estudiantes del curso con su estado, sin datos de contacto (D18)", async () => {
    const respuesta = await llamar(tokenDocente, "GET", `/actividades/${actividadId}/entregas`);

    expect(respuesta.status).toBe(200);
    const filas = await respuesta.json<Fila[]>();
    expect(filas.map((f) => f.entrega.estado).sort()).toEqual(["entregada", "sin_entregar"]);
    for (const fila of filas) {
      expect(Object.keys(fila.estudiante).sort()).toEqual(["apellidos", "id", "nombres"]);
    }
    const texto = JSON.stringify(filas);
    expect(texto).not.toContain("7380000101");
    expect(texto).not.toContain("@correo.test");
  });

  it("otro docente y los estudiantes no la ven", async () => {
    expect((await llamar(tokenOtroDocente, "GET", `/actividades/${actividadId}/entregas`)).status).toBe(403);
    expect((await llamar(tokenAutor, "GET", `/actividades/${actividadId}/entregas`)).status).toBe(403);
  });
});

describe("GET /api/archivos/entregas/:id (descarga protegida)", () => {
  it("el autor descarga su archivo, como adjunto, sin caché y con el nombre original", async () => {
    const respuesta = await descargar(tokenAutor);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Content-Type")).toBe("application/pdf");
    expect(respuesta.headers.get("Cache-Control")).toBe("private, no-store");
    expect(respuesta.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const disposicion = respuesta.headers.get("Content-Disposition") ?? "";
    expect(disposicion).toContain("attachment");
    expect(disposicion).toContain('filename="Mi taller nandu.pdf"');
    expect(disposicion).toContain("filename*=UTF-8''Mi%20taller%20%C3%B1and%C3%BA.pdf");
    expect(new Uint8Array(await respuesta.arrayBuffer())).toEqual(BYTES.pdf);
  });

  it("el docente del curso y el administrador también lo descargan", async () => {
    expect((await descargar(tokenDocente)).status).toBe(200);
    expect((await descargar(admin)).status).toBe(200);
  });

  it("estudiante intenta descargar la entrega de otro: acceso denegado", async () => {
    const respuesta = await descargar(tokenCompanero);

    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ codigo: "ACCESO_DENEGADO" });
  });

  it("otro docente tampoco, y una entrega inexistente responde 404", async () => {
    expect((await descargar(tokenOtroDocente)).status).toBe(403);
    expect((await descargar(admin, 999999)).status).toBe(404);
  });
});

describe("PUT /api/entregas/:id/calificacion", () => {
  it("calificar entrega: el estudiante ve la nota 4.2 y el comentario", async () => {
    const respuesta = await calificar({ nota: 4.2, comentario: "Buen análisis; revisa las citas." });

    expect(respuesta.status).toBe(200);
    const vista = await (await llamar(tokenAutor, "GET", `/actividades/${actividadId}`)).json<{ entrega: Record<string, unknown> }>();
    expect(vista.entrega).toMatchObject({ estado: "calificada", nota: 4.2, comentario: "Buen análisis; revisa las citas." });
  });

  it("nota fuera de rango: rechaza 5.5, -1 y 4.25, e indica el rango 0.0 a 5.0", async () => {
    for (const nota of [5.5, -1, 4.25]) {
      const respuesta = await calificar({ nota });
      expect(respuesta.status).toBe(400);
      const error = await respuesta.json<{ codigo: string; mensaje: string; campo: string }>();
      expect(error).toMatchObject({ codigo: "NOTA_FUERA_DE_RANGO", campo: "nota" });
      expect(error.mensaje).toContain("0.0 a 5.0");
    }
  });

  it("corregir una nota: el estudiante ve la nueva y su entrega sigue sin poder reemplazarse", async () => {
    await calificar({ nota: 4.2 });

    expect((await calificar({ nota: 4.5 })).status).toBe(200);

    const vista = await (await llamar(tokenAutor, "GET", `/actividades/${actividadId}`)).json<{ entrega: { nota: number } }>();
    expect(vista.entrega.nota).toBe(4.5);
    expect((await subirArchivo(tokenAutor, `/actividades/${actividadId}/entrega`, "otra.pdf", BYTES.pdf)).status).toBe(409);
  });

  it("Docente intenta calificar un curso ajeno: solo califica el docente del curso", async () => {
    expect((await calificar({ nota: 3 }, tokenOtroDocente)).status).toBe(403);
    expect((await calificar({ nota: 5 }, tokenAutor)).status).toBe(403);
    expect((await calificar({ nota: 5 }, admin)).status).toBe(403);
  });
});

describe("GET /api/archivos/apoyos/:actividadId", () => {
  it("Estudiante de otro curso pide un archivo de apoyo: lo descargan los estudiantes del curso, pero no uno de otro curso", async () => {
    await subirArchivo(tokenDocente, `/actividades/${actividadId}/apoyo`, "enunciado.pdf", BYTES.pdf, "PUT");

    const delCurso = await llamar(tokenCompanero, "GET", `/archivos/apoyos/${actividadId}`);
    const ajeno = await llamar(tokenAjeno, "GET", `/archivos/apoyos/${actividadId}`);

    expect(delCurso.status).toBe(200);
    expect(delCurso.headers.get("Content-Disposition")).toContain("attachment");
    expect(ajeno.status).toBe(403);
  });

  it("una actividad sin archivo de apoyo responde 404", async () => {
    await llamar(tokenDocente, "DELETE", `/actividades/${actividadId}/apoyo`);

    expect((await llamar(tokenCompanero, "GET", `/archivos/apoyos/${actividadId}`)).status).toBe(404);
  });
});
