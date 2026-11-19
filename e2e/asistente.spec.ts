import { devices, expect, test } from "@playwright/test";

// Tarea RAG 4.2: el asistente Senda de punta a punta (pantalla, API, agente, umbral de similitud y validación de
// citas). playwright.config.ts activa el modelo y la búsqueda simulados (MODELO_SIMULADO=1): la prueba no gasta cuota
// de Workers AI y la respuesta no cambia entre corridas. Lo bien que responde el modelo real lo mide la evaluación
// (npm run eval:rag, tarea 4.1). Los documentos del asistente los carga e2e/preparar.ts.

const CONTRASENA = "Demo2026*";
const ESTUDIANTE = "9900001001"; // Paola Andrea Zapata Arango, al día (db/seed/CUENTAS-DEMO.md)
const NOTA_MINIMA = "¿Cuál es la nota mínima para aprobar un curso?";

test("asistente: responde con su fuente visible y reconoce cuando no tiene la información", async ({ browser }) => {
  // Desde el celular, como la mayoría de los estudiantes
  const contexto = await browser.newContext({ ...devices["Pixel 7"], locale: "es-CO", timezoneId: "America/Bogota" });
  const pagina = await contexto.newPage();
  const conversacion = pagina.getByRole("log", { name: /Conversación con/ });

  await test.step("la estudiante al día abre el asistente", async () => {
    await pagina.goto("/ingresar");
    await pagina.getByLabel("Número de documento").fill(ESTUDIANTE);
    await pagina.getByLabel("Contraseña", { exact: true }).fill(CONTRASENA);
    await pagina.getByRole("button", { name: "Ingresar" }).click();
    await expect(pagina.getByRole("heading", { name: "Hola, Paola Andrea" })).toBeVisible();

    await pagina.goto("/estudiante/asistente");
    await expect(pagina.getByRole("heading", { name: "Asistente académico", level: 1 })).toBeVisible();
    await expect(pagina.getByText("No escribas datos personales")).toBeVisible();
  });

  await test.step("pregunta respondible: la nota mínima, con la cita y su fuente visible bajo la respuesta", async () => {
    await pagina.getByRole("button", { name: NOTA_MINIMA }).click();

    // El reglamento y el plan de estudios dicen lo mismo con distintas palabras: cualquiera de los dos es válido
    await expect(conversacion).toContainText(/nota mínima[^.]*3\.0/);
    await expect(conversacion.getByText("(fuente 1)")).toBeAttached();
    await expect(conversacion.getByText("Fuentes", { exact: true })).toBeVisible();
    await expect(conversacion.getByRole("listitem").filter({ hasText: "Fuente 1:" })).toBeVisible();
  });

  await test.step("pregunta sin respuesta: dice que no tiene la información y remite al contacto, sin fuentes", async () => {
    await pagina.getByLabel(/Tu pregunta para/).fill("¿Cuál es el horario de la cafetería?");
    await pagina.getByRole("button", { name: "Enviar pregunta" }).click();

    await expect(conversacion).toContainText("No tengo esa información. Te sugiero consultarlo con");
    // Solo la primera respuesta tiene fuentes
    await expect(conversacion.getByText("Fuentes", { exact: true })).toHaveCount(1);
    await expect(pagina.getByText("Te quedan 28 preguntas hoy")).toBeVisible();
  });
});
