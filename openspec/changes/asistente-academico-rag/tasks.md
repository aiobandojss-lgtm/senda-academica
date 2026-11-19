# Tasks

## 1. Infraestructura RAG (día 5)

- [x] 1.1 Verificar en el catálogo vigente de Workers AI el modelo de embeddings y 2 modelos de chat candidatos con function calling (D2); dejar los nombres en `MODELO_EMBEDDINGS` y `MODELO_CHAT` en `wrangler.jsonc` y verificar una llamada de prueba con `wrangler dev`
- [x] 1.2 Crear el índice Vectorize `fundacion-docs` (1024 dimensiones, coseno) con índices de metadatos `carrera_id` y `tipo`, y agregar los bindings `AI` y `VECTORES`; verificar con `wrangler vectorize list`
- [x] 1.3 Crear `migrations/0002_base_conocimiento.sql` con las tablas `documentos`, `fragmentos` y `asistente_mensajes` (D8) y aplicarla local y remoto; verificar con `SELECT count(*) FROM documentos`

## 2. Base de conocimiento (día 5)

- [x] 2.1 Implementar la fragmentación por secciones (D3) como función pura; verificar con unit tests que conserva el título de sección y respeta el tamaño máximo
- [x] 2.2 Implementar la API de administrador para cargar, reemplazar y retirar documentos (con borrado de vectores anteriores); verificar con pruebas que un estudiante recibe acceso denegado y que reemplazar elimina los fragmentos viejos
- [x] 2.3 Crear el script `npm run rag:indexar` que carga los archivos de `docs/rag/` por la API; verificar que el administrador ve el número de fragmentos por documento

## 3. Asistente (día 5)

- [x] 3.1 Implementar las herramientas de solo lectura (D4) tomando el `usuario_id` de la sesión; verificar con pruebas que nunca devuelven datos de otro estudiante ni documento, correo o celular, que `buscar_documentos` filtra con `carrera_id` en `[0, carrera del estudiante]` (D2) y que descarta los resultados de Vectorize cuyo fragmento ya no existe en D1 (D3)
- [x] 3.2 Implementar el ciclo del agente con function calling (máximo 4 pasos), umbral de similitud y validación de citas (D5); verificar con pruebas usando un modelo simulado: sin resultados → respuesta de "no tengo esa información"; cita inválida → respuesta reemplazada
- [x] 3.3 Implementar `POST /api/asistente/mensajes` (recibe solo la pregunta nueva) con autenticación, bloqueo por mora, historial leído de `asistente_mensajes` (D8), límite diario (D9) y respuesta de "no disponible" cuando falla el servicio de IA (D11); verificar con pruebas el 401 sin sesión, el bloqueo del estudiante en mora, que un turno enviado por el cliente se ignora, que la pregunta 31 del día no llama al modelo y que, si el modelo falla, se responde 503 `ASISTENTE_NO_DISPONIBLE` sin guardar la pregunta
- [ ] 3.4 Construir la pantalla del asistente Senda para estudiantes (chat responsivo con fuentes visibles bajo cada respuesta, preguntas sugeridas, aviso de no escribir datos personales, mensaje de "no disponible" y botón para borrar el historial); verificar a mano con el estudiante al día del seed y con capturas en 375 y 1280 px
- [x] 3.5 Crear `migrations/0003_asistente_uso.sql` con el contador del límite diario (D9), implementar `DELETE /api/asistente/mensajes` y el Cron Trigger diario que borra mensajes y contadores de más de 30 días (D10); verificar con pruebas que el borrado solo afecta al estudiante que lo pide, que borrar el historial no reinicia el límite del día y que la depuración elimina los mensajes antiguos y conserva los recientes

## 4. Evaluación y demo (día 6)

- [ ] 4.1 Crear `eval/preguntas.json` (~25 casos: respondibles, datos propios, sin respuesta, fuera de dominio) y el script `npm run eval:rag`; comparar los 2 modelos candidatos y verificar que el elegido llega al menos al 90 % antes de la demo
- [ ] 4.2 Agregar al E2E de Playwright una pregunta respondible (con fuente visible) y una sin respuesta (con negación); en CI usar el modelo simulado (variable `MODELO_SIMULADO=1`) para no gastar cuota ni depender de respuestas variables; verificar `npm run test:e2e` en verde

## Workflow follow-up

- Archivar el cambio con `/openspec-archive-change` cuando las tareas estén completas y la evaluación supere el 90 %.
