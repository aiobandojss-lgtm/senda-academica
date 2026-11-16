import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { conCookie, crearCarrera, crearUsuario, ingresar, inscritosEn, llamar, pedir, sesionDe } from "./utilidades";

// Tarea 3.3: carga masiva de estudiantes por CSV, todo o nada (spec `carreras-estudiantes`, design.md D8 y D17)

const CONTRASENA = "Prueba2026*";
const COLUMNAS = "tipo_documento;documento;nombres;apellidos;correo;celular;codigo_carrera;semestre;cohorte;fecha_ingreso";

let admin: string;
let tokenDocente: string;
let cursoPrimero: number;

type ErrorCarga = { codigo: string; mensaje: string; errores?: { fila: number; campo?: string; mensaje: string }[] };
type Credencial = { documento: string; nombres: string; apellidos: string; contrasenaTemporal: string };

const subir = (texto: string, token = admin) =>
  pedir("/estudiantes/carga", conCookie(token, { method: "POST", headers: { "Content-Type": "text/csv" }, body: texto }));

const fila = (documento: string, extra: Partial<Record<"nombres" | "correo" | "carrera" | "semestre" | "celular", string>> = {}) =>
  [
    "CC",
    documento,
    extra.nombres ?? "Sara",
    "Mina Angulo",
    extra.correo ?? `${documento}@correo.test`,
    extra.celular ?? "",
    extra.carrera ?? "TL-CSV",
    extra.semestre ?? "1",
    "2026-2",
    "2026-08-03",
  ].join(";");

const existe = async (documento: string) =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE documento = ?").bind(documento).first<{ n: number }>())?.n === 1;

beforeAll(async () => {
  const hash = await hashContrasena(CONTRASENA);
  await crearUsuario({ documento: "7350000001", rol: "admin", avisoVersion: env.AVISO_PRIVACIDAD_VERSION }, hash);
  const docenteId = await crearUsuario({ documento: "7350000002", rol: "docente", avisoVersion: env.AVISO_PRIVACIDAD_VERSION }, hash);
  admin = await sesionDe("7350000001", CONTRASENA);
  tokenDocente = await sesionDe("7350000002", CONTRASENA);

  const carreraId = await crearCarrera("TL-CSV", { duracion: 4 });
  await crearCarrera("TL-CSV-OFF", { activa: 0 });
  cursoPrimero = (await (await llamar(admin, "POST", "/cursos", { carreraId, nombre: "Primero", semestre: 1, docenteId })).json<{ id: number }>()).id;
});

describe("GET /api/estudiantes/plantilla.csv", () => {
  it("descarga la plantilla con las columnas, separada por punto y coma y con marca UTF-8 para Excel", async () => {
    const respuesta = await llamar(admin, "GET", "/estudiantes/plantilla.csv");

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(respuesta.headers.get("Content-Disposition")).toContain('filename="plantilla-estudiantes.csv"');
    const bytes = new Uint8Array(await respuesta.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes).trim()).toBe(COLUMNAS);
  });
});

describe("POST /api/estudiantes/carga", () => {
  it("archivo válido: crea a todos, los inscribe y entrega las credenciales una sola vez", async () => {
    const texto = `\uFEFF${COLUMNAS}\r\n${fila("7350000101", { celular: "311 555 0101" })}\r\n${fila("7350000102", { nombres: '"Ana; María"' })}\r\n${fila("7350000103", { semestre: "2" })}\r\n`;

    const respuesta = await subir(texto);

    expect(respuesta.status).toBe(201);
    expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
    const { creados, credenciales } = await respuesta.json<{ creados: number; credenciales: Credencial[] }>();
    expect(creados).toBe(3);
    expect(credenciales.map((c) => [c.documento, c.nombres])).toEqual([
      ["7350000101", "Sara"],
      ["7350000102", "Ana; María"],
      ["7350000103", "Sara"],
    ]);

    // La base guarda solo hashes, los obliga a cambiar la contraseña y los inscribe en su semestre (D15, D17)
    const filas = await env.DB.prepare(
      "SELECT u.id, u.documento, u.celular, u.password_hash, u.debe_cambiar_password, e.semestre_actual FROM usuarios u JOIN estudiantes e ON e.usuario_id = u.id WHERE u.documento LIKE '73500001%' ORDER BY u.documento",
    ).all<{ id: number; documento: string; celular: string | null; password_hash: string; debe_cambiar_password: number }>();
    expect(filas.results).toHaveLength(3);
    for (const [i, f] of filas.results.entries()) {
      expect(f.debe_cambiar_password).toBe(1);
      expect(f.password_hash).not.toContain(credenciales[i].contrasenaTemporal);
    }
    expect(filas.results[0].celular).toBe("3115550101");
    expect(await inscritosEn(cursoPrimero)).toEqual(expect.arrayContaining([filas.results[0].id, filas.results[1].id]));
    expect(await inscritosEn(cursoPrimero)).not.toContain(filas.results[2].id);

    expect((await ingresar("7350000101", credenciales[0].contrasenaTemporal)).status).toBe(200);
  });

  it("archivo con errores: no guarda nada y muestra cada error con su número de fila", async () => {
    const texto = [
      COLUMNAS,
      fila("7350000201"), // fila 2: válida, pero no se guarda porque el archivo tiene errores
      fila("7350000002"), // fila 3: documento de un usuario que ya existe
      fila("7350000203", { carrera: "TL-NADA" }), // fila 4: carrera inexistente
      fila("7350000204", { correo: "sin-arroba" }), // fila 5: correo inválido
      fila("7350000205"), // fila 6
      fila("7350000205"), // fila 7: documento repetido dentro del archivo
      fila("7350000207", { carrera: "TL-CSV-OFF" }), // fila 8: carrera inactiva
      fila("7350000208", { semestre: "9" }), // fila 9: semestre que la carrera no tiene
    ].join("\n");

    const respuesta = await subir(texto);

    expect(respuesta.status).toBe(400);
    const error = await respuesta.json<ErrorCarga>();
    expect(error.codigo).toBe("CSV_CON_ERRORES");
    expect(error.mensaje).toContain("No se guardó ningún estudiante");
    expect(error.errores?.map((e) => [e.fila, e.campo])).toEqual([
      [3, "documento"],
      [4, "codigo_carrera"],
      [5, "correo"],
      [7, "documento"],
      [8, "codigo_carrera"],
      [9, "semestre"],
    ]);
    expect(error.errores?.[0].mensaje).toContain("7350000002");
    expect(await existe("7350000201")).toBe(false);
    expect(await existe("7350000205")).toBe(false);
  });

  it("también acepta coma como separador", async () => {
    const respuesta = await subir(`${COLUMNAS.replaceAll(";", ",")}\n${fila("7350000301").replaceAll(";", ",")}`);

    expect(respuesta.status).toBe(201);
    expect(await existe("7350000301")).toBe(true);
  });

  it("avisa si falta una columna de la plantilla", async () => {
    const respuesta = await subir(`${COLUMNAS.replace(";cohorte", "")}\nCC;7350000401;Sara;Mina;a@correo.test;;TL-CSV;1;2026-08-03`);

    expect(respuesta.status).toBe(400);
    const error = await respuesta.json<ErrorCarga>();
    expect(error.codigo).toBe("CSV_CON_ERRORES");
    expect(error.errores).toEqual([{ fila: 1, mensaje: expect.stringContaining("cohorte") }]);
  });

  it("rechaza un archivo sin estudiantes", async () => {
    const respuesta = await subir(`${COLUMNAS}\n`);

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ codigo: "CSV_SIN_FILAS" });
  });

  it("rechaza más de 300 filas por archivo", async () => {
    const filas = Array.from({ length: 301 }, (_, i) => fila(String(7350100000 + i)));

    const respuesta = await subir([COLUMNAS, ...filas].join("\n"));

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ codigo: "CSV_DEMASIADAS_FILAS" });
  });

  it("solo la usa el administrador", async () => {
    expect((await subir(`${COLUMNAS}\n${fila("7350000501")}`, tokenDocente)).status).toBe(403);
  });
});
