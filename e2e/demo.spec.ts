import { type Browser, devices, expect, type Page, test } from "@playwright/test";

// Flujo de la demo de punta a punta (tarea 6.1; criterio 1 de la rúbrica, docs/rubrica.md), con las cuentas
// de db/seed/CUENTAS-DEMO.md. Los elementos se buscan por su rol y su etiqueta accesible, como los encuentra
// un lector de pantalla: si una etiqueta se pierde, esta prueba falla.
//
// Depende de la fecha: el seed se diseñó para la semana de la presentación, el lunes 23 (los estados de cartera
// no cambian entre el 6 de noviembre y el 2 de diciembre de 2026, y el Taller 3 está abierto hasta el 26).

const CONTRASENA = "Demo2026*";
const CUENTAS = {
  estudiante: "9900001001", // Paola Andrea Zapata Arango, al día
  docente: "9900000103", // Liliana Caicedo Riascos
  enMora: "9900001002", // Manuela Riascos Rojas, bloqueada
  admin: "9900000001",
};
const TALLER = "Taller 3: Funciones y arreglos";

// Cada persona en su propio navegador (cookies separadas): los estudiantes desde el celular, el resto en escritorio
const abrir = async (browser: Browser, dispositivo: "celular" | "escritorio") =>
  (await browser.newContext(dispositivo === "celular" ? { ...devices["Pixel 7"], locale: "es-CO", timezoneId: "America/Bogota" } : {})).newPage();

async function ingresar(pagina: Page, documento: string) {
  await pagina.goto("/ingresar");
  await pagina.getByLabel("Número de documento").fill(documento);
  await pagina.getByLabel("Contraseña", { exact: true }).fill(CONTRASENA);
  await pagina.getByRole("button", { name: "Ingresar" }).click();
}

test("flujo de la demo: entrega, calificación, bloqueo por mora y desbloqueo al pagar", async ({ browser }) => {
  const estudiante = await abrir(browser, "celular");
  const docente = await abrir(browser, "escritorio");
  const manuela = await abrir(browser, "celular");
  const admin = await abrir(browser, "escritorio");

  await test.step("la estudiante al día entra desde el celular y entrega el Taller 3", async () => {
    await ingresar(estudiante, CUENTAS.estudiante);
    await expect(estudiante.getByRole("heading", { name: "Hola, Paola Andrea" })).toBeVisible();
    await estudiante.getByRole("link", { name: "Subir mi entrega" }).click();
    await expect(estudiante.getByRole("heading", { name: TALLER })).toBeVisible();

    await estudiante.getByLabel("Archivo", { exact: true }).setInputFiles("db/seed/placeholder.pdf");
    await estudiante.getByRole("button", { name: "Subir mi entrega" }).click();

    await expect(estudiante.getByText("Recibimos tu entrega.")).toBeVisible();
    await expect(estudiante.getByText("Entregada", { exact: true })).toBeVisible();
  });

  await test.step("la docente la califica con 4,2", async () => {
    await ingresar(docente, CUENTAS.docente);
    await docente.getByRole("link", { name: /Lógica de programación/ }).click();
    const tarjeta = docente.locator('[data-slot="card"]').filter({ hasText: TALLER });
    await tarjeta.getByRole("link", { name: /Calificar|Ver entregas/ }).click();

    const fila = docente.getByRole("row", { name: /Zapata Arango, Paola Andrea/ });
    await fila.getByRole("button", { name: "Calificar" }).click();
    await docente.getByLabel("Nota").fill("4,2");
    await docente.getByLabel("Comentario (opcional)").fill("Buen manejo de funciones. Revisa los casos límite.");
    await docente.getByRole("button", { name: "Guardar nota" }).click();

    await expect(docente.getByText("Nota de Paola Andrea Zapata Arango: 4,2")).toBeVisible();
  });

  await test.step("la estudiante ve su nota y el comentario", async () => {
    await estudiante.reload();
    await expect(estudiante.getByText("Calificada · 4,2")).toBeVisible();
    await expect(estudiante.getByText("Buen manejo de funciones. Revisa los casos límite.")).toBeVisible();
    await expect(estudiante.getByText("Ya fue calificada: no se puede reemplazar.")).toBeVisible();
  });

  await test.step("la estudiante en mora no puede ingresar", async () => {
    await ingresar(manuela, CUENTAS.enMora);
    // El aviso se anuncia como alerta (lector de pantalla) y dice a quién contactar
    const aviso = manuela.getByRole("alert").filter({ hasText: "Tu acceso está suspendido" });
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("más de 30 días de vencida");
    await expect(manuela).toHaveURL(/\/ingresar$/);
  });

  await test.step("el administrador registra su pago desde la cartera", async () => {
    await ingresar(admin, CUENTAS.admin);
    await admin.getByRole("link", { name: "Cartera", exact: true }).first().click();
    await admin.getByRole("link", { name: "Estado de cuenta de Manuela Riascos Rojas" }).click();

    // La cuota con más de 30 días de atraso: la de octubre
    const cuota = admin.getByRole("listitem").filter({ has: admin.getByText("Vence el 5 de octubre de 2026") });
    await cuota.getByRole("button", { name: "Registrar pago" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Registrar pago" }).click();

    await expect(admin.getByText(/Se registró el pago/)).toBeVisible();
  });

  await test.step("ya con el pago, la estudiante ingresa de inmediato", async () => {
    await ingresar(manuela, CUENTAS.enMora);
    await expect(manuela.getByRole("heading", { name: "Hola, Manuela" })).toBeVisible();
    await expect(manuela.getByText("En riesgo", { exact: true })).toBeVisible();
  });

  await test.step("Cerrar sesión: el administrador sale, vuelve a la pantalla de ingreso y al recargar sigue fuera", async () => {
    await admin.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(admin).toHaveURL(/\/ingresar$/);
    await expect(admin.getByLabel("Número de documento")).toBeVisible();

    // Lo que importa en un computador compartido: quien llega después no entra con la cuenta anterior
    await admin.goto("/admin");
    await expect(admin).toHaveURL(/\/ingresar$/);
  });
});
