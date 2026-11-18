-- Migración 0002: base de conocimiento e historial del asistente Senda (cambio asistente-academico-rag, tarea 1.3).
-- Fechas-hora en UTC con el formato YYYY-MM-DDTHH:MM:SSZ, como en 0001.

-- Documentos oficiales que el asistente puede citar (spec base-conocimiento).
-- carrera_id NULL = documento general. En los metadatos de Vectorize los generales llevan 0 (design.md D2).
-- carrera_id NO tiene llave foránea a carreras, a propósito:
--   - El seed de la demo borra y recrea las carreras (con los mismos ids). Con llave foránea, recargarlo fallaría
--     en cuanto haya un plan de estudios cargado, y la recarga del viernes 20 en la base remota es parte del plan.
--   - Borrar los documentos junto con las carreras (ON DELETE CASCADE) dejaría vectores huérfanos en Vectorize;
--     pasarlos a generales (SET NULL) mostraría el plan de una carrera a todas. Las dos opciones son peores.
--   - La API valida que la carrera exista al cargar el documento, y la aplicación nunca borra carreras (solo las
--     desactiva). Si una carrera faltara, su documento no le aparecería a nadie: falla hacia el lado seguro.
CREATE TABLE documentos (
  id              INTEGER PRIMARY KEY,
  -- Identificador estable para reemplazar un documento sin duplicarlo (el nombre del archivo, sin extensión)
  clave           TEXT    NOT NULL UNIQUE CHECK (length(clave) BETWEEN 1 AND 60 AND clave NOT GLOB '*[^A-Za-z0-9-]*'),
  titulo          TEXT    NOT NULL CHECK (length(titulo) BETWEEN 1 AND 200),
  tipo            TEXT    NOT NULL CHECK (tipo IN ('reglamento', 'calendario', 'plan_estudios', 'preguntas_frecuentes', 'otro')),
  carrera_id      INTEGER CHECK (carrera_id IS NULL OR carrera_id > 0),
  -- Texto completo en Markdown: permite volver a indexar desde D1 si cambia el modelo de embeddings
  contenido       TEXT    NOT NULL CHECK (length(contenido) > 0),
  cargado_en      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Fragmentos por sección (design.md D3). El texto vive aquí; Vectorize guarda solo el vector y los metadatos.
-- AUTOINCREMENT garantiza que un id borrado NUNCA se reutiliza: el id del vector sale de este id, y como
-- Vectorize tarda unos segundos en aplicar un borrado, un vector viejo jamás debe apuntar a un fragmento nuevo.
-- Al cruzar cada resultado de Vectorize con esta tabla, lo que ya no existe se descarta.
CREATE TABLE fragmentos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  documento_id  INTEGER NOT NULL REFERENCES documentos (id) ON DELETE CASCADE,
  orden         INTEGER NOT NULL CHECK (orden >= 0),
  -- Ruta de la sección para citar, por ejemplo "Entregas de talleres"
  seccion       TEXT    NOT NULL CHECK (length(seccion) > 0),
  contenido     TEXT    NOT NULL CHECK (length(contenido) > 0),
  UNIQUE (documento_id, orden)
);

-- Historial de la conversación del estudiante con el asistente (design.md D8), con retención de 30 días (D10).
-- Una pregunta que no obtuvo respuesta porque falló el servicio de IA no se guarda (D11).
CREATE TABLE asistente_mensajes (
  id            INTEGER PRIMARY KEY,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios (id),
  rol           TEXT    NOT NULL CHECK (rol IN ('usuario', 'asistente')),
  contenido     TEXT    NOT NULL CHECK (length(contenido) > 0),
  -- Fuentes citadas en la respuesta: [{ "documento": "...", "seccion": "..." }]. Solo las respuestas del asistente las tienen
  fuentes_json  TEXT    CHECK (fuentes_json IS NULL OR json_valid(fuentes_json)),
  creado_en     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (rol = 'asistente' OR fuentes_json IS NULL)
);
-- Historial (últimos turnos) y límite diario (preguntas desde las 00:00 de hoy en Colombia) de un estudiante
CREATE INDEX idx_asistente_mensajes_usuario ON asistente_mensajes (usuario_id, creado_en);
-- Depuración diaria de los mensajes de más de 30 días
CREATE INDEX idx_asistente_mensajes_creado ON asistente_mensajes (creado_en);
