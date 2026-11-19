# Plan de trabajo – presentación el lunes 23 de noviembre de 2026

Cada día cierra con: pruebas en verde, push a `main`, pipeline en verde y la URL pública actualizada.

| Día | Fecha | Objetivo | Tareas de OpenSpec | Criterios de la rúbrica |
|---|---|---|---|---|
| 1 | Sáb 14 | Herramientas de diseño, proyecto creado, CI/CD desplegando, base con datos ficticios | MVP 1.0 – 1.8 | 5, 2 |
| 2 | Dom 15 | Identidad visual, login, roles, carreras y estudiantes | MVP 2.x y 3.x | 1, 2, 4 |
| 3 | Lun 16 | Talleres, entregas y calificación | MVP 4.x | 1, 4 |
| 4 | Mar 17 | Cuotas, pagos, bloqueo por mora y excepciones | MVP 5.x | 1, 4 |
| 5 | Mié 18 | Asistente RAG: ingesta, agente, pantalla | RAG 1.x – 3.x | 3 |
| 6 | Jue 19 | Mañana: E2E completo, evaluación del RAG, revisión visual. Tarde: la nueva fecha en el seed y la documentación, y el guion | MVP 6.x, RAG 4.x | 3, 4, 6 |
| 7 | Vie 20 | Evidencia de la metodología: trazabilidad de 100 de 100 escenarios con prueba, hook y subagente revisor | – | 4, 6 |
| 8 | Sáb 21 | Diapositivas y la falla de "semana de parciales" con su evaluación. Decisión sobre el bonus de WhatsApp | – | 3, 6 |
| 9 | Dom 22 | Video de respaldo de la demo, 2 ensayos cronometrados y preguntas esperadas. **Producto congelado a las 6 p. m.** | – | todos |
| 10 | Lun 23 | Mañana: seed remoto recargado, checklist de "Antes de presentar" y ensayo final. **Presentación** | – | – |

La presentación pasó del sábado 21 al viernes 20 y, el 19 de noviembre, al **lunes 23** (confirmado). Todas las tareas de OpenSpec estaban hechas el jueves 19 a mediodía, así que los días extra son para reducir riesgo y fortalecer la evidencia, no para agregar funciones. Reglas:
- **Producto congelado desde el domingo 22 a las 6 p. m.:** después solo hay ensayos. El mayor riesgo de una demo en vivo es un cambio de última hora.
- Hasta entonces solo entran mejoras que suban la nota, cada una con sus pruebas y el pipeline en verde.
- El bonus de WhatsApp con n8n se decide el sábado 21, solo si todo lo demás está listo, y con un máximo de un día.
- El día de la presentación no se corre `npm run eval:rag`, para no gastar la cuota de Workers AI.

## Avance

- [x] Día 1: tareas 1.0 a 1.5 el sábado; 1.6 y 1.8 se cerraron el domingo y 1.7 (MCP de shadcn) el lunes 16, al verificarla en una sesión nueva. [Bitácora](docs/bitacora/2026-11-14-dia-1.md)
- [ ] Día 2, parcial: revisión y aprobación del MVP, tareas 2.1 a 2.3 (11 de 31). Pasan al lunes 2.0, 2.4 a 2.6 y el grupo 3. [Bitácora](docs/bitacora/2026-11-15-dia-2.md)
- [x] Día 3 (lunes 16, festivo): se recuperó el atraso y se adelantaron el grupo 5 y la 6.1 (30 de 31). [Bitácora](docs/bitacora/2026-11-16-dia-3.md), con el estado frente a la rúbrica:
  - Repaso de la metodología, con el mapa en [docs/presentacion/metodologia-aplicada.md](docs/presentacion/metodologia-aplicada.md).
  - Tarea 1.7 cerrada: con la sesión abierta en `proyecto/`, el servidor `shadcn` conecta, lee el `components.json` (registro `@shadcn`) y lista los 61 componentes `ui`.
  - Tarea 2.4 cerrada: middleware de sesión y permisos por rol con "negar por defecto" (toda ruta de `/api` exige sesión salvo la lista de públicas en `api/src/index.ts`).
  - Tarea 2.5 cerrada: cambio de contraseña (siempre con la actual), aceptación del aviso y restablecimiento por el administrador. Antes se actualizó la spec con dos reglas nuevas: la nueva distinta de la actual y el restablecimiento borra los intentos fallidos.
  - Tarea 2.0 cerrada: identidad visual "Senda, paso a paso" ([docs/identidad-visual.md](docs/identidad-visual.md)), aprobada por Aymer con un ajuste: la entrada de las pantallas bajó de 700 a 250 ms.
  - Tarea 2.6 cerrada: `GET /api/config/publica` (con prueba) y las pantallas de ingreso, cambio de contraseña, aviso de privacidad (borrador) y layout por rol. Se usó React Router 8 y el Sidebar de shadcn para los tres roles, por decisión de Aymer. Se verificó con Playwright en 375 y 1280 px, incluido el primer ingreso del seed. Grupo 2 completo (16 de 31).
  - Tarea 3.1 cerrada: API de carreras, cursos y docentes. Antes se actualizó la spec con 4 reglas aprobadas por Aymer. Entre ellas, la carrera y el semestre de un curso no se editan, y reactivar un curso inscribe a sus estudiantes.
  - Tarea 5.1 adelantada (decisión de Aymer): `calcularEstadoMora` y `hoyEnBogota`, con 15 pruebas unitarias. El filtro por estado de cartera de la 3.2 la necesita.
  - Tareas 3.2 y 3.3 cerradas: API de estudiantes (comprobada contra el seed: 45 al día, 5 en riesgo, 9 bloqueados, 1 con excepción) y carga masiva por CSV, todo o nada.
  - Tarea 3.4 cerrada: pantallas de administración de carreras y cursos, estudiantes (con carga masiva) y docentes, con TanStack Query (decisión de Aymer) y formularios en diálogo. Verificadas con Playwright en 375 y 1280 px. Grupo 3 completo (21 de 31, con la 5.1 adelantada).
  - Grupo 4 cerrado (4.1 a 4.4): actividades, entregas con archivo de apoyo (construido ahora, decisión de Aymer), descarga protegida, calificación y las pantallas del docente y del estudiante. Antes se actualizó la spec con 4 reglas aprobadas: formato por contenido, volver a borrador sin entregas, corregir notas y fecha límite en hora de Colombia. El flujo de la demo se verificó de punta a punta con Playwright: la estudiante entrega desde el celular, la docente califica con 4,2 y la estudiante ve la nota.
  - Seed corregido: las entregas del Taller 3 caían después del día de la presentación (21 a 23 de noviembre). Ahora son anteriores a la fecha de referencia, y solo cambiaron esas líneas.
  - El plan del día 3 quedó cumplido.
  - Grupo 5 cerrado (adelantado del día 4): cuotas, pagos y anulaciones con los triggers de D13 traducidos a español, bloqueo por mora al ingresar y en cada petición (30 días entra, 31 no), excepciones, estado de cuenta del estudiante y del administrador y resumen de cartera. Antes se actualizaron las specs con 4 reglas aprobadas, y el soporte del pago quedó aplazado (decisión de Aymer). Demo verificada con Playwright: Manuela (bloqueada) no entra, el administrador registra el pago y Manuela entra "en riesgo".
  - MVP completo hasta el grupo 5 (29 de 31).
  - Tarea 6.1 cerrada (adelantada del día 6): prueba E2E con Playwright del flujo de la demo, contra el build de producción. Pasó 3 veces seguidas en local y en el CI, donde corre en paralelo con la calidad. El despliegue ahora necesita los dos jobs en verde (30 de 31). Siguen la 6.2 (revisión visual) y el asistente RAG (día 5).
  - Propuestos, pendientes de decisión: un hook y un subagente revisor.
- [x] Día 4 (martes 17): el asistente RAG empezó un día antes. [Bitácora](docs/bitacora/2026-11-17-dia-4.md)
  - Tema de la clase (Lab 14, CI/CD con GitHub Actions): el pipeline de Senda ya aplica lo central.
  - Tareas RAG 1.1 (modelos de Workers AI) y 1.2 (índice Vectorize).
  - Guía de revisión del RAG con los ajustes A1 a A5.
  - La 6.2 y el archivado pasaron al jueves.
- [x] Día 5 (miércoles 18): asistente RAG de 2 a 11 de 13 tareas, y de 251 a 356 pruebas. [Bitácora](docs/bitacora/2026-11-18-dia-5.md)
  - Aprobación del cambio, base de conocimiento, herramientas y agente con validación de citas.
  - Endpoint ajustado por una alucinación real.
  - Tabla contadora del límite diario (decisión de Aymer) y pantalla del asistente.
- [ ] Día 6 (jueves 19), en curso. [Bitácora](docs/bitacora/2026-11-19-dia-6.md)
  - Mañana cerrada:
    - evaluación del asistente: gpt-oss-20b con 96 % contra 88 % de llama, y ~31 neuronas por pregunta;
    - el asistente en el E2E con el modelo simulado;
    - revisión visual con el MCP de Playwright (4 correcciones);
    - los dos cambios de OpenSpec archivados.
  - **Todas las tareas hechas: MVP 31 de 31 y RAG 13 de 13, con 393 pruebas.**
  - Asistente probado en la URL pública con el modelo real: nota mínima con su cita y "no tengo esa información" para la cafetería.
  - La presentación pasó al lunes 23: el seed tiene ahora la fecha de referencia 2026-11-23 (el Taller 3 de la demo vence el 26) y la ventana del E2E va del 6 al 26 de noviembre.
  - Sigue la tarde: el guion.
- [ ] Presentación

## Guion de la presentación (~10 minutos)

1. **El problema (1 min):** fundación que empieza, sin dinero, sin cómo controlar estudiantes, entregas ni pagos.
2. **Demo del flujo (6 min), con las cuentas de `db/seed/CUENTAS-DEMO.md`:**
   1. Estudiante al día entra desde el celular y entrega el Taller 3.
   2. Docente lo califica; el estudiante ve la nota.
   3. Estudiante pregunta al asistente "¿cuál es la nota mínima para aprobar?" (respuesta con cita) y "¿cuánto debo?" (dato real de su estado de cuenta).
   4. Pregunta sin respuesta ("¿a qué hora abre la cafetería?") → el asistente dice que no sabe.
   5. Estudiante en mora intenta entrar → acceso suspendido. El administrador registra el pago → entra.
3. **Calidad y despliegue (1 min):** pipeline de GitHub Actions en verde, pruebas, URL pública.
4. **Decisión técnica de la que estoy orgulloso (1 min):** por ejemplo, la mora calculada al vuelo (desbloqueo inmediato, probada con fechas fijas) o las guardas contra alucinación del RAG.
5. **Metodología (1 min):** cómo OpenSpec guió el trabajo (proposal → specs → design → tasks → código).

## Antes de presentar

- [ ] Proyecto corriendo en local y en la URL pública.
- [ ] Pipeline y pruebas en verde.
- [x] `npm run eval:rag` con al menos 90 % de aciertos: 96 % con gpt-oss-20b el 19 de noviembre (RAG design.md D7).
- [x] El asistente probado en la URL pública con el modelo real (19 de noviembre, desde el celular de Aymer): la nota mínima con su cita y "no tengo esa información" para la cafetería.
- [ ] La mañana del 23: seed recargado en la base remota (`npx wrangler d1 execute DB --remote --file db/seed/seed.sql`) para deshacer los cambios de los ensayos. El seed ya está generado con la fecha de la presentación (2026-11-23). La recarga borra también las conversaciones y los contadores del asistente, y no toca la base de conocimiento.
- [ ] Confirmar con el profesor que el seed ficticio en la base real cumple el criterio 2.

## Después de la presentación

- [ ] **Antes de operar con la Fundación** (revisado el 16 de noviembre; no afecta la demo): crear el primer administrador en una base nueva, un requisito que **falta en las specs** porque hoy el único administrador sale del seed. Además: Workers Paid (ADR-003), R2 (ADR-002), el aviso de privacidad definitivo y validar con la Fundación los supuestos de las specs.
- [ ] **Antes del 27 de noviembre:** hacer el seed de la prueba E2E relativo a la fecha del día (`--fecha-referencia`) y ajustar las fechas que compara `e2e/demo.spec.ts`. El seed actual solo sirve del 6 al 26 de noviembre; fuera de esa ventana, `e2e/preparar.ts` falla a propósito y, como el despliegue depende del E2E, **no se puede desplegar**.
- [ ] Pantalla de administración de los documentos del asistente (cargar, reemplazar y retirar). Para la demo bastan la API y `npm run rag:indexar`; decisión de Aymer en la revisión del RAG del 18 de noviembre.
- [ ] Antes de ir a producción con la Fundación, buscar "Senda" en el registro de marcas de la SIC (clases de Niza 9, 41 y 42). Si está tomado, se cambia `PRODUCTO_NOMBRE` y el símbolo (D19).
