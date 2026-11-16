// Límite de intentos de ingreso por documento (design.md D14): 5 intentos fallidos en 15 minutos.
// Se cuenta por documento, exista o no, y no por IP: los estudiantes comparten la red de las salas de la Fundación.

const MAXIMO_FALLOS = 5;
const VENTANA = "-15 minutes";
const RETENCION = "-1 day";
// Mismo formato de fecha-hora que creado_en (D9): así las fechas se comparan como texto
const AHORA_MAS = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?)";

/**
 * Registra el intento ANTES de verificar la contraseña y dice si se permite verificarla.
 *
 * Inserción y conteo van en un solo batch, que D1 ejecuta como transacción: aunque lleguen
 * muchos intentos a la vez, cada uno ve el conteo exacto y solo pasan los primeros 5.
 * Si se contara primero e insertara después, una ráfaga simultánea vería "0 fallos" y se saltaría el límite.
 *
 * La fila queda como fallo si la contraseña resulta incorrecta; si es correcta se borra con limpiarIntentos.
 */
export async function registrarIntento(db: D1Database, documento: string): Promise<boolean> {
  const [, registro, conteo] = await db.batch<{ id?: number; n?: number }>([
    // Limpieza oportunista: nadie necesita fallos de hace más de un día
    db.prepare(`DELETE FROM intentos_fallidos WHERE creado_en < ${AHORA_MAS}`).bind(RETENCION),
    db.prepare("INSERT INTO intentos_fallidos (documento) VALUES (?) RETURNING id").bind(documento),
    db.prepare(`SELECT COUNT(*) AS n FROM intentos_fallidos WHERE documento = ? AND creado_en > ${AHORA_MAS}`).bind(
      documento,
      VENTANA,
    ),
  ]);

  // El conteo incluye este intento: más de 5 significa que ya hubo 5 fallos en la ventana
  if ((conteo.results[0]?.n ?? 0) <= MAXIMO_FALLOS) return true;

  // Bloqueado: se borra su fila para que los intentos durante el bloqueo no lo alarguen
  await db.prepare("DELETE FROM intentos_fallidos WHERE id = ?").bind(registro.results[0]?.id).run();
  return false;
}

// Contraseña correcta: el conteo del documento vuelve a cero
export async function limpiarIntentos(db: D1Database, documento: string): Promise<void> {
  await db.prepare("DELETE FROM intentos_fallidos WHERE documento = ?").bind(documento).run();
}
