import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// D19: el frontend toma los nombres de aquí; ningún nombre queda quemado en el código.
// La ruta es pública porque la pantalla de ingreso la necesita antes de que exista una sesión.
describe("GET /api/config/publica", () => {
  it("responde sin sesión con las cuatro variables públicas", async () => {
    const respuesta = await exports.default.fetch("https://senda.test/api/config/publica");

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({
      productoNombre: env.PRODUCTO_NOMBRE,
      fundacionNombre: env.FUNDACION_NOMBRE,
      contactoFundacion: env.CONTACTO_FUNDACION,
      avisoPrivacidadVersion: env.AVISO_PRIVACIDAD_VERSION,
    });
  });

  // Lista explícita en la ruta, nunca el objeto env completo: una variable o secreto nuevo no se filtra por accidente
  it("no expone el almacén de archivos ni secretos", async () => {
    const texto = await (await exports.default.fetch("https://senda.test/api/config/publica")).text();

    expect(texto).not.toMatch(/almacen/i);
    expect(texto).not.toContain(env.JWT_SECRET);
  });
});
