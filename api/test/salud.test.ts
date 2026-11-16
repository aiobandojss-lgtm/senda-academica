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

  // La API niega por defecto (tarea 2.4): sin sesión responde 401 antes de saber si la ruta existe, así nadie
  // puede averiguar qué rutas hay probando. Con sesión, una ruta inexistente responde 404 (permisos.test.ts).
  it("una ruta de la API que no existe responde con un error JSON de la API, no con la página de React", async () => {
    const respuesta = await exports.default.fetch("https://senda.test/api/no-existe");

    expect(respuesta.status).toBe(401);
    expect(respuesta.headers.get("content-type")).toContain("application/json");
  });
});
