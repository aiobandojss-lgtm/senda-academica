# Proposal

## Why

La Fundación está comenzando y no tiene cómo gestionar a sus estudiantes, recibir sus talleres ni controlar los pagos. Necesita una plataforma web sencilla y de costo casi cero, operativa en 2 semanas, que además bloquee el acceso a quien tenga una cuota con más de 30 días de vencida.

El producto se llama **Senda** (nombre genérico e independiente de la Fundación: el software es de CREATIVE BY CODE y la Fundación recibe una licencia de uso). El nombre del producto y el de la institución son configurables.

## What Changes

- Catálogo de carreras y registro de estudiantes asociados a una carrera, con carga masiva desde un archivo CSV exportado de Excel e inscripción automática en los cursos de su semestre.
- Acceso individual con usuario (número de documento) y contraseña, con roles administrador, docente y estudiante.
- Protección del acceso: límite de intentos de ingreso, invalidación de sesiones al restablecer la contraseña o desactivar un usuario, y contraseñas temporales que solo se muestran una vez.
- Aceptación del aviso de privacidad en el primer ingreso (Ley 1581 de 2012), con versión y fecha guardadas.
- Cursos por carrera, con talleres y evaluaciones publicados por el docente; el estudiante sube su entrega y el docente la califica (escala 0.0 a 5.0).
- Plan de cuotas por estudiante, registro manual de pagos (totales o parciales) con soporte opcional, y estado de cuenta.
- Bloqueo automático de acceso al estudiante con una cuota vencida hace más de 30 días, con excepciones autorizadas por el administrador.
- Aplicación web responsiva en español.

Fuera del alcance de este cambio: app móvil nativa, pasarela de pagos en línea, facturación electrónica, certificados y boletines, clases en vivo, inscripción en línea de aspirantes, notificaciones por WhatsApp o SMS, **recuperación de contraseña por correo** (fase posterior: por ahora el administrador restablece la contraseña), **periodos académicos** (fase posterior: el MVP opera un periodo a la vez), manejo especial de estudiantes menores de edad, becas y descuentos, y el asistente con IA (va en el cambio `asistente-academico-rag`).

## Capabilities

### New Capabilities
- `carreras-estudiantes`: catálogo de carreras y cursos, registro, consulta, carga masiva, inscripción automática, y activación o desactivación de estudiantes y docentes.
- `autenticacion`: inicio de sesión, límite de intentos, contraseñas, sesiones, aviso de privacidad, roles y permisos por rol.
- `actividades-entregas`: talleres y evaluaciones por curso, entregas de archivos y calificación.
- `cartera`: plan de cuotas, registro y anulación de pagos, y estado de cuenta.
- `bloqueo-mora`: estados de cartera, regla de bloqueo por mora de más de 30 días y sus excepciones.

### Modified Capabilities
<!-- Ninguna: el proyecto parte de cero. -->

## Impact

- Proyecto nuevo: Worker de Cloudflare `senda` (API y frontend), base D1 y almacén de archivos (Workers KV en la demo, R2 en producción).
- Datos personales de estudiantes (nombre, documento, correo): aplica la Ley 1581 de 2012; la Fundación es responsable y CREATIVE BY CODE encargado. El texto del aviso de privacidad lo aporta la Fundación.
- Mientras no existan datos reales, la base se carga con datos ficticios mediante un script de seed que luego se reemplaza por la carga real.
