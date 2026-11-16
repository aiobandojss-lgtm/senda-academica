import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// exports.default es el Worker completo (Hono con basePath "/api"): la petición recorre el mismo camino que en producción
describe("GET /api/salud", () => {
  it("responde 200 con {ok: true}", async () => {
    const respuesta = await exports.default.fetch("https://senda.test/api/salud");

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("content-type")).toContain("application/json");
    expect(await respuesta.json()).toEqual({ ok: true });
  });

  it("una ruta de la API que no existe responde 404, no la página de React", async () => {
    const respuesta = await exports.default.fetch("https://senda.test/api/no-existe");

    expect(respuesta.status).toBe(404);
  });
});
