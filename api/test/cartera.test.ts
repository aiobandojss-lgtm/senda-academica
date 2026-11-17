import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { crearCarrera, crearEstudiante, crearUsuario, fechaDesdeHoy, llamar, sesionDe } from "./utilidades";

// Tarea 5.2: cuotas, pagos y estado de cuenta (spec `cartera`, design.md D6 y D13)

const CONTRASENA = "Prueba2026*";
const aviso = () => env.AVISO_PRIVACIDAD_VERSION;

let admin: string;
let tokenEstudiante: string;
let tokenDocente: string;
let carreraId: number;
let estudianteId: number;
let siguienteDocumento = 7390000200;

type Pago = { id: number; valor: number; fechaPago: string; medio: string; anulado: boolean; motivoAnulacion: string | null };
type Cuota = {
  id: number;
  concepto: string;
  valor: number;
  fechaVencimiento: string;
  pagado: number;
  saldo: number;
  estado: string;
  diasAtraso: number;
  pagos: Pago[];
};
type EstadoCuenta = { estadoCartera: string; totalAdeudado: number; totalVencido: number; cuotas: Cuota[] };

// Un estudiante nuevo por prueba: así cada escenario arranca sin cuotas
const nuevoEstudiante = async () =>
  crearEstudiante({ documento: String(siguienteDocumento++), carreraId, semestre: 1 }, await hashContrasena(CONTRASENA));

const crearCuota = async (id: number, extra: Record<string, unknown> = {}) =>
  (await llamar(admin, "POST", `/estudiantes/${id}/cuotas`, { concepto: "Mensualidad", valor: 180_000, fechaVencimiento: "2026-12-05", ...extra })).json<Cuota>();

const pagar = (cuotaId: number, cuerpo: Record<string, unknown> = {}) =>
  llamar(admin, "POST", `/cuotas/${cuotaId}/pagos`, { valor: 100_000, fechaPago: fechaDesdeHoy(0), medio: "transferencia", ...cuerpo });

const estadoDe = async (id: number) => (await llamar(admin, "GET", `/estudiantes/${id}/estado-cuenta`)).json<EstadoCuenta>();

beforeAll(async () => {
  const hash = await hashContrasena(CONTRASENA);
  await crearUsuario({ documento: "7390000001", rol: "admin", avisoVersion: aviso() }, hash);
  await crearUsuario({ documento: "7390000002", rol: "docente", avisoVersion: aviso() }, hash);
  carreraId = await crearCarrera("TL-CAR");
  estudianteId = await crearEstudiante({ documento: "7390000101", carreraId, semestre: 1 }, hash);
  admin = await sesionDe("7390000001", CONTRASENA);
  tokenDocente = await sesionDe("7390000002", CONTRASENA);
  tokenEstudiante = await sesionDe("7390000101", CONTRASENA);
});

describe("plan de cuotas y cuotas individuales", () => {
  it("generar seis cuotas: 180.000 desde el 5 de agosto, que vencen el día 5 de agosto a enero", async () => {
    const id = await nuevoEstudiante();

    const respuesta = await llamar(admin, "POST", `/estudiantes/${id}/cuotas/plan`, {
      concepto: "Mensualidad",
      valor: 180_000,
      numero: 6,
      primerVencimiento: "2026-08-05",
    });

    expect(respuesta.status).toBe(201);
    const { cuotas } = await estadoDe(id);
    expect(cuotas.map((c) => [c.concepto, c.valor, c.fechaVencimiento])).toEqual([
      ["Mensualidad 1/6", 180_000, "2026-08-05"],
      ["Mensualidad 2/6", 180_000, "2026-09-05"],
      ["Mensualidad 3/6", 180_000, "2026-10-05"],
      ["Mensualidad 4/6", 180_000, "2026-11-05"],
      ["Mensualidad 5/6", 180_000, "2026-12-05"],
      ["Mensualidad 6/6", 180_000, "2027-01-05"],
    ]);
  });

  it("agrega una cuota individual, como la matrícula", async () => {
    const id = await nuevoEstudiante();

    const cuota = await crearCuota(id, { concepto: "Matrícula 2026-2", valor: 350_000, fechaVencimiento: "2026-08-01" });

    expect(cuota).toMatchObject({ concepto: "Matrícula 2026-2", valor: 350_000, saldo: 350_000 });
  });

  it("valida el valor y rechaza un estudiante que no existe", async () => {
    const id = await nuevoEstudiante();

    const valor = await llamar(admin, "POST", `/estudiantes/${id}/cuotas`, { concepto: "X", valor: 0, fechaVencimiento: "2026-12-05" });
    const inexistente = await llamar(admin, "POST", "/estudiantes/999999/cuotas", { concepto: "X", valor: 1000, fechaVencimiento: "2026-12-05" });

    expect(valor.status).toBe(400);
    expect(await valor.json()).toMatchObject({ campo: "valor" });
    expect(inexistente.status).toBe(404);
  });

  it("edita una cuota sin pagos", async () => {
    const cuota = await crearCuota(await nuevoEstudiante());

    const respuesta = await llamar(admin, "PATCH", `/cuotas/${cuota.id}`, { valor: 200_000, fechaVencimiento: "2026-12-10" });

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ valor: 200_000, fechaVencimiento: "2026-12-10", saldo: 200_000 });
  });

  it("editar cuota con pagos: se rechaza (CUOTA_CON_PAGOS)", async () => {
    const cuota = await crearCuota(await nuevoEstudiante());
    await pagar(cuota.id);

    const respuesta = await llamar(admin, "PATCH", `/cuotas/${cuota.id}`, { valor: 200_000 });

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ codigo: "CUOTA_CON_PAGOS" });
  });

  it("eliminar cuota creada por error: desaparece del plan y del saldo", async () => {
    const id = await nuevoEstudiante();
    const cuota = await crearCuota(id);

    expect((await llamar(admin, "DELETE", `/cuotas/${cuota.id}`)).status).toBe(200);

    const estado = await estadoDe(id);
    expect(estado.cuotas).toEqual([]);
    expect(estado.totalAdeudado).toBe(0);
  });

  it("eliminar cuota con pagos, aunque estén anulados: se rechaza", async () => {
    const cuota = await crearCuota(await nuevoEstudiante());
    const pago = await (await pagar(cuota.id)).json<Pago>();
    await llamar(admin, "POST", `/pagos/${pago.id}/anular`, { motivo: "valor errado" });

    const respuesta = await llamar(admin, "DELETE", `/cuotas/${cuota.id}`);

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ codigo: "CUOTA_CON_PAGOS" });
  });
});

describe("pagos", () => {
  it("pago total: la cuota queda pagada con saldo cero", async () => {
    const id = await nuevoEstudiante();
    const cuota = await crearCuota(id);

    expect((await pagar(cuota.id, { valor: 180_000, medio: "efectivo" })).status).toBe(201);

    const [despues] = (await estadoDe(id)).cuotas;
    expect(despues).toMatchObject({ pagado: 180_000, saldo: 0, estado: "pagada" });
  });

  it("pago parcial: 100.000 a una cuota de 180.000 deja saldo de 80.000", async () => {
    const id = await nuevoEstudiante();
    const cuota = await crearCuota(id);

    await pagar(cuota.id, { valor: 100_000 });

    expect((await estadoDe(id)).cuotas[0]).toMatchObject({ pagado: 100_000, saldo: 80_000, estado: "pendiente" });
  });

  it("pago mayor al saldo: se rechaza e indica el saldo actual", async () => {
    const cuota = await crearCuota(await nuevoEstudiante());
    await pagar(cuota.id, { valor: 100_000 });

    const respuesta = await pagar(cuota.id, { valor: 90_000 });

    expect(respuesta.status).toBe(409);
    const error = await respuesta.json<{ codigo: string; mensaje: string }>();
    expect(error.codigo).toBe("PAGO_SUPERA_SALDO");
    expect(error.mensaje).toContain("80.000");
  });

  it("pago con fecha futura: se rechaza", async () => {
    const cuota = await crearCuota(await nuevoEstudiante());

    const respuesta = await pagar(cuota.id, { fechaPago: fechaDesdeHoy(1) });

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ campo: "fechaPago" });
  });

  it("valida el valor y el medio de pago", async () => {
    const cuota = await crearCuota(await nuevoEstudiante());

    expect(await (await pagar(cuota.id, { valor: 0 })).json()).toMatchObject({ campo: "valor" });
    expect(await (await pagar(cuota.id, { medio: "tarjeta" })).json()).toMatchObject({ campo: "medio" });
  });

  it("anular pago: el saldo vuelve a incluir su valor y el pago aparece como anulado", async () => {
    const id = await nuevoEstudiante();
    const cuota = await crearCuota(id);
    const pago = await (await pagar(cuota.id, { valor: 100_000 })).json<Pago>();

    const respuesta = await llamar(admin, "POST", `/pagos/${pago.id}/anular`, { motivo: "valor errado" });

    expect(respuesta.status).toBe(200);
    const [despues] = (await estadoDe(id)).cuotas;
    expect(despues).toMatchObject({ pagado: 0, saldo: 180_000 });
    expect(despues.pagos).toEqual([expect.objectContaining({ id: pago.id, anulado: true, motivoAnulacion: "valor errado" })]);
  });

  it("un pago anulado no se puede volver a anular, y anular exige motivo", async () => {
    const cuota = await crearCuota(await nuevoEstudiante());
    const pago = await (await pagar(cuota.id)).json<Pago>();

    expect((await llamar(admin, "POST", `/pagos/${pago.id}/anular`, { motivo: "" })).status).toBe(400);
    await llamar(admin, "POST", `/pagos/${pago.id}/anular`, { motivo: "duplicado" });
    const otraVez = await llamar(admin, "POST", `/pagos/${pago.id}/anular`, { motivo: "otra vez" });

    expect(otraVez.status).toBe(409);
    expect(await otraVez.json()).toMatchObject({ codigo: "PAGO_INMUTABLE" });
  });

  it("solo el administrador registra pagos y cuotas", async () => {
    const cuota = await crearCuota(await nuevoEstudiante());

    expect((await llamar(tokenDocente, "POST", `/cuotas/${cuota.id}/pagos`, { valor: 1, fechaPago: fechaDesdeHoy(0), medio: "efectivo" })).status).toBe(403);
    expect((await llamar(tokenEstudiante, "POST", `/estudiantes/${estudianteId}/cuotas`, { concepto: "X", valor: 1, fechaVencimiento: "2026-12-05" })).status).toBe(403);
  });
});

describe("los triggers de D13 rechazan los cambios aunque se intenten directo en SQL", () => {
  it("PAGO_SUPERA_SALDO, PAGO_INMUTABLE y CUOTA_CON_PAGOS", async () => {
    const cuota = await crearCuota(await nuevoEstudiante());
    const pago = await (await pagar(cuota.id, { valor: 100_000 })).json<Pago>();
    const sql = (consulta: string, ...valores: unknown[]) => env.DB.prepare(consulta).bind(...valores).run();

    await expect(
      sql("INSERT INTO pagos (cuota_id, valor, fecha_pago, medio, registrado_por) VALUES (?, 90000, '2026-11-01', 'efectivo', 1)", cuota.id),
    ).rejects.toThrow(/PAGO_SUPERA_SALDO/);
    await expect(sql("UPDATE pagos SET valor = 50000 WHERE id = ?", pago.id)).rejects.toThrow(/PAGO_INMUTABLE/);
    await expect(sql("UPDATE cuotas SET valor = 999999 WHERE id = ?", cuota.id)).rejects.toThrow(/CUOTA_CON_PAGOS/);
    await expect(sql("DELETE FROM cuotas WHERE id = ?", cuota.id)).rejects.toThrow(/CUOTA_CON_PAGOS/);
  });
});

describe("estado de cuenta", () => {
  it("estudiante consulta su estado: cuotas con saldo y estado (vencida con días de atraso) y el total que debe", async () => {
    await crearCuota(estudianteId, { concepto: "Atrasada", valor: 150_000, fechaVencimiento: fechaDesdeHoy(-10) });
    const pendiente = await crearCuota(estudianteId, { concepto: "Próxima", valor: 180_000, fechaVencimiento: fechaDesdeHoy(20) });
    const pago = await (await pagar(pendiente.id, { valor: 30_000 })).json<Pago>();
    await llamar(admin, "POST", `/pagos/${pago.id}/anular`, { motivo: "duplicado" });
    await pagar(pendiente.id, { valor: 30_000 });

    const respuesta = await llamar(tokenEstudiante, "GET", "/estado-cuenta");

    expect(respuesta.status).toBe(200);
    const estado = await respuesta.json<EstadoCuenta>();
    expect(estado.estadoCartera).toBe("en_riesgo");
    expect(estado.totalAdeudado).toBe(150_000 + 150_000);
    expect(estado.totalVencido).toBe(150_000);
    expect(estado.cuotas.map((c) => [c.concepto, c.estado, c.diasAtraso, c.saldo])).toEqual([
      ["Atrasada", "vencida", 10, 150_000],
      ["Próxima", "pendiente", 0, 150_000],
    ]);
    // El estudiante no ve los pagos anulados: son un asunto interno de la administración
    expect(estado.cuotas[1].pagos.map((p) => p.anulado)).toEqual([false]);
  });

  it("estudiante intenta ver el estado de cuenta de otro: acceso denegado", async () => {
    expect((await llamar(tokenEstudiante, "GET", `/estudiantes/${estudianteId}/estado-cuenta`)).status).toBe(403);
  });
});
