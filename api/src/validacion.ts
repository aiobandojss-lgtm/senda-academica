import { z } from "zod";

// Campos que se repiten entre recursos, con mensajes en español por campo (los muestra validarJson).
// Docentes los usan en la tarea 3.1; estudiantes y la carga masiva, en la 3.2 y la 3.3.

// Texto obligatorio, sin espacios sobrantes
export const texto = (mensajeVacio: string, maximo: number, nombre: string) =>
  z
    .string({ error: mensajeVacio })
    .trim()
    .min(1, mensajeVacio)
    .max(maximo, `${nombre} tiene máximo ${maximo} caracteres`);

// Texto opcional: vacío o ausente se guarda como NULL
export const textoOpcional = (maximo: number, nombre: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string({ error: `${nombre} debe ser texto` }).trim().max(maximo, `${nombre} tiene máximo ${maximo} caracteres`).nullable(),
  );

// Igual que el CHECK de usuarios.tipo_documento en migrations/0001_inicial.sql
export const TIPOS_DOCUMENTO = ["CC", "TI", "CE", "PPT", "PA"] as const;

export const campoTipoDocumento = z.enum(TIPOS_DOCUMENTO, { error: "Elige el tipo de documento: CC, TI, CE, PPT o PA" });

// Es el usuario para ingresar: sin puntos ni espacios, como lo escribe la persona en la pantalla de ingreso
export const campoDocumento = z
  .string({ error: "Escribe el número de documento" })
  .trim()
  .regex(/^[A-Za-z0-9]{3,20}$/, "Escribe el documento sin puntos ni espacios (de 3 a 20 letras o números)");

export const campoNombres = texto("Escribe los nombres", 80, "Los nombres");
export const campoApellidos = texto("Escribe los apellidos", 80, "Los apellidos");

export const campoCorreo = z
  .string({ error: "Escribe el correo" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Escribe un correo válido, por ejemplo nombre@correo.com" }).max(120, "El correo tiene máximo 120 caracteres"));

// Opcional. Se guarda solo con dígitos (y un + inicial): se quitan espacios y guiones
export const campoCelular = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const limpio = v.replace(/[\s-]/g, "");
    return limpio === "" ? null : limpio;
  },
  z.string().regex(/^\+?\d{7,15}$/, "Escribe el celular solo con números, de 7 a 15 dígitos").nullable(),
);

// Al menos un campo con valor en un PATCH
export const conCambios = (cambios: Record<string, unknown>) => Object.values(cambios).some((v) => v !== undefined);
export const MENSAJE_SIN_CAMBIOS = "No hay cambios para guardar";
