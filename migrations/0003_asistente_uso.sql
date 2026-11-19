-- Migración 0003: contador del límite diario del asistente Senda (cambio asistente-academico-rag, design.md D9).
--
-- Cuenta las preguntas respondidas de cada estudiante en cada día de Colombia. Va aparte de asistente_mensajes
-- porque el estudiante puede borrar su historial (D10): si el límite se contara con esas filas, borrar el
-- historial reiniciaría el conteo y una sola persona podría agotar la cuota gratuita de Workers AI de toda la
-- cuenta. Solo guarda números, nunca el contenido de las preguntas.

CREATE TABLE asistente_uso (
  usuario_id  INTEGER NOT NULL REFERENCES usuarios (id),
  -- Día de Colombia (America/Bogota), YYYY-MM-DD, como las demás fechas de negocio
  fecha       TEXT    NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  preguntas   INTEGER NOT NULL CHECK (preguntas > 0),
  PRIMARY KEY (usuario_id, fecha)
);

-- Depuración diaria de los contadores de más de 30 días (D10)
CREATE INDEX idx_asistente_uso_fecha ON asistente_uso (fecha);
