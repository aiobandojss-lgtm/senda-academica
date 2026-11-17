import { type Context, Hono } from "hono";
import { almacenDe } from "../archivos/almacen";
import { idDeRuta, responderError } from "../errores";
import { accesoDenegado } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";
import { actividadVisible } from "./acceso";

// Descarga protegida (spec "Acceso privado a los archivos", design.md D7): ningún archivo tiene una URL
// pública; todos pasan por aquí, que revisa los permisos en cada petición.
export const archivos = new Hono<AppEnv>();

// Nombre del archivo para el navegador: una versión ASCII para los navegadores antiguos y la original en
// UTF-8 (RFC 6266 y 5987), así "Mi taller ñandú.pdf" se descarga con su nombre
function disposicion(nombre: string) {
  const ascii =
    nombre
      .normalize("NFD")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/["\\]/g, "_")
      .trim() || "archivo";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

async function enviarArchivo(c: Context<AppEnv>, llave: string, nombre: string) {
  const archivo = await almacenDe(c.env).obtener(llave);
  if (!archivo) return responderError(c, 404, "ARCHIVO_NO_ENCONTRADO", "El archivo ya no está disponible");
  return new Response(archivo.cuerpo, {
    headers: {
      "Content-Type": archivo.tipo,
      "Content-Length": String(archivo.tamano),
      // Siempre como descarga: nunca se abre dentro de la plataforma como si fuera parte de ella
      "Content-Disposition": disposicion(nombre),
      // Archivos personales: ni el navegador compartido ni un proxy deben guardarlos (Habeas Data)
      "Cache-Control": "private, no-store",
      // El navegador debe respetar el tipo declarado y no "adivinar" otro (evita ejecutar contenido)
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// La entrega la descargan su autor, el docente del curso y el administrador
archivos.get("/entregas/:id", async (c) => {
  const id = idDeRuta(c);
  const entrega = id
    ? await c.env.DB.prepare(
        `SELECT e.estudiante_id, e.archivo_key, e.nombre_archivo, k.docente_id
           FROM entregas e JOIN actividades a ON a.id = e.actividad_id JOIN cursos k ON k.id = a.curso_id
          WHERE e.id = ?`,
      )
        .bind(id)
        .first<{ estudiante_id: number; archivo_key: string; nombre_archivo: string; docente_id: number | null }>()
    : null;
  if (!entrega) return responderError(c, 404, "ENTREGA_NO_ENCONTRADA", "La entrega no existe");

  const usuario = c.var.usuario;
  const puede =
    usuario.rol === "admin" ||
    (usuario.rol === "docente" && entrega.docente_id === usuario.id) ||
    (usuario.rol === "estudiante" && entrega.estudiante_id === usuario.id);
  if (!puede) return accesoDenegado(c);
  return enviarArchivo(c, entrega.archivo_key, entrega.nombre_archivo);
});

// El archivo de apoyo lo descargan quienes pueden ver la actividad: su docente, el administrador y los
// estudiantes del curso si está publicada
archivos.get("/apoyos/:id", async (c) => {
  const actividad = await actividadVisible(c, idDeRuta(c));
  if (actividad instanceof Response) return actividad;
  if (!actividad.archivo_apoyo_key) return responderError(c, 404, "ARCHIVO_NO_ENCONTRADO", "Esta actividad no tiene archivo de apoyo");
  const extension = actividad.archivo_apoyo_key.split(".").pop();
  return enviarArchivo(c, actividad.archivo_apoyo_key, `Apoyo - ${actividad.titulo}.${extension}`);
});
