import { expect, test } from "@playwright/test";

// Escenario "Primer ingreso con contraseña temporal" (spec `autenticacion`; design.md D16): mientras no cambie la
// contraseña temporal, la persona solo ve la pantalla de cambio. La API ya lo impone (api/test/permisos.test.ts);
// aquí se verifica lo que ve en el navegador. Usa la cuenta de primer ingreso del seed (Jhon Fredy) y no cambia datos.

test("Primer ingreso con contraseña temporal: solo ve la pantalla de cambio de contraseña hasta que la cambie", async ({ page }) => {
  await page.goto("/ingresar");
  await page.getByLabel("Número de documento").fill("9900001006");
  await page.getByLabel("Contraseña", { exact: true }).fill("Demo2026*");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page.getByRole("heading", { name: "Crea tu contraseña" })).toBeVisible();
  await expect(page).toHaveURL(/\/primer-ingreso\/contrasena$/);

  // Aunque intente abrir su inicio, vuelve al cambio de contraseña
  await page.goto("/estudiante");
  await expect(page.getByRole("heading", { name: "Crea tu contraseña" })).toBeVisible();
  await expect(page).toHaveURL(/\/primer-ingreso\/contrasena$/);
});
