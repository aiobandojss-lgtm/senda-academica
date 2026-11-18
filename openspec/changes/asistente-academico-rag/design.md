# Design

## Context

Se construye sobre el MVP (`mvp-plataforma-academica`): ya existen autenticación, permisos, bloqueo por mora y los servicios de cartera y actividades. Debe correr en el plan gratuito de Cloudflare y es el criterio "Inteligencia con fundamento" de la rúbrica del curso: responder con datos reales y sin alucinar. Motivación: ver `proposal.md`. Requisitos: ver `specs/`.

## Goals / Non-Goals

**Goals:**
- Patrón RAG completo y explicable: ingesta → fragmentos → embeddings → índice vectorial → recuperación filtrada → generación con citas.
- Un agente pequeño con herramientas de solo lectura sobre datos reales del estudiante.
- Una forma medible de demostrar que no alucina (conjunto de evaluación).

**Non-Goals:**
- Memoria de largo plazo entre conversaciones (solo los últimos turnos de la conversación actual).
- Streaming de tokens (se puede agregar si sobra tiempo).
- Pantalla de administración de documentos. Para la demo bastan la API y el script `npm run rag:indexar`, que muestra los fragmentos indexados por documento. La pantalla se construye después de la presentación, porque un administrador de la Fundación sin conocimientos técnicos la va a necesitar (decisión de Aymer, revisión del 2026-11-18).
- Explicar temas de los cursos (por ejemplo, "¿qué es un arreglo?"). Esa explicación no está en los documentos de la Fundación, así que el asistente responde que no tiene esa información: explicar sin fuente es lo que el criterio "IA con fundamento" penaliza (decisión de Aymer, revisión del 2026-11-18).

## Decisions

### D1. Workers AI + Vectorize en lugar de un proveedor externo
Todo queda en Cloudflare, sin llaves externas ni costo para la Fundación (plan gratuito). Alternativa: API de OpenAI o Anthropic con mejor calidad, pero con costo mensual que la Fundación no puede asumir. La llamada al modelo queda detrás de una interfaz `ModeloLenguaje` para poder cambiar de proveedor.

### D2. Modelos
- Embeddings: `@cf/baai/bge-m3` (multilingüe, bueno en español, 1024 dimensiones), en la variable `MODELO_EMBEDDINGS`. Índice Vectorize `fundacion-docs` con métrica coseno y metadatos `documento_id`, `carrera_id` y `tipo`.
  - `carrera_id` es un número, y los documentos generales llevan `0`. En D1, la carrera de un documento es opcional (`NULL` = general). Solo en los metadatos de Vectorize se escribe `0`, que nunca es el id de una carrera.
  - `documentos.carrera_id` **no** tiene llave foránea. El seed de la demo borra y recrea las carreras, y con llave foránea esa recarga fallaría en cuanto hubiera un plan de estudios cargado. La API valida la carrera al cargar el documento, y la aplicación nunca borra carreras. El detalle está en `migrations/0002_base_conocimiento.sql`.
  - Los índices de metadatos `carrera_id` (número) y `tipo` (texto) se crearon antes de cargar vectores (tarea 1.2). Vectorize no puede filtrar los vectores cargados antes de crear el índice.
  - En la prueba de la tarea 1.1, bge-m3 dio 0,743 de similitud entre una pregunta y su fragmento correcto, y 0,35 con un texto ajeno. Es coherente con el umbral inicial de 0,55 (D5).
- Generación: un modelo instruct de Workers AI con function calling, verificado en el catálogo el 2026-11-17 (tarea 1.1):
  - `@cf/openai/gpt-oss-20b`: provisional en `MODELO_CHAT`. En una pregunta de prueba de dos pasos tomó ~1,2 s y ~11 neuronas.
  - `@cf/meta/llama-3.3-70b-instruct-fp8-fast`: segundo candidato. Tomó ~2 s y ~27 neuronas en la misma prueba.
  - Se descartaron los modelos con fecha de retiro anunciada y los que exigen plan pago.
  - En la 1.1 se probó gpt-oss con el formato Responses (`input` y elementos `function_call`) y llama con el formato de chat (`tool_calls`). En la tarea 3.2 se probó un ciclo real de dos pasos (el modelo pide la herramienta, recibe el resultado con `role: "tool"` y responde): **los dos aceptan el formato de chat compatible con OpenAI**. Por eso hay un solo adaptador, `ModeloChatWorkersAi`, para ambos. La interfaz `ModeloLenguaje` (D1) se mantiene para cambiar de proveedor y para el modelo simulado de las pruebas y del E2E.
  - En esa prueba, llama citó `[Documento – Evaluación y calificaciones]`: copió la palabra "Documento" del ejemplo de las instrucciones. Por eso cada resultado de `buscar_documentos` trae la cita ya armada (`fuente`), las instrucciones piden copiarla tal cual, y la validación de citas (D5) reemplaza la respuesta si aun así la cita no corresponde a un fragmento recuperado.
  - La evaluación (D7, tarea 4.1) compara los dos y deja el ganador en `MODELO_CHAT`.
- La cuota gratuita es de 10.000 neuronas diarias para toda la cuenta y se reinicia a las 00:00 UTC (7:00 p. m. en Colombia). El costo real de una pregunta, con documentos e historial, se mide en la tarea 4.1.
- Workers AI y Vectorize no tienen simulador local. `npm run dev` usa los servicios reales (bindings remotos). Vitest y el E2E corren sin bindings remotos, con dobles de prueba, y no necesitan credenciales de Cloudflare.
- **Un espacio por entorno en el mismo índice** (decisión de Aymer, 2026-11-18).
  - El problema: `npm run dev` usa la D1 local pero el índice Vectorize real, el mismo de producción, y el id de un vector es único en todo el índice. Sin separación, cargar documentos en local sobrescribiría vectores de producción, y reemplazar uno en local borraría vectores que la URL pública sigue usando.
  - La solución: la variable `RAG_ESPACIO` (`produccion` en `wrangler.jsonc`) es el *namespace* de Vectorize de cada vector y de cada búsqueda, y también el prefijo de su id (`produccion:17`, `local:17`).
  - `vite.config.ts` la cambia a `local` solo en `npm run dev`. Es automático: no depende de editar `.dev.vars`, un paso que se podría olvidar. El build que se despliega conserva `produccion`.
  - Alternativas descartadas: un segundo índice para desarrollo (Wrangler por entornos con los bindings duplicados: más piezas a dos días de la presentación) y no indexar nunca en local (cada prueba del asistente sería contra producción).
- El asistente se presenta como **Senda**, el asistente académico de `FUNDACION_NOMBRE` (ambos nombres salen de las variables del Worker).

### D3. Fragmentación por secciones
Se divide el Markdown por títulos (`#`, `##`, `###`) y, si una sección supera ~1.200 caracteres, por párrafos con ~150 de solapamiento. Cada fragmento lleva el título del documento y la ruta de la sección, para citar. Alternativa: fragmentos de tamaño fijo; pierden la sección y empeoran las citas.

**El texto vive en D1, no en Vectorize.** Las tablas `documentos` y `fragmentos` (`migrations/0002_base_conocimiento.sql`) guardan el texto, la sección y el documento de origen. Vectorize guarda solo el vector y los metadatos, y el id del vector es el id del fragmento.

Cada resultado de Vectorize se cruza con D1 por ese id, y se descarta el que ya no existe allí. Vectorize es *eventualmente consistente*: un borrado tarda unos segundos en aplicarse. Si el texto se leyera de Vectorize, justo después de reemplazar un documento el asistente podría citar la versión anterior. Al cruzar con D1, un fragmento borrado deja de existir de inmediato y se cumple el "nunca la versión vieja" de la spec `base-conocimiento`.

### D4. Agente con herramientas de solo lectura
El asistente es un ciclo de function calling con un máximo de 4 pasos y estas herramientas:
- `buscar_documentos(consulta)`: busca en Vectorize con el filtro `carrera_id` en `[0, carrera del estudiante]` (operador `$in`), es decir, documentos generales o de su carrera. Vectorize no permite una "o" entre dos campos distintos ("es general" **o** "es de mi carrera"). Por eso los generales llevan `carrera_id = 0` (D2) en lugar de un campo aparte. Los resultados se cruzan con D1 (D3).
- `mis_actividades_pendientes()`: actividades publicadas sin entrega del estudiante.
- `mis_notas()`: entregas calificadas del estudiante.
- `mi_estado_de_cuenta()`: reusa el servicio de cartera del MVP.
Las herramientas toman el `usuario_id` de la sesión, nunca de los argumentos del modelo; así es imposible consultar a otro estudiante. Alternativa: LangGraph.js o LangChain.js (vistos en el curso); se descartan para el MVP por el peso y la compatibilidad con Workers en este plazo, pero el diseño de nodos y herramientas es equivalente y se puede explicar en esos términos en la presentación.

### D5. Guardas contra alucinación
1. Umbral de similitud: si ningún fragmento supera el umbral (inicial 0,55, ajustable con la evaluación), `buscar_documentos` devuelve "sin resultados" y el agente debe responder que no tiene la información.
2. Prompt de sistema: responder solo con resultados de herramientas, citar `[Documento – Sección]`, negarse a temas ajenos y a resolver actividades.
3. Validación de salida: si la respuesta usó documentos pero no trae citas válidas (que existan entre los fragmentos recuperados), se reemplaza por la respuesta de "no tengo esa información". En concreto (tarea 3.2):
   - Una cita que no corresponde a ningún fragmento recuperado invalida toda la respuesta.
   - Si el agente buscó en los documentos, no consultó datos del estudiante y la respuesta no trae ninguna cita válida, también se reemplaza. Así se cubre el modelo que inventa después de recibir "sin resultados".
   - Una respuesta solo con datos del estudiante (notas, actividades, estado de cuenta) no necesita cita.
   - Si después de 4 pasos el modelo sigue pidiendo herramientas, se responde "no tengo esa información".

### D6. Privacidad
El contexto enviado al modelo solo incluye nombre de pila, carrera y resultados de herramientas sin documento, correo ni celular. Las herramientas filtran esos campos. Una prueba verifica el contenido enviado al modelo con un doble de prueba.

### D7. Evaluación
`eval/preguntas.json` con ~25 preguntas: respondibles (con fuente esperada), de datos propios (con usuario del seed y respuesta esperada), sin respuesta (debe negarse) y fuera de dominio. `npm run eval:rag` las ejecuta contra el entorno local y reporta aciertos, citas correctas y negaciones correctas. Se corre a mano antes de la demo (consume cuota de Workers AI), no en cada push.

### D8. Historial de la conversación en D1
Tabla `asistente_mensajes (id, usuario_id, rol ('usuario'|'asistente'), contenido, fuentes_json, creado_en)` en `migrations/0002_base_conocimiento.sql`. El endpoint recibe solo la pregunta nueva; el historial (los últimos 6 turnos del estudiante) se lee de la tabla. Así un cliente no puede inyectar turnos falsos del asistente, se puede contar el límite diario y queda trazabilidad para revisar respuestas dudosas. Alternativa: que el navegador envíe el historial; descartada por la inyección de turnos y porque el límite diario no se podría contar de forma confiable.

### D9. Límite diario
Antes de llamar al modelo se cuentan los mensajes con `rol = 'usuario'` del estudiante desde las 00:00 de hoy en America/Bogota (convertido a UTC). Con 30 o más, se responde sin llamar al modelo. Protege la cuota gratuita de Workers AI (10.000 neuronas diarias). Es una cuota de toda la cuenta: el límite por estudiante evita que uno solo la agote para los demás.

### D11. Falla del servicio de IA
Workers AI o Vectorize pueden fallar: por ejemplo, porque se agotó la cuota del día o porque el servicio no responde. En ese caso la API responde 503 con `{ codigo: "ASISTENTE_NO_DISPONIBLE", mensaje }` y la pantalla muestra que el asistente no está disponible por ahora y que lo intente más tarde.

Nunca se arma una respuesta con resultados parciales. La pregunta no se guarda en `asistente_mensajes`, así que no cuenta para el límite diario (D9) ni ensucia el historial (D8). Alternativa: un error genérico 500, descartada porque en la demo en vivo un mensaje claro es mucho mejor que una pantalla de error. La decisión sale del ajuste A4 de la revisión del 2026-11-18.

### D10. Retención de 30 días
Un Cron Trigger diario del mismo Worker (el plan Free permite 5 por cuenta) borra los mensajes de más de 30 días; además, `DELETE /api/asistente/mensajes` borra el historial del estudiante que lo pide. Los mensajes pueden contener datos personales que el estudiante escribe, así que no se guardan más de lo necesario (Ley 1581: finalidad y temporalidad).

## Risks / Trade-offs

- [Modelos abiertos menos precisos en español que los comerciales] → Guardas de D5 y evaluación; si el resultado es pobre, cambiar `MODELO_CHAT` sin tocar el resto.
- [Cuota diaria del plan gratuito de Workers AI, compartida por todos los estudiantes] → Límite de 30 preguntas por estudiante por día (D9), evaluación fuera del CI y mensaje de "no disponible" si se agota (D11). Con el costo medido en la tarea 4.1 se calcula cuántas preguntas diarias aguanta la Fundación.
- [Vectorize es eventualmente consistente] → El texto vive en D1 y cada resultado se cruza con D1 (D3).
- [El estudiante escribe datos personales en una pregunta, y eso sí llega al modelo] → La pantalla del chat le recuerda no escribir su documento ni su celular (spec `asistente-academico`, privacidad).
- [Mensajes con datos personales guardados] → Retención de 30 días, borrado a pedido del estudiante (D10) y nunca se registran en logs.
- [Documentos ficticios en la demo] → Se presentan como borradores; al recibir los reales se recargan con la misma ingesta.

## Migration Plan

1. Crear el índice Vectorize (`wrangler vectorize create fundacion-docs --dimensions=1024 --metric=cosine`) y los índices de metadatos `carrera_id` y `tipo`, antes de cargar cualquier vector (hecho el 2026-11-17, tarea 1.2).
2. Aplicar `migrations/0002_base_conocimiento.sql`.
3. Ejecutar `npm run rag:indexar` para cargar los documentos de `docs/rag/`.

## Open Questions

- Texto definitivo del mensaje de "no tengo esa información" y del contacto de la Fundación (reusa `CONTACTO_FUNDACION`).
