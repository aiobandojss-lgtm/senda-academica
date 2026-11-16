import { Hono } from "hono";
import { z } from "zod";
import { leerCsv } from "../dominio/csv";
import { inscribirPorDocumentos } from "../dominio/inscripciones";
import { esUnicoRepetido, responderError } from "../errores";
import { generarContrasenaTemporal, hashContrasena } from "../seguridad/contrasenas";
import { requiereRol } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";
import { campoApellidos, campoCelular, campoCorreo, campoDocumento, campoNombres, campoTipoDocumento } from "../validacion";

// Carga masiva de estudiantes por CSV (spec `carreras-estudiantes`, design.md D8 y D17). Se valida TODO el
// archivo y, si una sola fila tiene errores, no se guarda nada. Cada estudiante recibe una contraseña
// temporal que se devuelve una sola vez: el navegador arma con ella el CSV de credenciales.
export const cargaEstudiantes = new Hono<AppEnv>();
cargaEstudiantes.use("*", requiereRol("admin"));

// Columnas de la plantilla (D8). La plantilla y el lector usan esta misma lista: no se pueden desalinear.
export const COLUMNAS_CSV = [
  "tipo_documento",
  "documento",
  "nombres",
  "apellidos",
  "correo",
  "celular",
  "codigo_carrera",
  "semestre",
  "cohorte",
  "fecha_ingreso",
] as const;

// Cada contraseña temporal cuesta unos 20 ms de CPU (ADR-003): 300 filas son unos 6 s, lejos de los 30 s del
// plan Paid. En el plan Free, la demo usa archivos de 2 o 3 filas.
const MAXIMO_FILAS = 300;
const MAXIMO_BYTES = 1_000_000;

// Los valores del CSV llegan como texto: cada campo se valida con los mismos mensajes que el formulario
const esquemaFila = z.object({
  tipo_documento: z.string().trim().toUpperCase().pipe(campoTipoDocumento),
  documento: campoDocumento,
  nombres: campoNombres,
  apellidos: campoApellidos,
  correo: campoCorreo,
  celular: campoCelular,
  codigo_carrera: z.string().trim().toUpperCase().min(1, "Escribe el código de la carrera"),
  semestre: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, "El semestre debe ser un número entero, por ejemplo 1")
    .transform(Number)
    .pipe(z.number().min(1, "El semestre empieza en 1")),
  cohorte: z
    .string()
    .trim()
    .regex(/^\d{4}-[12]$/, "La cohorte tiene la forma AAAA-1 o AAAA-2, por ejemplo 2026-2"),
  fecha_ingreso: z.string().trim().pipe(z.iso.date({ error: "Escribe la fecha de ingreso como AAAA-MM-DD, por ejemplo 2026-08-03" })),
});
type FilaValida = z.infer<typeof esquemaFila> & { numero: number; carreraId: number };
type ErrorFila = { fila: number; campo?: string; mensaje: string };

const porLotes = <T>(lista: T[], tamano: number) =>
  Array.from({ length: Math.ceil(lista.length / tamano) }, (_, i) => lista.slice(i * tamano, (i + 1) * tamano));

const conErrores = (c: Parameters<typeof responderError>[0], errores: ErrorFila[]) =>
  c.json(
    {
      codigo: "CSV_CON_ERRORES",
      mensaje: `El archivo tiene ${errores.length} ${errores.length === 1 ? "error" : "errores"}. No se guardó ningún estudiante: corrígelos y vuelve a cargarlo.`,
      errores,
    },
    400,
  );

// Marca UTF-8 (BOM) al inicio: sin ella, Excel en Windows abre "Muñoz" como "MuÃ±oz"
cargaEstudiantes.get("/plantilla.csv", (c) => {
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", 'attachment; filename="plantilla-estudiantes.csv"');
  return c.body(`\uFEFF${COLUMNAS_CSV.join(";")}\r\n`);
});

cargaEstudiantes.post("/carga", async (c) => {
  const texto = await c.req.text();
  if (texto.length > MAXIMO_BYTES) {
    return responderError(c, 413, "CSV_MUY_GRANDE", "El archivo pesa más de 1 MB. Divídelo en varios archivos.");
  }
  const hoja = leerCsv(texto);

  const faltantes = COLUMNAS_CSV.filter((columna) => !hoja.columnas.includes(columna));
  if (hoja.columnas.length > 0 && faltantes.length > 0) {
    return conErrores(c, [{ fila: 1, mensaje: `Faltan columnas de la plantilla: ${faltantes.join(", ")}. Descarga la plantilla y copia allí los datos.` }]);
  }
  if (hoja.filas.length === 0) {
    return responderError(c, 400, "CSV_SIN_FILAS", "El archivo no tiene estudiantes: llena la plantilla desde la fila 2");
  }
  if (hoja.filas.length > MAXIMO_FILAS) {
    return responderError(
      c,
      400,
      "CSV_DEMASIADAS_FILAS",
      `El archivo tiene ${hoja.filas.length} estudiantes y el máximo por carga es ${MAXIMO_FILAS}. Divídelo en varios archivos.`,
    );
  }

  // 1. Formato de cada fila
  const errores: ErrorFila[] = [];
  const validas: (Omit<FilaValida, "carreraId"> & { numero: number })[] = [];
  for (const fila of hoja.filas) {
    const crudo = Object.fromEntries(COLUMNAS_CSV.map((columna) => [columna, fila.valores[hoja.columnas.indexOf(columna)] ?? ""]));
    const resultado = esquemaFila.safeParse(crudo);
    if (resultado.success) validas.push({ ...resultado.data, numero: fila.numero });
    else for (const problema of resultado.error.issues) errores.push({ fila: fila.numero, campo: String(problema.path[0]), mensaje: problema.message });
  }

  // 2. Reglas contra la base y entre filas: carrera activa con ese semestre y documento nuevo y no repetido
  const { results: carreras } = await c.env.DB.prepare("SELECT id, codigo, duracion_semestres, activa FROM carreras").all<{
    id: number;
    codigo: string;
    duracion_semestres: number;
    activa: number;
  }>();
  const carreraPorCodigo = new Map(carreras.map((carrera) => [carrera.codigo, carrera]));
  const existentes = new Set<string>();
  for (const lote of porLotes(validas.map((v) => v.documento), 100)) {
    const { results } = await c.env.DB.prepare(`SELECT documento FROM usuarios WHERE documento IN (${lote.map(() => "?").join(", ")})`)
      .bind(...lote)
      .all<{ documento: string }>();
    for (const { documento } of results) existentes.add(documento);
  }

  const filaDelDocumento = new Map<string, number>();
  const listas: FilaValida[] = [];
  for (const v of validas) {
    const errorAntes = errores.length;
    if (existentes.has(v.documento)) {
      errores.push({ fila: v.numero, campo: "documento", mensaje: `Ya existe un usuario con el documento ${v.documento}` });
    } else if (filaDelDocumento.has(v.documento)) {
      errores.push({ fila: v.numero, campo: "documento", mensaje: `El documento ${v.documento} está repetido: ya aparece en la fila ${filaDelDocumento.get(v.documento)}` });
    }
    filaDelDocumento.set(v.documento, filaDelDocumento.get(v.documento) ?? v.numero);

    const carrera = carreraPorCodigo.get(v.codigo_carrera);
    if (!carrera) {
      errores.push({ fila: v.numero, campo: "codigo_carrera", mensaje: `No existe una carrera con el código ${v.codigo_carrera}` });
    } else if (carrera.activa !== 1) {
      errores.push({ fila: v.numero, campo: "codigo_carrera", mensaje: `La carrera ${carrera.codigo} no está activa` });
    } else if (v.semestre > carrera.duracion_semestres) {
      errores.push({ fila: v.numero, campo: "semestre", mensaje: `La carrera ${carrera.codigo} tiene semestres del 1 al ${carrera.duracion_semestres}` });
    }
    if (errores.length === errorAntes && carrera) listas.push({ ...v, carreraId: carrera.id });
  }
  if (errores.length > 0) return conErrores(c, errores.sort((a, b) => a.fila - b.fila));

  // 3. Todo o nada: un solo batch (una transacción). Varias filas por sentencia, porque D1 limita las consultas
  // por petición (50 en Free, 1.000 en Paid) y los parámetros por consulta (100).
  const conContrasena = [];
  for (const fila of listas) {
    const contrasenaTemporal = generarContrasenaTemporal();
    conContrasena.push({ ...fila, contrasenaTemporal, hash: await hashContrasena(contrasenaTemporal) });
  }

  const db = c.env.DB;
  const sentencias = [
    // usuarios: 7 parámetros por fila, 14 filas por sentencia (98 parámetros)
    ...porLotes(conContrasena, 14).map((lote) =>
      db
        .prepare(
          `INSERT INTO usuarios (rol, tipo_documento, documento, nombres, apellidos, correo, celular, password_hash, debe_cambiar_password)
           VALUES ${lote.map(() => "('estudiante', ?, ?, ?, ?, ?, ?, ?, 1)").join(", ")}`,
        )
        .bind(...lote.flatMap((f) => [f.tipo_documento, f.documento, f.nombres, f.apellidos, f.correo, f.celular, f.hash])),
    ),
    // estudiantes: 5 parámetros por fila, 20 filas por sentencia; el usuario se encuentra por su documento
    ...porLotes(conContrasena, 20).map((lote) =>
      db
        .prepare(
          `INSERT INTO estudiantes (usuario_id, carrera_id, semestre_actual, cohorte, fecha_ingreso)
           SELECT u.id, v.column2, v.column3, v.column4, v.column5
           FROM (VALUES ${lote.map(() => "(?, ?, ?, ?, ?)").join(", ")}) AS v
           JOIN usuarios u ON u.documento = v.column1`,
        )
        .bind(...lote.flatMap((f) => [f.documento, f.carreraId, f.semestre, f.cohorte, f.fecha_ingreso])),
    ),
    // D15: inscripción automática en los cursos de su semestre
    ...porLotes(conContrasena.map((f) => f.documento), 100).map((lote) => inscribirPorDocumentos(db, lote)),
  ];

  try {
    await db.batch(sentencias);
  } catch (error) {
    // Alguien registró uno de esos documentos entre la validación y el guardado: no se guardó nada
    if (esUnicoRepetido(error, "usuarios.documento")) {
      return responderError(c, 409, "DOCUMENTO_REPETIDO", "Uno de los documentos se registró mientras se cargaba el archivo. Vuelve a cargarlo.");
    }
    throw error;
  }

  // D17: la única vez que salen las contraseñas temporales; ni el navegador ni un proxy deben guardarlas
  c.header("Cache-Control", "no-store");
  return c.json(
    {
      creados: conContrasena.length,
      credenciales: conContrasena.map((f) => ({
        documento: f.documento,
        nombres: f.nombres,
        apellidos: f.apellidos,
        contrasenaTemporal: f.contrasenaTemporal,
      })),
    },
    201,
  );
});
