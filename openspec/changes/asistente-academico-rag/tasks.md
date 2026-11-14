# Tasks

## 1. Infraestructura RAG (día 5)

- [ ] 1.1 Verificar en el catálogo vigente de Workers AI el modelo de embeddings y un modelo de chat con function calling; dejar los nombres en `MODELO_EMBEDDINGS` y `MODELO_CHAT` en `wrangler.jsonc` y verificar una llamada de prueba con `wrangler dev`
- [ ] 1.2 Crear el índice Vectorize `fundacion-docs` (1024 dimensiones, coseno) con índices de metadatos `carrera_id` y `tipo`, y agregar los bindings `AI` y `VECTORES`; verificar con `wrangler vectorize list`
- [ ] 1.3 Crear `migrations/0002_base_conocimiento.sql` con las tablas `documentos` y `fragmentos` y aplicarla local y remoto; verificar con `SELECT count(*) FROM documentos`

## 2. Base de conocimiento (día 5)

- [ ] 2.1 Implementar la fragmentación por secciones (D3) como función pura; verificar con unit tests que conserva el título de sección y respeta el tamaño máximo
- [ ] 2.2 Implementar la API de administrador para cargar, reemplazar y retirar documentos (con borrado de vectores anteriores); verificar con pruebas que un estudiante recibe acceso denegado y que reemplazar elimina los fragmentos viejos
- [ ] 2.3 Crear el script `npm run rag:indexar` que carga los archivos de `docs/rag/` por la API; verificar que el administrador ve el número de fragmentos por documento

## 3. Asistente (día 5)

- [ ] 3.1 Implementar las herramientas de solo lectura (D4) tomando el `usuario_id` de la sesión; verificar con pruebas que nunca devuelven datos de otro estudiante ni documento, correo o celular
- [ ] 3.2 Implementar el ciclo del agente con function calling (máximo 4 pasos), umbral de similitud y validación de citas (D5); verificar con pruebas usando un modelo simulado: sin resultados → respuesta de "no tengo esa información"; cita inválida → respuesta reemplazada
- [ ] 3.3 Implementar `POST /api/asistente/mensajes` con autenticación, bloqueo por mora y límite diario de preguntas; verificar con pruebas el 401 sin sesión y el bloqueo del estudiante en mora
- [ ] 3.4 Construir la pantalla del asistente para estudiantes (chat responsivo con fuentes visibles bajo cada respuesta y preguntas sugeridas); verificar a mano con el estudiante al día del seed

## 4. Evaluación y demo (día 6)

- [ ] 4.1 Crear `eval/preguntas.json` (~25 casos: respondibles, datos propios, sin respuesta, fuera de dominio) y el script `npm run eval:rag`; verificar que reporta aciertos, citas y negaciones y que el resultado es al menos 90 % antes de la demo
- [ ] 4.2 Agregar al E2E de Playwright una pregunta respondible (con fuente visible) y una sin respuesta (con negación); en CI usar el modelo simulado (variable `MODELO_SIMULADO=1`) para no gastar cuota ni depender de respuestas variables; verificar `npm run test:e2e` en verde

## Workflow follow-up

- Archivar el cambio con `/openspec-archive-change` cuando las tareas estén completas y la evaluación supere el 90 %.
