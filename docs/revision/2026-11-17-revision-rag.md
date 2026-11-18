# Revisión y aprobación del cambio `asistente-academico-rag`

**Revisor:** Aymer (dueño del producto) · **Fecha:** 17 de noviembre de 2026 · **Estado:** ✅ aprobado el 18 de noviembre de 2026

Aquí se aprueba **qué** hace el asistente Senda antes de programar su comportamiento (tareas 2.x y 3.x). Lo que apruebes es lo que el asistente hará y lo que defenderás ante el jurado en el criterio 3 de la rúbrica, "IA con fundamento".

## Cómo leer (unos 30 minutos)

1. Abre cada archivo en VS Code y presiona `Ctrl+Shift+V` para ver la vista previa. Todos están en `openspec/changes/asistente-academico-rag/`.
2. Lee **los documentos**, no solo esta guía. La guía señala qué mirar y qué preguntarte, pero lo que se aprueba es lo que dicen las specs.
3. Vocabulario: **SHALL / MUST** es obligatorio, **MUST NOT** está prohibido, y cada **Scenario (WHEN / THEN)** se convierte en una prueba automática.
4. Respóndeme con el número de cada punto y **OK** o el **cambio** que quieres (por ejemplo: "1 OK, 6 cambiar: …, A4 OK"). Yo registro tus decisiones en este documento.

Orden recomendado: `proposal.md` → `specs/asistente-academico/spec.md` → `specs/base-conocimiento/spec.md` → `design.md` (por encima) → los ajustes que propongo (A1 a A5).

---

## Paso 1 · `proposal.md` (3 minutos)

### P1. Lo que queda fuera · línea 15
- **Qué dice:** no hay asistente para docentes ni administradores, no responde por WhatsApp (eso es el bonus aparte), no se entrenan modelos y el asistente **solo consulta**: no cambia ningún dato.
- **Por qué:** cada exclusión reduce el riesgo para la demo. Que el asistente solo consulte es también una guarda de seguridad: aunque el modelo se equivoque, no puede borrar ni modificar nada.
- **Tu decisión:** OK / cambio.

---

## Paso 2 · Las specs (20 minutos)

### `specs/asistente-academico/spec.md`

**1. Solo para estudiantes con acceso** · líneas 9 a 18
- **Qué dice:** se aplican las mismas reglas de sesión y bloqueo por mora que en el resto de la plataforma. Un estudiante bloqueado tampoco usa el asistente.
- **Pregunta:** solo confirmar.

**2. Solo documentos que le aplican** · líneas 20 a 29
- **Qué dice:** el asistente usa los documentos generales y los de la carrera del estudiante. Por ejemplo, Paola (Programación de Software) nunca recibe el plan de estudios de Contabilidad.
- **Pregunta:** solo confirmar.

**3. Toda respuesta cita su fuente** · líneas 31 a 36
- **Qué dice:** la respuesta indica `[Documento – Sección]` y la pantalla muestra las fuentes debajo.
- **⚠️ Error encontrado:** el escenario espera "Reglamento estudiantil – **Entregas**", pero en `docs/rag/reglamento-estudiantil.md` la sección se llama "**Entregas de talleres**". La prueba fallaría por el nombre y no por el comportamiento. Ver el ajuste **A3**.

**4. Reconocer cuando no sabe** · líneas 38 a 43
- **Qué dice:** si no encuentra información suficiente, responde que no la tiene y remite al contacto de la Fundación. Nunca inventa datos, fechas, valores ni normas.
- **Por qué:** es el corazón del criterio 3. Un asistente que dice "no sé" es más confiable que uno que siempre responde.
- **Pregunta:** solo confirmar. El texto definitivo del contacto sale de la variable `CONTACTO_FUNDACION` y lo define la Fundación.

**5. Datos propios, nunca ajenos** · líneas 45 a 58
- **Qué dice:** consulta en el momento sus actividades pendientes, sus notas y su estado de cuenta. Si pregunta por otra persona, se niega.
- **Por qué es seguro:** las herramientas toman el usuario **de la sesión**, nunca del texto de la pregunta. El asistente no tiene forma de pedir los datos de otro estudiante, aunque se lo pidan con insistencia.
- **Pregunta:** solo confirmar.

**6. Solo temas de la Fundación** · líneas 60 a 69
- **Qué dice:** no responde temas ajenos (una receta de cocina) ni resuelve talleres. Esto coincide con la sección "Honestidad académica" del reglamento: la IA se puede usar para estudiar, pero el trabajo entregado debe ser del estudiante.
- **Pregunta para pensar:** ¿debe **explicar temas de los cursos**, por ejemplo "¿qué es un arreglo?"? Con las specs actuales no lo hace: esa explicación no está en los documentos de la Fundación, así que respondería "no tengo esa información". Recomiendo dejarlo así para el MVP: explicar temas sin fuente es justo lo que el criterio 3 penaliza.

**7. Privacidad de lo que se envía al modelo** · líneas 71 a 76
- **Qué dice:** al modelo nunca se le envía el documento, el correo ni el celular del estudiante, ni datos de otros estudiantes.
- **⚠️ Para pensar:** lo que el estudiante **escribe** sí llega al modelo. Si escribe su número de documento en una pregunta, eso se envía.
- **Pregunta:** ¿agregamos en la pantalla del chat una línea como "No escribas datos personales como tu documento o tu celular"? Es un cambio pequeño de interfaz y muestra cuidado con la Ley 1581.

**8. El historial vive en el servidor** · líneas 78 a 87
- **Qué dice:** el asistente recuerda los últimos turnos de la conversación, leídos de la base de datos. Ignora los "mensajes anteriores" que envíe el navegador.
- **Por qué:** si el navegador enviara el historial, alguien podría fabricar un mensaje falso del asistente ("el administrador autorizó tu acceso") para manipular la respuesta. Es un tipo de *prompt injection*.
- **Pregunta:** solo confirmar.

**9. Máximo 30 preguntas por estudiante al día** · líneas 89 a 94
- **Qué dice:** la pregunta 31 del día no llega al modelo. El día se cuenta con la hora de Colombia.
- **⚠️ Para pensar:** el límite que de verdad aprieta es la **cuota gratuita de la cuenta**: 10.000 neuronas diarias **para todos los estudiantes juntos**, que se reinicia a las 7:00 p. m. hora de Colombia. Para la demo sobra. El costo real de una pregunta, con documentos e historial, se mide en la evaluación (tarea 4.1), y con ese dato se sabrá cuántas preguntas por día aguanta la Fundación.
- **Pregunta:** ¿30 preguntas te parece razonable?

**10. Las conversaciones se borran a los 30 días** · líneas 96 a 105
- **Qué dice:** una tarea diaria (Cron Trigger) borra los mensajes de más de 30 días, y el estudiante puede borrar su historial cuando quiera.
- **Por qué:** los mensajes pueden contener datos personales. La Ley 1581 pide no guardarlos más de lo necesario.
- **Pregunta:** solo confirmar.

**⚠️ 11. Lo que no hay: qué pasa si el servicio de IA falla** (no está en la spec)
- **El hueco:** si se agota la cuota del día o Workers AI no responde, ninguna spec dice qué ve el estudiante. Hoy terminaría en un error genérico.
- **Por qué importa para la demo:** si falla en vivo, es mucho mejor un mensaje claro que una pantalla de error.
- **Propuesta:** ver el ajuste **A4**.

### `specs/base-conocimiento/spec.md`

**12. Carga de documentos por el administrador** · líneas 9 a 25
- **Qué dice:** el administrador carga documentos en Markdown o texto, con tipo y, si aplica, carrera. Al terminar, ve cuántos fragmentos se indexaron.
- **⚠️ Lo que no hay:** una **pantalla** para cargar documentos. Las tareas solo incluyen la API y el script `npm run rag:indexar`, así que el número de fragmentos se ve en la salida del script. Para la demo basta. Para la Fundación, un administrador sin conocimientos técnicos necesitará esa pantalla.
- **Pregunta:** ¿la dejamos para después de la presentación? Esa es mi recomendación.

**13. Reemplazar o retirar un documento** · líneas 27 a 36
- **Qué dice:** al reemplazar o retirar un documento se borran sus fragmentos anteriores, y el asistente **nunca** vuelve a usar la versión vieja.
- **⚠️ Detalle técnico:** Vectorize aplica los cambios **unos segundos después**: es *eventualmente consistente*. Lo vimos hoy al crear los índices de metadatos, que quedaron "encolados". Para que ese "nunca" se cumpla de verdad, ver el ajuste **A5**.

**14. Solo el administrador gestiona los documentos** · líneas 38 a 43
- **Pregunta:** solo confirmar.

---

## Paso 3 · `design.md` por encima (5 minutos)

Estas son las decisiones que el jurado te puede preguntar:

| Decisión | En una frase |
|---|---|
| D1 (línea 20) | Todo en Cloudflare (Workers AI + Vectorize), sin costo. El modelo queda detrás de la interfaz `ModeloLenguaje`, así se puede cambiar de proveedor |
| D3 (línea 28) | Los documentos se parten por secciones, no por tamaño fijo: cada fragmento sabe de qué sección viene, y eso permite citar |
| D4 (línea 31) | Agente con 4 herramientas de solo lectura y máximo 4 pasos. Es el mismo patrón de nodos y herramientas de LangGraph, sin la librería |
| D5 (línea 39) | Tres guardas: umbral de parecido (0,55), instrucciones estrictas y validación de citas |
| D6 (línea 44) | Al modelo solo van el nombre de pila, la carrera y los resultados de las herramientas |
| D8 (línea 50) | El historial se guarda en D1, no en el navegador |
| D9 y D10 (líneas 53 y 56) | Límite diario y borrado a los 30 días |

---

## Ajustes que propongo (A1 a A5)

Salen de la tarea 1.1 y de esta revisión. Cada uno necesita tu OK; si apruebas, los aplico con `/openspec-update-change`.

| # | Archivo | Ajuste | Por qué |
|---|---|---|---|
| A1 | `design.md` D2 | Registrar el resultado de la tarea 1.1: `gpt-oss-20b` provisional (~1,2 s y ~11 neuronas por pregunta en la prueba) y `llama-3.3-70b-instruct-fp8-fast` como segundo candidato (~2 s y ~27 neuronas). La evaluación (4.1) decide. Se descartaron los modelos con fecha de retiro cercana y los que exigen plan pago | La decisión queda escrita con su evidencia (criterio 6) |
| A2 | `design.md` D2 y D4 | Los documentos generales llevan `carrera_id = 0`, y la búsqueda filtra con `carrera_id` en `[0, carrera del estudiante]`. Los índices de metadatos se crean antes de cargar vectores (ya hecho hoy) | Vectorize no permite filtrar con "o" entre dos campos ("general" **o** "de mi carrera"). Con un solo campo y la lista `$in` sí se puede |
| A3 | `specs/asistente-academico/spec.md` línea 36 | "Reglamento estudiantil – **Entregas de talleres**" | Así se llama la sección real (punto 3) |
| A4 | `specs/asistente-academico/spec.md` y `tasks.md` 3.3 | Escenario nuevo: si el modelo no responde o se agotó la cuota, el asistente dice que no está disponible por ahora y que lo intente más tarde, no inventa nada y esa pregunta no cuenta para el límite diario. Se verifica con una prueba en la 3.3 | Cierra el hueco del punto 11 |
| A5 | `design.md` D3 | El texto de cada fragmento vive en D1; Vectorize solo guarda el vector y los metadatos. Cada resultado de Vectorize se cruza con D1, y lo que ya no existe en D1 se descarta | Garantiza el "nunca la versión vieja" del punto 13 aunque Vectorize tarde unos segundos en aplicar el borrado |

---

## Paso 4 · Aprobación

Cuando me respondas P1, los puntos 1 a 14 y A1 a A5:

1. Aplico los cambios a las specs y al design con `/openspec-update-change` y valido con `openspec validate --all --strict`.
2. Registro aquí tus decisiones y cambio el estado a **aprobado**.
3. Hago un commit "Aprobar el cambio asistente-academico-rag" y lo anoto en la bitácora.

Las tareas de infraestructura (1.x) no dependen de esta aprobación. La 2.1 en adelante sí.

## Decisiones registradas

Aymer revisó los documentos y aprobó la guía completa el 18 de noviembre de 2026 ("documento revisado y aprobado"). En las preguntas abiertas se tomó la opción que recomendaba la guía.

| Punto | Decisión | Dónde quedó |
|---|---|---|
| P1 | OK | Sin cambios |
| 1 a 5, 8, 10, 13 y 14 | OK | Sin cambios (el riesgo del punto 13 lo cubre A5) |
| 6 | El asistente **no** explica temas de los cursos | `design.md` (Non-Goals) y escenario nuevo "Pedir que explique un tema de un curso" |
| 7 | **Sí** al aviso "no escribas datos personales" en el chat | Spec (requisito de privacidad y escenario nuevo) y tarea 3.4 |
| 9 | 30 preguntas por día es razonable | Sin cambios; `design.md` D9 aclara que la cuota es de toda la cuenta |
| 11 | El hueco se cierra con A4 | Ver A4 |
| 12 | La pantalla de carga de documentos va **después** de la presentación | `design.md` (Non-Goals) |
| A1 | OK | `design.md` D2: resultados de la tarea 1.1 |
| A2 | OK | `design.md` D2 y D4: `carrera_id = 0` para los generales (`NULL` en D1) y filtro `$in` |
| A3 | OK | Spec: "Reglamento estudiantil – Entregas de talleres" |
| A4 | OK | Spec (requisito nuevo "Servicio de IA no disponible"), `design.md` D11 (503 `ASISTENTE_NO_DISPONIBLE`, la pregunta no se guarda) y tarea 3.3 |
| A5 | OK | `design.md` D3 (el texto vive en D1 y se cruza) y tarea 3.1 |

Se validó con `openspec validate --all --strict`. Desde aquí se pueden implementar las tareas 2.x y 3.x.
