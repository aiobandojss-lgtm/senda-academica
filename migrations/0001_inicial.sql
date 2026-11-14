-- Migración 0001: esquema inicial del MVP (Cloudflare D1 / SQLite)
-- Fechas de negocio: TEXT 'YYYY-MM-DD'. Fechas-hora: TEXT ISO 8601 en UTC.
-- Dinero: INTEGER en pesos colombianos. Notas: REAL con un decimal (0.0 a 5.0).
-- D1 aplica las llaves foráneas por defecto.

CREATE TABLE carreras (
  id                  INTEGER PRIMARY KEY,
  codigo              TEXT    NOT NULL UNIQUE,
  nombre              TEXT    NOT NULL,
  descripcion         TEXT,
  duracion_semestres  INTEGER NOT NULL CHECK (duracion_semestres BETWEEN 1 AND 12),
  activa              INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  creado_en           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE usuarios (
  id                      INTEGER PRIMARY KEY,
  rol                     TEXT    NOT NULL CHECK (rol IN ('admin', 'docente', 'estudiante')),
  tipo_documento          TEXT    NOT NULL CHECK (tipo_documento IN ('CC', 'TI', 'CE', 'PPT', 'PA')),
  documento               TEXT    NOT NULL UNIQUE,
  nombres                 TEXT    NOT NULL,
  apellidos               TEXT    NOT NULL,
  correo                  TEXT    NOT NULL,
  celular                 TEXT,
  password_hash           TEXT    NOT NULL, -- pbkdf2_sha256$100000$<sal_b64>$<hash_b64>
  debe_cambiar_password   INTEGER NOT NULL DEFAULT 1 CHECK (debe_cambiar_password IN (0, 1)),
  activo                  INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_en               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE estudiantes (
  usuario_id       INTEGER PRIMARY KEY REFERENCES usuarios (id),
  carrera_id       INTEGER NOT NULL REFERENCES carreras (id),
  semestre_actual  INTEGER NOT NULL DEFAULT 1 CHECK (semestre_actual >= 1),
  cohorte          TEXT    NOT NULL,           -- ej. '2026-2'
  fecha_ingreso    TEXT    NOT NULL
);
CREATE INDEX idx_estudiantes_carrera ON estudiantes (carrera_id);

CREATE TABLE cursos (
  id          INTEGER PRIMARY KEY,
  carrera_id  INTEGER NOT NULL REFERENCES carreras (id),
  nombre      TEXT    NOT NULL,
  semestre    INTEGER NOT NULL CHECK (semestre >= 1),
  docente_id  INTEGER REFERENCES usuarios (id),
  activo      INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);
CREATE INDEX idx_cursos_carrera ON cursos (carrera_id, semestre);
CREATE INDEX idx_cursos_docente ON cursos (docente_id);

CREATE TABLE inscripciones (
  curso_id       INTEGER NOT NULL REFERENCES cursos (id),
  estudiante_id  INTEGER NOT NULL REFERENCES estudiantes (usuario_id),
  PRIMARY KEY (curso_id, estudiante_id)
);
CREATE INDEX idx_inscripciones_estudiante ON inscripciones (estudiante_id);

CREATE TABLE actividades (
  id                 INTEGER PRIMARY KEY,
  curso_id           INTEGER NOT NULL REFERENCES cursos (id),
  tipo               TEXT    NOT NULL CHECK (tipo IN ('taller', 'evaluacion')),
  titulo             TEXT    NOT NULL,
  instrucciones      TEXT    NOT NULL,
  fecha_limite       TEXT    NOT NULL,          -- fecha-hora UTC
  archivo_apoyo_key  TEXT,                      -- llave en R2
  publicada          INTEGER NOT NULL DEFAULT 0 CHECK (publicada IN (0, 1)),
  creado_en          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_actividades_curso ON actividades (curso_id);

CREATE TABLE entregas (
  id               INTEGER PRIMARY KEY,
  actividad_id     INTEGER NOT NULL REFERENCES actividades (id),
  estudiante_id    INTEGER NOT NULL REFERENCES estudiantes (usuario_id),
  archivo_key      TEXT    NOT NULL,            -- llave en R2
  nombre_archivo   TEXT    NOT NULL,
  tipo_mime        TEXT    NOT NULL,
  tamano_bytes     INTEGER NOT NULL CHECK (tamano_bytes BETWEEN 1 AND 10485760),
  entregado_en     TEXT    NOT NULL,
  tardia           INTEGER NOT NULL DEFAULT 0 CHECK (tardia IN (0, 1)),
  nota             REAL    CHECK (nota IS NULL OR (nota >= 0 AND nota <= 5)),
  comentario       TEXT,
  calificado_en    TEXT,
  calificado_por   INTEGER REFERENCES usuarios (id),
  UNIQUE (actividad_id, estudiante_id)
);
CREATE INDEX idx_entregas_estudiante ON entregas (estudiante_id);

CREATE TABLE cuotas (
  id                 INTEGER PRIMARY KEY,
  estudiante_id      INTEGER NOT NULL REFERENCES estudiantes (usuario_id),
  concepto           TEXT    NOT NULL,          -- ej. 'Matrícula 2026-2', 'Mensualidad 1/6'
  valor              INTEGER NOT NULL CHECK (valor > 0),
  fecha_vencimiento  TEXT    NOT NULL,
  creado_en          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_cuotas_estudiante ON cuotas (estudiante_id, fecha_vencimiento);

CREATE TABLE pagos (
  id                 INTEGER PRIMARY KEY,
  cuota_id           INTEGER NOT NULL REFERENCES cuotas (id),
  valor              INTEGER NOT NULL CHECK (valor > 0),
  fecha_pago         TEXT    NOT NULL,
  medio              TEXT    NOT NULL CHECK (medio IN ('efectivo', 'transferencia', 'consignacion')),
  soporte_key        TEXT,                      -- llave en R2 (opcional)
  registrado_por     INTEGER NOT NULL REFERENCES usuarios (id),
  registrado_en      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  anulado            INTEGER NOT NULL DEFAULT 0 CHECK (anulado IN (0, 1)),
  motivo_anulacion   TEXT,
  anulado_por        INTEGER REFERENCES usuarios (id),
  anulado_en         TEXT,
  CHECK (anulado = 0 OR motivo_anulacion IS NOT NULL)
);
CREATE INDEX idx_pagos_cuota ON pagos (cuota_id);

CREATE TABLE excepciones_mora (
  id             INTEGER PRIMARY KEY,
  estudiante_id  INTEGER NOT NULL REFERENCES estudiantes (usuario_id),
  motivo         TEXT    NOT NULL,
  hasta          TEXT    NOT NULL,              -- inclusive
  creado_por     INTEGER NOT NULL REFERENCES usuarios (id),
  creado_en      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_excepciones_estudiante ON excepciones_mora (estudiante_id, hasta);

-- Saldo por cuota (pagos anulados no cuentan). Base para estado de cuenta y mora.
CREATE VIEW v_saldo_cuotas AS
SELECT
  c.id                AS cuota_id,
  c.estudiante_id,
  c.concepto,
  c.valor,
  c.fecha_vencimiento,
  COALESCE(SUM(CASE WHEN p.anulado = 0 THEN p.valor END), 0)            AS pagado,
  c.valor - COALESCE(SUM(CASE WHEN p.anulado = 0 THEN p.valor END), 0)  AS saldo
FROM cuotas c
LEFT JOIN pagos p ON p.cuota_id = c.id
GROUP BY c.id;
