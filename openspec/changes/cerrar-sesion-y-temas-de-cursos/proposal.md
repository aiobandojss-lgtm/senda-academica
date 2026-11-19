# Proposal

## Why

El 19 de noviembre, el subagente revisor-spec encontró dos escenarios en los que el código y la spec no coinciden, y Aymer decidió cómo resolver cada uno:

- **Cerrar sesión (spec `autenticacion`).** La spec dice que, al cerrar sesión, "la sesión deja de ser válida". Hoy `POST /api/auth/salir` solo borra la cookie del navegador: si alguien copió la cookie antes, el token sigue sirviendo hasta que vence, 8 horas después del ingreso. En una sala de cómputo compartida, que es como estudian muchos estudiantes de la Fundación, eso es un riesgo real. **Decisión: el código se pone al día con la spec.**
- **"¿Qué es un arreglo?" (spec `asistente-academico`).** El THEN dice que el asistente "responde que no tiene esa información". Pero la regla 7 de las instrucciones del modelo (`api/src/rag/agente.ts`) le pide responder que solo ayuda con temas de la Fundación y no explicar temas de los cursos. El modelo real hace eso: en la evaluación del 19 respondió "Lo siento, solo ayudo con temas de Fundación (demo)". Lo esencial, que no explique el tema con conocimiento propio, se cumple y está medido. **Decisión: la spec se ajusta a lo diseñado.** Cambiar el prompt cuatro días antes de la presentación obligaría a repetir la evaluación (unas 800 neuronas y 26 de las 30 preguntas diarias de la estudiante) y podría mover otras respuestas.

Se hace ahora porque la presentación (lunes 23 de noviembre) muestra la trazabilidad entre las specs y las pruebas como evidencia: cada escenario debe describir lo que el sistema hace de verdad.

## What Changes

- Cerrar sesión invalida el token en el servidor: sube la versión de sesión del usuario (`usuarios.sesion_version`, design.md D4 del MVP), con lo que cualquier copia del token deja de servir de inmediato.
- **Cambio de comportamiento visible:** cerrar sesión en un equipo también cierra las sesiones del mismo usuario en sus otros equipos (por ejemplo, el celular y un computador). Aymer lo aceptó: es lo esperable en un equipo compartido.
- Un token viejo, que ya no es válido, no puede cerrar las sesiones vigentes del usuario.
- `POST /api/auth/salir` mantiene su contrato: siempre responde 204 y borra la cookie, haya o no sesión.
- El THEN de "Pedir que explique un tema de un curso" acepta las dos respuestas que no explican el tema: que no tiene esa información o que solo ayuda con temas de la Fundación.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `autenticacion`: en "Cierre y expiración de sesión", el escenario "Cerrar sesión" precisa que la sesión deja de ser válida en el servidor. "Invalidación de sesiones abiertas" agrega el cierre de sesión a los eventos que invalidan todas las sesiones del usuario, con dos escenarios nuevos: el cierre desde otro equipo, y que una sesión ya invalidada no puede cerrar las vigentes.
- `asistente-academico`: el requisito "Solo temas de la Fundación" ajusta el THEN de "Pedir que explique un tema de un curso".

## Impact

- **Código:** `api/src/rutas/auth.ts` (la ruta de salida) y, si hace falta, `api/src/seguridad/sesion.ts`. Sin migraciones: `sesion_version` ya existe y ya la usan el cambio de contraseña, el restablecimiento y la desactivación.
- **Pruebas:** `api/test/auth.test.ts`. La prueba de "Cerrar sesión" pasa a verificar el THEN (un token copiado antes de salir responde 401). Hay prueba nueva para el escenario nuevo, con su nombre, para la trazabilidad.
- **Asistente:** sin cambios de código ni de instrucciones. El caso `explicar-arreglo` de `eval/preguntas.json` ya califica así (`rechaza` y `noContiene`).
- **Frontend:** sin cambios. Ya llama a `/api/auth/salir` y vuelve a la pantalla de ingreso.
- **Demo:** en la presentación cada persona usa su propio navegador. No se debe cerrar la sesión de una persona que esté abierta en otro navegador que se vaya a usar después. Se anota en la preparación del guion.
- **Costo:** una escritura en D1 por cada cierre de sesión. Es despreciable frente a las 100.000 escrituras diarias del plan Free.

## Fuera del alcance

- Cerrar solo la sesión del equipo actual. Requiere una lista de tokens revocados, con una migración y una consulta más por petición; queda para después de la presentación si la Fundación lo pide.
- Un botón de "cerrar sesión en todos los equipos" separado del cierre normal.
- Cambiar las instrucciones del modelo o repetir la evaluación del asistente.
- Los demás hallazgos de la revisión del 19 de noviembre. Ya se corrigieron en el commit `24a77ab` o quedaron en PLAN.md para después de la presentación.
