import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { type AlmacenArchivos, AlmacenKV, AlmacenR2 } from "../src/archivos/almacen";
import { formatoDe } from "../src/archivos/formatos";
import { BYTES } from "./utilidades";

// Tarea 4.2: almacén de archivos (design.md D7) y formatos verificados por contenido (spec "Entrega de archivos")

describe("formatoDe", () => {
  it("acepta PDF, DOCX, JPG (y JPEG) y PNG cuando el contenido corresponde a la extensión", () => {
    expect(formatoDe("taller.pdf", BYTES.pdf)).toEqual({ extension: "pdf", mime: "application/pdf" });
    expect(formatoDe("Taller Final.PDF", BYTES.pdf)?.extension).toBe("pdf");
    expect(formatoDe("informe.docx", BYTES.docx)).toEqual({
      extension: "docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(formatoDe("foto.jpg", BYTES.jpg)).toEqual({ extension: "jpg", mime: "image/jpeg" });
    expect(formatoDe("foto.jpeg", BYTES.jpg)?.extension).toBe("jpg");
    expect(formatoDe("captura.png", BYTES.png)).toEqual({ extension: "png", mime: "image/png" });
  });

  it("rechaza otros formatos", () => {
    expect(formatoDe("notas.txt", BYTES.texto)).toBeNull();
    expect(formatoDe("sin-extension", BYTES.pdf)).toBeNull();
  });

  it("rechaza un archivo cuyo contenido no corresponde a su extensión (un ejecutable renombrado como .pdf)", () => {
    expect(formatoDe("tarea.pdf", BYTES.exe)).toBeNull();
    expect(formatoDe("foto.png", BYTES.jpg)).toBeNull();
    expect(formatoDe("vacio.pdf", new Uint8Array())).toBeNull();
  });
});

// Pruebas de contrato: KV y R2 deben comportarse igual (D7). El día de pasar a R2, ya está probado.
const almacenes: [string, AlmacenArchivos][] = [
  ["KV", new AlmacenKV(env.ARCHIVOS_KV)],
  ["R2", new AlmacenR2((env as unknown as { ARCHIVOS_R2: R2Bucket }).ARCHIVOS_R2)],
];

describe.each(almacenes)("AlmacenArchivos con %s", (nombre, almacen) => {
  const llave = `pruebas/${nombre}/taller.pdf`;

  it("guarda y devuelve el mismo contenido, con su tipo y su tamaño", async () => {
    await almacen.guardar(llave, BYTES.pdf.buffer as ArrayBuffer, "application/pdf");

    const archivo = await almacen.obtener(llave);

    expect(archivo).not.toBeNull();
    expect(archivo?.tipo).toBe("application/pdf");
    expect(archivo?.tamano).toBe(BYTES.pdf.byteLength);
    expect(new Uint8Array(await new Response(archivo?.cuerpo).arrayBuffer())).toEqual(BYTES.pdf);
  });

  it("después de eliminarlo, ya no existe", async () => {
    await almacen.guardar(`${llave}.2`, BYTES.png.buffer as ArrayBuffer, "image/png");

    await almacen.eliminar(`${llave}.2`);

    expect(await almacen.obtener(`${llave}.2`)).toBeNull();
  });

  it("una llave que no existe devuelve null y eliminarla no falla", async () => {
    expect(await almacen.obtener("pruebas/no-existe.pdf")).toBeNull();
    await expect(almacen.eliminar("pruebas/no-existe.pdf")).resolves.toBeUndefined();
  });
});
