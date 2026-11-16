// Ayudas de acceso a D1 compartidas por las rutas

type Tabla = "carreras" | "cursos" | "usuarios";

// UPDATE solo con las columnas que llegaron (las undefined se ignoran). Los nombres de columna salen de
// un mapa fijo escrito en cada ruta, nunca del cliente, así que no hay inyección SQL; los valores van
// siempre como parámetros. Los booleanos se guardan como 0 o 1, igual que los CHECK del esquema.
export function actualizar(db: D1Database, tabla: Tabla, id: number, columnas: Record<string, unknown>): D1PreparedStatement | null {
  const pares = Object.entries(columnas).filter(([, valor]) => valor !== undefined);
  if (pares.length === 0) return null;
  const asignaciones = pares.map(([columna]) => `${columna} = ?`).join(", ");
  const valores = pares.map(([, valor]) => (typeof valor === "boolean" ? Number(valor) : valor));
  return db.prepare(`UPDATE ${tabla} SET ${asignaciones} WHERE id = ?`).bind(...valores, id);
}
