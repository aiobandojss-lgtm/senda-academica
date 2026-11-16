// Inscripciones automáticas (design.md D15). Se agregan con INSERT OR IGNORE y nunca se borran solas:
// así un estudiante que avanza de semestre conserva sus entregas y notas anteriores.

// Inscribe en un curso activo a los estudiantes activos de su carrera y semestre. Se usa al crear un
// curso y al reactivarlo. Con `cursoId = null` toma el curso recién creado en el mismo batch: como
// `cursos.id` es INTEGER PRIMARY KEY y los cursos no se borran, el recién insertado es el de id mayor
// (no se usa last_insert_rowid(), que cambia con cada fila que se inserta en inscripciones).
export function inscribirEnCurso(db: D1Database, cursoId: number | null): D1PreparedStatement {
  const sql = `
    INSERT OR IGNORE INTO inscripciones (curso_id, estudiante_id)
    SELECT c.id, e.usuario_id
    FROM cursos c
    JOIN estudiantes e ON e.carrera_id = c.carrera_id AND e.semestre_actual = c.semestre
    JOIN usuarios u ON u.id = e.usuario_id AND u.activo = 1
    WHERE c.activo = 1 AND c.id = ${cursoId === null ? "(SELECT MAX(id) FROM cursos)" : "?"}`;
  return cursoId === null ? db.prepare(sql) : db.prepare(sql).bind(cursoId);
}

// Inscribe a un estudiante activo en los cursos activos de su carrera y semestre actual. Se usa al
// registrarlo, al cambiar su semestre o su carrera y al reactivarlo. Se identifica por documento, que
// es único: así sirve en el mismo batch que crea al usuario, antes de conocer su id. Si el usuario no es
// estudiante (no tiene fila en `estudiantes`), no inscribe nada.
export function inscribirEstudiante(db: D1Database, estudiante: { id: number } | { documento: string }): D1PreparedStatement {
  const porDocumento = "documento" in estudiante;
  const sql = `
    INSERT OR IGNORE INTO inscripciones (curso_id, estudiante_id)
    SELECT c.id, e.usuario_id
    FROM estudiantes e
    JOIN usuarios u ON u.id = e.usuario_id AND u.activo = 1
    JOIN cursos c ON c.carrera_id = e.carrera_id AND c.semestre = e.semestre_actual AND c.activo = 1
    WHERE ${porDocumento ? "u.documento = ?" : "e.usuario_id = ?"}`;
  return db.prepare(sql).bind(porDocumento ? estudiante.documento : estudiante.id);
}
