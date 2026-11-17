import { type Context, Hono } from "hono";
import { z } from "zod";
import { actualizar } from "../datos";
import { estadoDeCuota, fechasDelPlan } from "../dominio/cuotas";
import { estadosDeCartera, hoyEnBogota } from "../dominio/mora";
import { codigoDeTrigger, idDeRuta, pesos, responderError, validarJson } from "../errores";
import { accesoDenegado, requiereRol } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";
import { conCambios, MENSAJE_SIN_CAMBIOS, texto } from "../validacion";

// Cartera (spec `cartera`, design.md D6, D9 y D13): plan de cuotas, cuotas individuales, pagos, anulaciones y
// estado de cuenta. El administrador gestiona todo; el estudiante solo consulta su propio estado de cuenta.
// Las reglas críticas también están en la base (triggers de D13): la API las valida y, si algo se escapa,
// traduce el código del trigger a un mensaje en español.

// /api/estudiantes/:id/... (administrador)
export const carteraDeEstudiante = new Hono<AppEnv>();
carteraDeEstudiante.use("*", requiereRol("admin"));
// /api/cuotas/:id/... y /api/pagos/:id/... (administrador)
export const cuotas = new Hono<AppEnv>();
cuotas.use("*", requiereRol("admin"));
export const pagos = new Hono<AppEnv>();
pagos.use("*", requiereRol("admin"));
// /api/estado-cuenta (el estudiante, el suyo)
export const estadoCuentaPropio = new Hono<AppEnv>();

// Dinero en pesos enteros (D9)
const valor = z
  .number({ error: "Escribe el valor en pesos, sin puntos ni decimales" })
  .int("Escribe el valor en pesos, sin puntos ni decimales")
  .min(1, "El valor debe ser mayor que cero")
  .max(100_000_000, "El valor es demasiado alto: revisa que no tenga ceros de más");
const fecha = (mensaje: string) => z.iso.date({ error: mensaje });
const concepto = texto("Escribe el concepto, por ejemplo Mensualidad o Matrícula", 80, "El concepto");

const esquemaPlan = z.object({
  concepto,
  valor,
  numero: z.number({ error: "Escribe el número de cuotas" }).int("El número de cuotas debe ser entero").min(1, "Genera de 1 a 24 cuotas").max(24, "Genera de 1 a 24 cuotas"),
  primerVencimiento: fecha("Escribe la fecha del primer vencimiento"),
});
const esquemaCuota = z.object({ concepto, valor, fechaVencimiento: fecha("Escribe la fecha de vencimiento") });
const esquemaEditarCuota = z
  .object({ concepto: concepto.optional(), valor: valor.optional(), fechaVencimiento: fecha("Escribe la fecha de vencimiento").optional() })
  .refine(conCambios, MENSAJE_SIN_CAMBIOS);
// La fecha de un pago no puede ser posterior a hoy en Colombia (spec "Registro de pagos")
const esquemaPago = z.object({
  valor,
  fechaPago: fecha("Escribe la fecha del pago").refine((f) => f <= hoyEnBogota(), "La fecha del pago no puede ser posterior a hoy"),
  medio: z.enum(["efectivo", "transferencia", "consignacion"], { error: "Elige el medio de pago: efectivo, transferencia o consignación" }),
});
const esquemaAnular = z.object({ motivo: texto("Escribe el motivo de la anulación", 200, "El motivo") });

type FilaCuota = { id: number; estudiante_id: number; concepto: string; valor: number; fecha_vencimiento: string; pagado: number; saldo: number };
type FilaPago = {
  id: number;
  cuota_id: number;
  valor: number;
  fecha_pago: string;
  medio: string;
  anulado: number;
  motivo_anulacion: string | null;
  anulado_en: string | null;
};

const aPago = (p: FilaPago) => ({
  id: p.id,
  cuotaId: p.cuota_id,
  valor: p.valor,
  fechaPago: p.fecha_pago,
  medio: p.medio,
  anulado: p.anulado === 1,
  motivoAnulacion: p.motivo_anulacion,
  anuladoEn: p.anulado_en,
});
const aCuota = (c: FilaCuota, pagosDeLaCuota: FilaPago[], hoy: string) => ({
  id: c.id,
  concepto: c.concepto,
  valor: c.valor,
  fechaVencimiento: c.fecha_vencimiento,
  pagado: c.pagado,
  saldo: c.saldo,
  ...estadoDeCuota({ fechaVencimiento: c.fecha_vencimiento, saldo: c.saldo }, hoy),
  pagos: pagosDeLaCuota.map(aPago),
});

const SELECT_CUOTA = "SELECT cuota_id AS id, estudiante_id, concepto, valor, fecha_vencimiento, pagado, saldo FROM v_saldo_cuotas";
const COLUMNAS_PAGO = "p.id, p.cuota_id, p.valor, p.fecha_pago, p.medio, p.anulado, p.motivo_anulacion, p.anulado_en";

async function cuotaConPagos(db: D1Database, id: number) {
  const [cuota, pagosDeLaCuota] = await db.batch([
    db.prepare(`${SELECT_CUOTA} WHERE cuota_id = ?`).bind(id),
    db.prepare(`SELECT ${COLUMNAS_PAGO} FROM pagos p WHERE p.cuota_id = ? ORDER BY p.fecha_pago, p.id`).bind(id),
  ]);
  const fila = cuota.results[0] as FilaCuota | undefined;
  return fila ? aCuota(fila, pagosDeLaCuota.results as FilaPago[], hoyEnBogota()) : null;
}

// Estado de cuenta (spec "Estado de cuenta"). El estudiante no ve los pagos anulados: son un asunto interno
// de la administración. Las excepciones las ve el administrador; el estudiante solo las vigentes.
export async function estadoDeCuenta(db: D1Database, estudianteId: number, { paraEstudiante }: { paraEstudiante: boolean }) {
  const hoy = hoyEnBogota();
  const [cuotasDelEstudiante, pagosDelEstudiante, excepciones, persona] = await db.batch([
    db.prepare(`${SELECT_CUOTA} WHERE estudiante_id = ? ORDER BY fecha_vencimiento, cuota_id`).bind(estudianteId),
    db
      .prepare(
        `SELECT ${COLUMNAS_PAGO} FROM pagos p JOIN cuotas c ON c.id = p.cuota_id
          WHERE c.estudiante_id = ? ${paraEstudiante ? "AND p.anulado = 0" : ""} ORDER BY p.fecha_pago, p.id`,
      )
      .bind(estudianteId),
    db
      .prepare(`SELECT id, motivo, hasta FROM excepciones_mora WHERE estudiante_id = ? ${paraEstudiante ? "AND hasta >= ?" : ""} ORDER BY hasta DESC, id DESC`)
      .bind(...(paraEstudiante ? [estudianteId, hoy] : [estudianteId])),
    db.prepare("SELECT id, nombres, apellidos FROM usuarios WHERE id = ?").bind(estudianteId),
  ]);
  const filasPago = pagosDelEstudiante.results as FilaPago[];
  const lista = (cuotasDelEstudiante.results as FilaCuota[]).map((c) =>
    aCuota(
      c,
      filasPago.filter((p) => p.cuota_id === c.id),
      hoy,
    ),
  );
  const estadoDe = await estadosDeCartera(db, hoy, estudianteId);
  return {
    estudiante: persona.results[0] as { id: number; nombres: string; apellidos: string },
    estadoCartera: estadoDe(estudianteId),
    totalAdeudado: lista.reduce((total, c) => total + c.saldo, 0),
    totalVencido: lista.filter((c) => c.estado === "vencida").reduce((total, c) => total + c.saldo, 0),
    cuotas: lista,
    excepciones: (excepciones.results as { id: number; motivo: string; hasta: string }[]).map((e) => ({ ...e, vigente: e.hasta >= hoy })),
  };
}

async function estudianteExiste(c: Context<AppEnv>, id: number | null) {
  return id !== null && (await c.env.DB.prepare("SELECT 1 AS si FROM estudiantes WHERE usuario_id = ?").bind(id).first()) !== null;
}
const estudianteNoEncontrado = (c: Context<AppEnv>) => responderError(c, 404, "ESTUDIANTE_NO_ENCONTRADO", "El estudiante no existe");
const cuotaNoEncontrada = (c: Context<AppEnv>) => responderError(c, 404, "CUOTA_NO_ENCONTRADA", "La cuota no existe");
const cuotaConPagosError = (c: Context<AppEnv>, accion: "editar" | "eliminar") =>
  responderError(
    c,
    409,
    "CUOTA_CON_PAGOS",
    accion === "editar"
      ? "Esta cuota ya tiene pagos registrados: no se puede cambiar su valor ni su fecha"
      : "Esta cuota tiene pagos registrados (aunque estén anulados): no se puede eliminar",
  );

carteraDeEstudiante.get("/:id/estado-cuenta", async (c) => {
  const id = idDeRuta(c);
  if (!(await estudianteExiste(c, id))) return estudianteNoEncontrado(c);
  return c.json(await estadoDeCuenta(c.env.DB, id!, { paraEstudiante: false }));
});

// Plan de cuotas: "Mensualidad 1/6" a "Mensualidad 6/6", mensuales (spec "Plan de cuotas")
carteraDeEstudiante.post("/:id/cuotas/plan", validarJson(esquemaPlan), async (c) => {
  const id = idDeRuta(c);
  if (!(await estudianteExiste(c, id))) return estudianteNoEncontrado(c);
  const datos = c.req.valid("json");
  const fechas = fechasDelPlan(datos.primerVencimiento, datos.numero);
  await c.env.DB.batch(
    fechas.map((fechaVencimiento, i) =>
      c.env.DB.prepare("INSERT INTO cuotas (estudiante_id, concepto, valor, fecha_vencimiento) VALUES (?, ?, ?, ?)").bind(
        id,
        `${datos.concepto} ${i + 1}/${datos.numero}`,
        datos.valor,
        fechaVencimiento,
      ),
    ),
  );
  return c.json(await estadoDeCuenta(c.env.DB, id!, { paraEstudiante: false }), 201);
});

carteraDeEstudiante.post("/:id/cuotas", validarJson(esquemaCuota), async (c) => {
  const id = idDeRuta(c);
  if (!(await estudianteExiste(c, id))) return estudianteNoEncontrado(c);
  const datos = c.req.valid("json");
  const creada = await c.env.DB.prepare("INSERT INTO cuotas (estudiante_id, concepto, valor, fecha_vencimiento) VALUES (?, ?, ?, ?) RETURNING id")
    .bind(id, datos.concepto, datos.valor, datos.fechaVencimiento)
    .first<{ id: number }>();
  return c.json(await cuotaConPagos(c.env.DB, creada!.id), 201);
});

cuotas.patch("/:id", validarJson(esquemaEditarCuota), async (c) => {
  const id = idDeRuta(c);
  if (!id || !(await cuotaConPagos(c.env.DB, id))) return cuotaNoEncontrada(c);
  const datos = c.req.valid("json");
  try {
    await actualizar(c.env.DB, "cuotas", id, { concepto: datos.concepto, valor: datos.valor, fecha_vencimiento: datos.fechaVencimiento })?.run();
  } catch (error) {
    if (codigoDeTrigger(error) === "CUOTA_CON_PAGOS") return cuotaConPagosError(c, "editar");
    throw error;
  }
  return c.json(await cuotaConPagos(c.env.DB, id));
});

cuotas.delete("/:id", async (c) => {
  const id = idDeRuta(c);
  if (!id || !(await cuotaConPagos(c.env.DB, id))) return cuotaNoEncontrada(c);
  try {
    await c.env.DB.prepare("DELETE FROM cuotas WHERE id = ?").bind(id).run();
  } catch (error) {
    if (codigoDeTrigger(error) === "CUOTA_CON_PAGOS") return cuotaConPagosError(c, "eliminar");
    throw error;
  }
  return c.json({ id, eliminada: true });
});

// Pago total o parcial (spec "Registro de pagos"): nunca mayor que el saldo (trigger PAGO_SUPERA_SALDO)
cuotas.post("/:id/pagos", validarJson(esquemaPago), async (c) => {
  const id = idDeRuta(c);
  if (!id || !(await cuotaConPagos(c.env.DB, id))) return cuotaNoEncontrada(c);
  const datos = c.req.valid("json");
  try {
    const pago = await c.env.DB.prepare(
      `INSERT INTO pagos (cuota_id, valor, fecha_pago, medio, registrado_por) VALUES (?, ?, ?, ?, ?)
       RETURNING id, cuota_id, valor, fecha_pago, medio, anulado, motivo_anulacion, anulado_en`,
    )
      .bind(id, datos.valor, datos.fechaPago, datos.medio, c.var.usuario.id)
      .first<FilaPago>();
    return c.json(aPago(pago!), 201);
  } catch (error) {
    if (codigoDeTrigger(error) !== "PAGO_SUPERA_SALDO") throw error;
    const cuota = await cuotaConPagos(c.env.DB, id);
    return responderError(c, 409, "PAGO_SUPERA_SALDO", `El pago supera el saldo de la cuota. Saldo actual: ${pesos(cuota?.saldo ?? 0)}`);
  }
});

// Anular (spec "Anulación de pagos"): el pago se conserva en el historial y deja de contar para el saldo. Es
// la única corrección posible: un pago nunca se edita ni se reactiva (trigger PAGO_INMUTABLE).
pagos.post("/:id/anular", validarJson(esquemaAnular), async (c) => {
  const id = idDeRuta(c);
  const existe = id ? await c.env.DB.prepare("SELECT 1 AS si FROM pagos WHERE id = ?").bind(id).first() : null;
  if (!id || !existe) return responderError(c, 404, "PAGO_NO_ENCONTRADO", "El pago no existe");
  try {
    const pago = await c.env.DB.prepare(
      `UPDATE pagos SET anulado = 1, motivo_anulacion = ?, anulado_por = ?, anulado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ? RETURNING id, cuota_id, valor, fecha_pago, medio, anulado, motivo_anulacion, anulado_en`,
    )
      .bind(c.req.valid("json").motivo, c.var.usuario.id, id)
      .first<FilaPago>();
    return c.json(aPago(pago!));
  } catch (error) {
    if (codigoDeTrigger(error) === "PAGO_INMUTABLE") {
      return responderError(c, 409, "PAGO_INMUTABLE", "Este pago ya está anulado: un pago solo se anula una vez");
    }
    throw error;
  }
});

// El estudiante consulta su propio estado de cuenta; nadie más usa esta ruta
estadoCuentaPropio.get("/", async (c) => {
  const usuario = c.var.usuario;
  if (usuario.rol !== "estudiante") return accesoDenegado(c);
  return c.json(await estadoDeCuenta(c.env.DB, usuario.id, { paraEstudiante: true }));
});
