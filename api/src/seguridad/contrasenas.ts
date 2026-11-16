// Contraseñas: hash PBKDF2-SHA256 (design.md D5, ADR-003) y contraseñas temporales (D17).
// Formato guardado: pbkdf2_sha256$<iteraciones>$<sal_base64>$<hash_base64>

const ALGORITMO = "pbkdf2_sha256";
// Máximo que acepta Web Crypto en Workers; ADR-003 explica por qué se mantiene en el plan Free
const ITERACIONES = 100_000;
const BYTES_SAL = 16;
const BYTES_HASH = 32;
const ERROR_FORMATO = "Formato de hash de contraseña no reconocido";

// Hash con formato válido (sal y hash en ceros) que no corresponde a ninguna contraseña real.
// El ingreso lo verifica cuando el documento no existe, para tardar lo mismo que con un documento real:
// así el tiempo de respuesta no revela qué documentos están registrados. Usa ITERACIONES para seguir
// costando lo mismo si algún día cambian (plan B del ADR-003).
export const HASH_SIMULADO = `${ALGORITMO}$${ITERACIONES}$${"A".repeat(22)}==$${"A".repeat(43)}=`;

// Sin caracteres ambiguos al leerlos o dictarlos: 0 O o 1 l I (56 símbolos, unos 58 bits en 10 caracteres)
export const ALFABETO_TEMPORAL = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const LONGITUD_TEMPORAL = 10;

const codificador = new TextEncoder();

const aBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

function deBase64(texto: string): Uint8Array {
  try {
    return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
  } catch {
    throw new Error(ERROR_FORMATO);
  }
}

// NFKC: la misma contraseña escrita en teclados distintos (por ejemplo, la ñ compuesta o precompuesta) da los mismos bytes
async function derivar(contrasena: string, sal: Uint8Array, iteraciones: number): Promise<Uint8Array> {
  const clave = await crypto.subtle.importKey("raw", codificador.encode(contrasena.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteraciones }, clave, BYTES_HASH * 8);
  return new Uint8Array(bits);
}

export async function hashContrasena(contrasena: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(BYTES_SAL));
  const hash = await derivar(contrasena, sal, ITERACIONES);
  return `${ALGORITMO}$${ITERACIONES}$${aBase64(sal)}$${aBase64(hash)}`;
}

// Las iteraciones y la sal se leen del propio hash: así conviven hashes con distintas iteraciones (plan B del ADR-003).
// Un hash con formato inválido es un problema de datos, no una contraseña incorrecta: por eso lanza un error.
export async function verificarContrasena(contrasena: string, hashGuardado: string): Promise<boolean> {
  const partes = hashGuardado.split("$");
  if (partes.length !== 4 || partes[0] !== ALGORITMO) throw new Error(ERROR_FORMATO);

  const iteraciones = Number(partes[1]);
  if (!Number.isInteger(iteraciones) || iteraciones < 1 || iteraciones > ITERACIONES) throw new Error(ERROR_FORMATO);

  const sal = deBase64(partes[2]);
  const esperado = deBase64(partes[3]);
  if (sal.byteLength !== BYTES_SAL || esperado.byteLength !== BYTES_HASH) throw new Error(ERROR_FORMATO);

  const calculado = await derivar(contrasena, sal, iteraciones);
  // Comparación en tiempo constante: no revela cuántos bytes coinciden
  return crypto.subtle.timingSafeEqual(calculado, esperado);
}

// Muestreo con rechazo: solo se aceptan bytes menores que el mayor múltiplo de 56 que cabe en 256 (224),
// así cada carácter tiene la misma probabilidad (byte % 56 favorecería a los primeros del alfabeto)
export function generarContrasenaTemporal(): string {
  const limite = 256 - (256 % ALFABETO_TEMPORAL.length);
  let resultado = "";
  while (resultado.length < LONGITUD_TEMPORAL) {
    for (const byte of crypto.getRandomValues(new Uint8Array(LONGITUD_TEMPORAL * 2))) {
      if (byte < limite && resultado.length < LONGITUD_TEMPORAL) resultado += ALFABETO_TEMPORAL[byte % ALFABETO_TEMPORAL.length];
    }
  }
  return resultado;
}
