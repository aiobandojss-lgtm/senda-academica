import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { BYTES, crearCarrera, crearEstudiante, crearUsuario, llamar, llavesEnKV, sesionDe, subirArchivo } from "./utilidades";

// Tarea 4.2: archivo de apoyo de la actividad y entregas de los estudiantes (spec `actividades-entregas`,
// design.md D7 y D20)

const CONTRASENA = "Prueba2026*";
const aviso = () => env.AVISO_PRIVACIDAD_VERSION;

let tokenDocente: string;
let tokenOtroDocente: string;
let tokenEstudiante: string;
let tokenAjeno: string;
let cursoId: number;
let estudianteId: number;

type Entrega = { id: number | null; estado: string; tardia: boolean; entregadoEn: string | null; nombreArchivo: string | null; nota: number | null };
type Actividad = { id: number; fechaLimite: string; apoyo: { formato: string } | null; entrega?: Entrega };

const crearActividad = async (extra: Record<string, unknown> = {}) =>
  (
    await llamar(tokenDocente, "POST", `/cursos/${cursoId}/actividades`, {
      tipo: "taller",
      titulo: "Taller",
      instrucciones: "Resuelve.",
      fechaLimite: "2099-12-31T23:59",
      publicada: true,
      ...extra,
    })
  ).json<Actividad>();

const entregar = (actividadId: number, nombre: string, bytes: Uint8Array, token = tokenEstudiante) =>
  subirArchivo(token, `/actividades/${actividadId}/entrega`, nombre, bytes);

const filaEntrega = (actividadId: number) =>
  env.DB.prepare("SELECT id, archivo_key, entregado_en FROM entregas WHERE actividad_id = ? AND estudiante_id = ?")
    .bind(actividadId, estudianteId)
    .first<{ id: number; archivo_key: string; entregado_en: string }>();

beforeAll(async () => {
  const hash = await hashContrasena(CONTRASENA);
  await crearUsuario({ documento: "7370000001", rol: "admin", avisoVersion: aviso() }, hash);
  const docenteId = await crearUsuario({ documento: "7370000002", rol: "docente", avisoVersion: aviso() }, hash);
  await crearUsuario({ documento: "7370000003", rol: "docente", avisoVersion: aviso() }, hash);
  const carreraId = await crearCarrera("TL-ENT");
  const otra = await crearCarrera("TL-ENT-OTRA");
  estudianteId = await crearEstudiante({ documento: "7370000101", carreraId, semestre: 1 }, hash);
  await crearEstudiante({ documento: "7370000102", carreraId: otra, semestre: 1 }, hash);

  const admin = await sesionDe("7370000001", CONTRASENA);
  tokenDocente = await sesionDe("7370000002", CONTRASENA);
  tokenOtroDocente = await sesionDe("7370000003", CONTRASENA);
  tokenEstudiante = await sesionDe("7370000101", CONTRASENA);
  tokenAjeno = await sesionDe("7370000102", CONTRASENA);
  cursoId = (await (await llamar(admin, "POST", "/cursos", { carreraId, nombre: "Curso", semestre: 1, docenteId })).json<{ id: number }>()).id;
});

describe("POST /api/actividades/:id/entrega", () => {
  it("entrega válida: guarda el archivo con fecha y hora y la muestra como entregada", async () => {
    const actividad = await crearActividad();
    const pdf = new Uint8Array(2 * 1024 * 1024);
    pdf.set(BYTES.pdf);

    const respuesta = await entregar(actividad.id, "Mi taller.pdf", pdf);

    expect(respuesta.status).toBe(201);
    expect(await respuesta.json()).toMatchObject({ estado: "entregada", tardia: false, nombreArchivo: "Mi taller.pdf", nota: null });
    const fila = await filaEntrega(actividad.id);
    expect(fila?.archivo_key).toMatch(new RegExp(`^entregas/${actividad.id}/${estudianteId}/[0-9a-f-]{36}\\.pdf$`));
    expect(fila?.entregado_en).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(await llavesEnKV(`entregas/${actividad.id}/`)).toEqual([fila?.archivo_key]);
  });

  it("rechaza un archivo de más de 10 MB e indica el límite", async () => {
    const actividad = await crearActividad();
    const grande = new Uint8Array(10 * 1024 * 1024 + 1);
    grande.set(BYTES.pdf);

    const respuesta = await entregar(actividad.id, "grande.pdf", grande);

    expect(respuesta.status).toBe(400);
    const error = await respuesta.json<{ codigo: string; mensaje: string }>();
    expect(error.codigo).toBe("ARCHIVO_MUY_GRANDE");
    expect(error.mensaje).toContain("10 MB");
  });

  it("rechaza otro formato e indica los permitidos", async () => {
    const actividad = await crearActividad();

    const respuesta = await entregar(actividad.id, "notas.txt", BYTES.texto);

    expect(respuesta.status).toBe(400);
    const error = await respuesta.json<{ codigo: string; mensaje: string }>();
    expect(error.codigo).toBe("FORMATO_NO_PERMITIDO");
    expect(error.mensaje).toContain("PDF, DOCX, JPG o PNG");
  });

  it("archivo renombrado: un ejecutable con extensión .pdf se rechaza", async () => {
    const actividad = await crearActividad();

    const respuesta = await entregar(actividad.id, "tarea.pdf", BYTES.exe);

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ codigo: "FORMATO_NO_PERMITIDO" });
    expect(await llavesEnKV(`entregas/${actividad.id}/`)).toEqual([]);
  });

  it("reemplazar antes de la nota: el archivo nuevo reemplaza al anterior, que se elimina del almacenamiento", async () => {
    const actividad = await crearActividad();
    await entregar(actividad.id, "version1.pdf", BYTES.pdf);
    const antes = await filaEntrega(actividad.id);

    const respuesta = await entregar(actividad.id, "version2.png", BYTES.png);

    expect(respuesta.status).toBe(201);
    expect(await respuesta.json()).toMatchObject({ nombreArchivo: "version2.png", estado: "entregada" });
    const despues = await filaEntrega(actividad.id);
    expect(despues?.id).toBe(antes?.id);
    expect(despues?.archivo_key).not.toBe(antes?.archivo_key);
    expect(despues!.entregado_en >= antes!.entregado_en).toBe(true);
    expect(await llavesEnKV(`entregas/${actividad.id}/`)).toEqual([despues?.archivo_key]);
  });

  it("intentar reemplazar después de la nota: se rechaza y no deja archivos huérfanos", async () => {
    const actividad = await crearActividad();
    await entregar(actividad.id, "final.pdf", BYTES.pdf);
    const fila = await filaEntrega(actividad.id);
    await env.DB.prepare("UPDATE entregas SET nota = 4.0, calificado_en = '2026-11-20T15:00:00Z' WHERE id = ?").bind(fila?.id).run();

    const respuesta = await entregar(actividad.id, "otra.pdf", BYTES.pdf);

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ codigo: "ENTREGA_CALIFICADA" });
    expect(await llavesEnKV(`entregas/${actividad.id}/`)).toEqual([fila?.archivo_key]);
  });

  it("el trigger ENTREGA_CALIFICADA rechaza el cambio de archivo aunque se intente directo en SQL (D13)", async () => {
    const actividad = await crearActividad();
    await entregar(actividad.id, "final.pdf", BYTES.pdf);
    const fila = await filaEntrega(actividad.id);
    await env.DB.prepare("UPDATE entregas SET nota = 3.5 WHERE id = ?").bind(fila?.id).run();

    await expect(env.DB.prepare("UPDATE entregas SET archivo_key = 'otra/llave.pdf' WHERE id = ?").bind(fila?.id).run()).rejects.toThrow(
      /ENTREGA_CALIFICADA/,
    );
  });

  it("entrega fuera de plazo: queda marcada como tardía; si el docente amplía el plazo, deja de serlo (D20)", async () => {
    const actividad = await crearActividad({ fechaLimite: "2026-01-10T23:59" });

    const respuesta = await entregar(actividad.id, "tarde.pdf", BYTES.pdf);

    expect(await respuesta.json()).toMatchObject({ estado: "tardia", tardia: true });
    await llamar(tokenDocente, "PATCH", `/actividades/${actividad.id}`, { fechaLimite: "2099-01-10T23:59" });
    const vista = await (await llamar(tokenEstudiante, "GET", `/actividades/${actividad.id}`)).json<Actividad>();
    expect(vista.entrega).toMatchObject({ estado: "entregada", tardia: false });
  });

  it("no se entrega a un borrador, ni a un curso ajeno, ni siendo docente", async () => {
    const borrador = await crearActividad({ publicada: false });
    const publicada = await crearActividad();

    expect((await entregar(borrador.id, "a.pdf", BYTES.pdf)).status).toBe(404);
    expect((await entregar(publicada.id, "a.pdf", BYTES.pdf, tokenAjeno)).status).toBe(403);
    expect((await entregar(publicada.id, "a.pdf", BYTES.pdf, tokenDocente)).status).toBe(403);
  });

  it("al reemplazar una entrega del seed no borra su archivo, que comparten las demás entregas del seed", async () => {
    const actividad = await crearActividad();
    await env.ARCHIVOS_KV.put("seed/placeholder.pdf", BYTES.pdf, { metadata: { tipo: "application/pdf", tamano: BYTES.pdf.byteLength } });
    await env.DB.prepare(
      "INSERT INTO entregas (actividad_id, estudiante_id, archivo_key, nombre_archivo, tipo_mime, tamano_bytes, entregado_en) VALUES (?, ?, 'seed/placeholder.pdf', 'seed.pdf', 'application/pdf', 10, '2026-11-01T15:00:00Z')",
    )
      .bind(actividad.id, estudianteId)
      .run();

    expect((await entregar(actividad.id, "nueva.pdf", BYTES.pdf)).status).toBe(201);

    expect(await llavesEnKV("seed/")).toEqual(["seed/placeholder.pdf"]);
  });

  it("rechaza una petición sin archivo", async () => {
    const actividad = await crearActividad();

    const respuesta = await llamar(tokenEstudiante, "POST", `/actividades/${actividad.id}/entrega`, { archivo: "no" });

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ codigo: "ARCHIVO_REQUERIDO" });
  });
});

describe("archivo de apoyo de la actividad", () => {
  const apoyo = (actividadId: number, nombre: string, bytes: Uint8Array, token = tokenDocente) =>
    subirArchivo(token, `/actividades/${actividadId}/apoyo`, nombre, bytes, "PUT");

  it("el docente lo adjunta y al reemplazarlo se elimina el anterior", async () => {
    const actividad = await crearActividad();

    const primero = await apoyo(actividad.id, "enunciado.pdf", BYTES.pdf);
    expect(primero.status).toBe(200);
    expect(await primero.json()).toMatchObject({ apoyo: { formato: "pdf" } });
    const llaveInicial = await llavesEnKV(`apoyos/${actividad.id}/`);

    const segundo = await apoyo(actividad.id, "enunciado.docx", BYTES.docx);

    expect(await segundo.json()).toMatchObject({ apoyo: { formato: "docx" } });
    const llaves = await llavesEnKV(`apoyos/${actividad.id}/`);
    expect(llaves).toHaveLength(1);
    expect(llaves).not.toEqual(llaveInicial);
  });

  it("el docente lo quita y se elimina del almacenamiento", async () => {
    const actividad = await crearActividad();
    await apoyo(actividad.id, "enunciado.pdf", BYTES.pdf);

    const respuesta = await llamar(tokenDocente, "DELETE", `/actividades/${actividad.id}/apoyo`);

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ apoyo: null });
    expect(await llavesEnKV(`apoyos/${actividad.id}/`)).toEqual([]);
  });

  it("valida el formato por contenido y solo lo sube el docente del curso", async () => {
    const actividad = await crearActividad();

    expect((await apoyo(actividad.id, "virus.pdf", BYTES.exe)).status).toBe(400);
    expect((await apoyo(actividad.id, "enunciado.pdf", BYTES.pdf, tokenOtroDocente)).status).toBe(403);
    expect((await apoyo(actividad.id, "enunciado.pdf", BYTES.pdf, tokenEstudiante)).status).toBe(403);
  });
});
