# Proposal

## Why

Los estudiantes de la Fundación preguntan una y otra vez lo mismo (fechas, reglas de entrega, cómo se califica, cuánto deben) y la Fundación no tiene personal para responder todo el tiempo. Un asistente que responda con los documentos oficiales y los datos reales del estudiante, sin inventar, resuelve esas dudas y es la pieza de IA del proyecto final del curso.

## What Changes

- Base de conocimiento: el administrador carga documentos oficiales (reglamento, calendario, planes de estudio, preguntas frecuentes), que se dividen en fragmentos y se indexan para búsqueda semántica.
- Asistente académico **Senda** dentro de la plataforma para estudiantes: responde con base en esos documentos y en los datos del propio estudiante (actividades pendientes, notas y estado de cuenta), citando la fuente.
- Reglas contra alucinaciones: si no hay información suficiente, el asistente lo dice y remite a la Fundación; no responde temas ajenos a la Fundación.
- Conversaciones guardadas en el servidor: el historial que usa el modelo sale de la base (no del navegador), se cuenta un límite diario de preguntas y los mensajes se borran a los 30 días o cuando el estudiante lo pide.
- Conjunto de preguntas de evaluación para medir que el asistente responde bien y no inventa.

Fuera del alcance: asistente para docentes o administradores, respuestas por WhatsApp (posible bonus aparte), entrenamiento o ajuste fino de modelos, y acciones que modifiquen datos (el asistente solo consulta).

## Capabilities

### New Capabilities
- `base-conocimiento`: carga, actualización, indexación y retiro de los documentos oficiales que alimentan al asistente.
- `asistente-academico`: conversación del estudiante con el asistente, uso de documentos y datos propios, citas, límites y privacidad.

### Modified Capabilities
<!-- Ninguna. Depende de las capacidades del cambio mvp-plataforma-academica (autenticacion, actividades-entregas, cartera, bloqueo-mora) sin cambiar sus requisitos. -->

## Impact

- Nuevos servicios de Cloudflare: Workers AI (embeddings y modelo de lenguaje) y Vectorize (índice vectorial), dentro del plan gratuito.
- Nuevas tablas en D1 para documentos y fragmentos.
- Datos personales: al modelo solo se envían los datos necesarios para responder (nunca documento, correo ni celular).
- Requiere que el cambio `mvp-plataforma-academica` esté implementado.
