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

## Decisions

### D1. Workers AI + Vectorize en lugar de un proveedor externo
Todo queda en Cloudflare, sin llaves externas ni costo para la Fundación (plan gratuito). Alternativa: API de OpenAI o Anthropic con mejor calidad, pero con costo mensual que la Fundación no puede asumir. La llamada al modelo queda detrás de una interfaz `ModeloLenguaje` para poder cambiar de proveedor.

### D2. Modelos
- Embeddings: `@cf/baai/bge-m3` (multilingüe, bueno en español, 1024 dimensiones). Índice Vectorize `fundacion-docs` con métrica coseno y metadatos `documento_id`, `carrera_id`, `tipo`.
- Generación: un modelo instruct de Workers AI con soporte de function calling y retención cero de datos. El catálogo cambió desde que se escribió el kit (a noviembre de 2026 hay, entre otros, `gpt-oss-20b` y modelos Qwen 3.x con function calling, además del candidato original `@cf/meta/llama-3.3-70b-instruct-fp8-fast`). **Verificar en el catálogo vigente antes de implementar**, comparar 2 candidatos con el conjunto de evaluación (D7) y dejar el elegido en la variable `MODELO_CHAT`.
- El asistente se presenta como **Senda**, el asistente académico de `FUNDACION_NOMBRE` (ambos nombres salen de las variables del Worker).

### D3. Fragmentación por secciones
Se divide el Markdown por títulos (`#`, `##`, `###`) y, si una sección supera ~1.200 caracteres, por párrafos con ~150 de solapamiento. Cada fragmento lleva el título del documento y la ruta de la sección, para citar. Alternativa: fragmentos de tamaño fijo; pierden la sección y empeoran las citas.

### D4. Agente con herramientas de solo lectura
El asistente es un ciclo de function calling con un máximo de 4 pasos y estas herramientas:
- `buscar_documentos(consulta)`: busca en Vectorize filtrando por documentos generales o de la carrera del estudiante.
- `mis_actividades_pendientes()`: actividades publicadas sin entrega del estudiante.
- `mis_notas()`: entregas calificadas del estudiante.
- `mi_estado_de_cuenta()`: reusa el servicio de cartera del MVP.
Las herramientas toman el `usuario_id` de la sesión, nunca de los argumentos del modelo; así es imposible consultar a otro estudiante. Alternativa: LangGraph.js o LangChain.js (vistos en el curso); se descartan para el MVP por el peso y la compatibilidad con Workers en este plazo, pero el diseño de nodos y herramientas es equivalente y se puede explicar en esos términos en la presentación.

### D5. Guardas contra alucinación
1. Umbral de similitud: si ningún fragmento supera el umbral (inicial 0,55, ajustable con la evaluación), `buscar_documentos` devuelve "sin resultados" y el agente debe responder que no tiene la información.
2. Prompt de sistema: responder solo con resultados de herramientas, citar `[Documento – Sección]`, negarse a temas ajenos y a resolver actividades.
3. Validación de salida: si la respuesta usó documentos pero no trae citas válidas (que existan entre los fragmentos recuperados), se reemplaza por la respuesta de "no tengo esa información".

### D6. Privacidad
El contexto enviado al modelo solo incluye nombre de pila, carrera y resultados de herramientas sin documento, correo ni celular. Las herramientas filtran esos campos. Una prueba verifica el contenido enviado al modelo con un doble de prueba.

### D7. Evaluación
`eval/preguntas.json` con ~25 preguntas: respondibles (con fuente esperada), de datos propios (con usuario del seed y respuesta esperada), sin respuesta (debe negarse) y fuera de dominio. `npm run eval:rag` las ejecuta contra el entorno local y reporta aciertos, citas correctas y negaciones correctas. Se corre a mano antes de la demo (consume cuota de Workers AI), no en cada push.

### D8. Historial de la conversación en D1
Tabla `asistente_mensajes (id, usuario_id, rol ('usuario'|'asistente'), contenido, fuentes_json, creado_en)` en `migrations/0002_base_conocimiento.sql`. El endpoint recibe solo la pregunta nueva; el historial (los últimos 6 turnos del estudiante) se lee de la tabla. Así un cliente no puede inyectar turnos falsos del asistente, se puede contar el límite diario y queda trazabilidad para revisar respuestas dudosas. Alternativa: que el navegador envíe el historial; descartada por la inyección de turnos y porque el límite diario no se podría contar de forma confiable.

### D9. Límite diario
Antes de llamar al modelo se cuentan los mensajes con `rol = 'usuario'` del estudiante desde las 00:00 de hoy en America/Bogota (convertido a UTC). Con 30 o más, se responde sin llamar al modelo. Protege la cuota gratuita de Workers AI (10.000 neuronas diarias).

### D10. Retención de 30 días
Un Cron Trigger diario del mismo Worker (el plan Free permite 5 por cuenta) borra los mensajes de más de 30 días; además, `DELETE /api/asistente/mensajes` borra el historial del estudiante que lo pide. Los mensajes pueden contener datos personales que el estudiante escribe, así que no se guardan más de lo necesario (Ley 1581: finalidad y temporalidad).

## Risks / Trade-offs

- [Modelos abiertos menos precisos en español que los comerciales] → Guardas de D5 y evaluación; si el resultado es pobre, cambiar `MODELO_CHAT` sin tocar el resto.
- [Cuota diaria del plan gratuito de Workers AI] → Límite de 30 preguntas por estudiante por día (D9) y evaluación fuera del CI.
- [Mensajes con datos personales guardados] → Retención de 30 días, borrado a pedido del estudiante (D10) y nunca se registran en logs.
- [Documentos ficticios en la demo] → Se presentan como borradores; al recibir los reales se recargan con la misma ingesta.

## Migration Plan

1. Crear el índice Vectorize (`wrangler vectorize create fundacion-docs --dimensions=1024 --metric=cosine`) y los índices de metadatos `carrera_id` y `tipo`.
2. Aplicar `migrations/0002_base_conocimiento.sql`.
3. Ejecutar `npm run rag:indexar` para cargar los documentos de `docs/rag/`.

## Open Questions

- Texto definitivo del mensaje de "no tengo esa información" y del contacto de la Fundación (reusa `CONTACTO_FUNDACION`).
