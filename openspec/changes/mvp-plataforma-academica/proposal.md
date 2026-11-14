# Proposal

## Why

La Fundación está comenzando y no tiene cómo gestionar a sus estudiantes, recibir sus talleres ni controlar los pagos. Necesita una plataforma web sencilla y de costo casi cero, operativa en 2 semanas, que además bloquee el acceso a quien tenga una cuota con más de 30 días de vencida.

## What Changes

- Catálogo de carreras y registro de estudiantes asociados a una carrera, con carga masiva desde un archivo CSV exportado de Excel.
- Acceso individual con usuario (número de documento) y contraseña, con roles administrador, docente y estudiante.
- Cursos por carrera, con talleres y evaluaciones publicados por el docente; el estudiante sube su entrega y el docente la califica (escala 0.0 a 5.0).
- Plan de cuotas por estudiante, registro manual de pagos (totales o parciales) con soporte opcional, y estado de cuenta.
- Bloqueo automático de acceso al estudiante con una cuota vencida hace más de 30 días, con excepciones autorizadas por el administrador.
- Aplicación web responsiva en español.

Fuera del alcance de este cambio: app móvil nativa, pasarela de pagos en línea, facturación electrónica, certificados y boletines, clases en vivo, inscripción en línea de aspirantes, notificaciones por WhatsApp o SMS, y el asistente con IA (va en el cambio `asistente-academico-rag`).

## Capabilities

### New Capabilities
- `carreras-estudiantes`: catálogo de carreras y cursos, registro, consulta y carga masiva de estudiantes y docentes.
- `autenticacion`: inicio de sesión, contraseñas, roles y permisos por rol.
- `actividades-entregas`: talleres y evaluaciones por curso, entregas de archivos y calificación.
- `cartera`: plan de cuotas, registro y anulación de pagos, y estado de cuenta.
- `bloqueo-mora`: regla de bloqueo por mora de más de 30 días y sus excepciones.

### Modified Capabilities
<!-- Ninguna: el proyecto parte de cero. -->

## Impact

- Proyecto nuevo: Worker de Cloudflare (API y frontend), base D1, bucket R2.
- Datos personales de estudiantes (nombre, documento, correo): aplica la Ley 1581 de 2012; la Fundación es responsable y CREATIVE BY CODE encargado.
- Mientras no existan datos reales, la base se carga con datos ficticios mediante un script de seed que luego se reemplaza por la carga real.
