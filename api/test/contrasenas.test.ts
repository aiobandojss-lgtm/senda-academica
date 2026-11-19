import { describe, expect, it } from "vitest";
import {
  ALFABETO_TEMPORAL,
  generarContrasenaTemporal,
  hashContrasena,
  validarContrasenaNueva,
  verificarContrasena,
} from "../src/seguridad/contrasenas";

// Hash real del seed (administrador 9900000001), generado en Node con pbkdf2Sync:
// si verifica aquí, el código del Worker es compatible con los datos ya cargados en D1
const HASH_SEED_ADMIN = "pbkdf2_sha256$100000$0WJn7EdfYX0woFsQFoqCSA==$sXKTSUWDSrTUppDWm31kc7VQdJpmGrV0c3tHNhlPwA4=";

const bytesDeBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

describe("verificarContrasena", () => {
  it("acepta la contraseña del seed contra su hash generado en Node", async () => {
    expect(await verificarContrasena("Demo2026*", HASH_SEED_ADMIN)).toBe(true);
  });

  it("rechaza contraseñas distintas, incluso las que solo cambian una mayúscula o un carácter", async () => {
    expect(await verificarContrasena("demo2026*", HASH_SEED_ADMIN)).toBe(false);
    expect(await verificarContrasena("Demo2026", HASH_SEED_ADMIN)).toBe(false);
    expect(await verificarContrasena("", HASH_SEED_ADMIN)).toBe(false);
  });

  it("lanza un error si el hash guardado no tiene el formato de design.md D5", async () => {
    const malos = [
      "Demo2026*", // texto plano
      "md5$100000$0WJn7EdfYX0woFsQFoqCSA==$sXKTSUWDSrTUppDWm31kc7VQdJpmGrV0c3tHNhlPwA4=", // otro algoritmo
      "pbkdf2_sha256$0$0WJn7EdfYX0woFsQFoqCSA==$sXKTSUWDSrTUppDWm31kc7VQdJpmGrV0c3tHNhlPwA4=", // iteraciones fuera de rango
      "pbkdf2_sha256$100000$c2Fs$sXKTSUWDSrTUppDWm31kc7VQdJpmGrV0c3tHNhlPwA4=", // sal de 3 bytes
      "pbkdf2_sha256$100000$0WJn7EdfYX0woFsQFoqCSA==$no-es-base64!", // hash inválido
    ];
    for (const malo of malos) {
      await expect(verificarContrasena("Demo2026*", malo)).rejects.toThrow("Formato de hash de contraseña no reconocido");
    }
  });
});

describe("hashContrasena", () => {
  it("produce el formato pbkdf2_sha256$100000$<sal de 16 bytes>$<hash de 32 bytes>", async () => {
    const [algoritmo, iteraciones, sal, hash, ...resto] = (await hashContrasena("Demo2026*")).split("$");

    expect(algoritmo).toBe("pbkdf2_sha256");
    expect(iteraciones).toBe("100000");
    expect(bytesDeBase64(sal).byteLength).toBe(16);
    expect(bytesDeBase64(hash).byteLength).toBe(32);
    expect(resto).toEqual([]);
  });

  it("usa una sal distinta cada vez: la misma contraseña da hashes diferentes y ambos verifican", async () => {
    const a = await hashContrasena("Demo2026*");
    const b = await hashContrasena("Demo2026*");

    expect(a).not.toBe(b);
    expect(await verificarContrasena("Demo2026*", a)).toBe(true);
    expect(await verificarContrasena("Demo2026*", b)).toBe(true);
    expect(await verificarContrasena("Demo2026+", a)).toBe(false);
  });

  it("acepta igual la ñ escrita como un carácter o como n + virgulilla (normalización NFKC)", async () => {
    const precompuesta = "Montaña2026"; // ñ = U+00F1
    const descompuesta = "Montaña2026"; // n + U+0303, como la envían algunos teclados

    expect(precompuesta).not.toBe(descompuesta);
    expect(await verificarContrasena(descompuesta, await hashContrasena(precompuesta))).toBe(true);
  });
});

describe("validarContrasenaNueva (spec `autenticacion`, tarea 2.5)", () => {
  const datos = { documento: "1000123456", actual: "Kp7mRt2xQa" };

  it("acepta una contraseña de 8 caracteres o más, distinta del documento y de la actual", () => {
    expect(validarContrasenaNueva("Montaña2026", datos)).toBeNull();
    expect(validarContrasenaNueva("12345678", datos)).toBeNull();
  });

  it("Contraseña nueva muy corta: rechaza menos de 8 caracteres e indica el mínimo", () => {
    expect(validarContrasenaNueva("Corta12", datos)).toEqual({
      codigo: "CONTRASENA_CORTA",
      mensaje: "La contraseña nueva debe tener al menos 8 caracteres",
    });
  });

  it("cuenta caracteres, no unidades de UTF-16: 7 caracteres con un emoji siguen siendo 7", () => {
    // "🌱" ocupa 2 unidades de UTF-16: con .length este texto mediría 8
    expect(validarContrasenaNueva("Senda🌱1", datos)?.codigo).toBe("CONTRASENA_CORTA");
  });

  it("Contraseña igual al documento: rechaza el número de documento, también con espacios alrededor", () => {
    for (const nueva of ["1000123456", " 1000123456 "]) {
      expect(validarContrasenaNueva(nueva, datos)).toEqual({
        codigo: "CONTRASENA_IGUAL_DOCUMENTO",
        mensaje: "La contraseña nueva no puede ser igual a tu número de documento",
      });
    }
  });

  it("Contraseña nueva igual a la temporal: rechaza la misma contraseña actual (por ejemplo, la temporal que entregó el administrador)", () => {
    expect(validarContrasenaNueva("Kp7mRt2xQa", datos)).toEqual({
      codigo: "CONTRASENA_IGUAL_ACTUAL",
      mensaje: "La contraseña nueva debe ser distinta de la actual",
    });
  });

  it("compara con la actual como lo hace el hash (NFKC): la ñ compuesta o precompuesta es la misma contraseña", () => {
    const precompuesta = "Montaña2026"; // ñ = U+00F1
    const descompuesta = "Montaña2026"; // n + virgulilla U+0303

    expect(precompuesta).not.toBe(descompuesta);
    expect(validarContrasenaNueva(precompuesta, { ...datos, actual: descompuesta })?.codigo).toBe("CONTRASENA_IGUAL_ACTUAL");
  });
});

describe("generarContrasenaTemporal", () => {
  const muestras = Array.from({ length: 2000 }, () => generarContrasenaTemporal());

  it("tiene 10 caracteres", () => {
    for (const c of muestras) expect(c).toHaveLength(10);
  });

  it("no usa caracteres ambiguos (0, O, o, 1, l, I)", () => {
    expect(ALFABETO_TEMPORAL).not.toMatch(/[0Oo1lI]/);
    // Exige 10 caracteres que no sean ambiguos: una cadena vacía no puede pasar esta prueba en vacío
    for (const c of muestras) expect(c).toMatch(/^[^0Oo1lI]{10}$/);
  });

  it("solo usa caracteres del alfabeto, que son 56 sin repetir", () => {
    expect(new Set(ALFABETO_TEMPORAL).size).toBe(56);
    expect(ALFABETO_TEMPORAL).toHaveLength(56);
    for (const c of muestras) for (const ch of c) expect(ALFABETO_TEMPORAL).toContain(ch);
  });

  it("cubre todo el alfabeto y no repite contraseñas en 2.000 muestras", () => {
    const usados = new Set(muestras.join(""));
    expect(usados.size).toBe(ALFABETO_TEMPORAL.length);
    expect(new Set(muestras).size).toBe(muestras.length);
  });
});
