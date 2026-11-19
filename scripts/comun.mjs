// Funciones compartidas por los scripts que usan la API de Senda: rag-indexar.mjs (tarea RAG 2.3) y eval-rag.mjs
// (tarea RAG 4.1). Las credenciales salen de variables de entorno o se piden en la terminal; nunca se guardan ni se
// imprimen.

import { createInterface } from "node:readline/promises";

// Teclas de control para leer la contraseña sin mostrarla
const ENTER = [10, 13];
const CTRL_C = 3;
const CTRL_D = 4;
const BORRAR = [8, 127];

export async function preguntar(texto) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = await terminal.question(texto);
  terminal.close();
  return respuesta.trim();
}

// Lee la contraseña sin escribirla en pantalla. Si la entrada no es una terminal (por ejemplo, un archivo), la lee tal cual
export function preguntarOculto(texto) {
  if (!process.stdin.isTTY) return preguntar(texto);
  process.stdout.write(texto);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolver, rechazar) => {
    let valor = "";
    const terminar = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", alTeclear);
      process.stdout.write("\n");
    };
    function alTeclear(teclas) {
      for (const tecla of teclas) {
        const codigo = tecla.charCodeAt(0);
        if (ENTER.includes(codigo) || codigo === CTRL_D) {
          terminar();
          return resolver(valor);
        }
        if (codigo === CTRL_C) {
          terminar();
          return rechazar(new Error("Cancelado"));
        }
        if (BORRAR.includes(codigo)) valor = valor.slice(0, -1);
        else valor += tecla;
      }
    }
    process.stdin.on("data", alTeclear);
  });
}

// Cliente de la API en urlBase: convierte los errores { codigo, mensaje } en excepciones con el mensaje en español
export function crearApi(urlBase) {
  return async function api(metodo, ruta, { cookie, cuerpo } = {}) {
    const respuesta = await fetch(`${urlBase}/api${ruta}`, {
      method: metodo,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(cuerpo ? { "Content-Type": "application/json" } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      const error = new Error(datos?.mensaje ?? `La API respondió ${respuesta.status}`);
      error.codigo = datos?.codigo ?? `HTTP_${respuesta.status}`;
      throw error;
    }
    return { datos, respuesta };
  };
}

// Entra con la cuenta de las variables de entorno indicadas o pidiendo los datos en la terminal, y verifica el rol.
// Devuelve la cookie de sesión y el perfil
export async function ingresar(api, { rol, etiqueta, variableDocumento, variableContrasena }) {
  const documento = process.env[variableDocumento] || (await preguntar(`Documento del ${etiqueta}: `));
  const contrasena = process.env[variableContrasena] || (await preguntarOculto("Contraseña: "));
  const { datos: perfil, respuesta } = await api("POST", "/auth/ingresar", { cuerpo: { documento, contrasena } });
  if (perfil.rol !== rol) throw new Error(`La cuenta no es de ${etiqueta}`);
  if (perfil.debeCambiarPassword || perfil.debeAceptarAviso) {
    throw new Error("Esa cuenta debe cambiar su contraseña o aceptar el aviso de privacidad: entra primero por la pantalla de ingreso");
  }
  const sesion = respuesta.headers.getSetCookie().find((c) => c.startsWith("__Host-sesion="));
  if (!sesion) throw new Error("La API no devolvió la cookie de sesión");
  return { cookie: sesion.split(";")[0], perfil };
}
