# Plan de trabajo – presentación el viernes 20 de noviembre de 2026

Cada día cierra con: pruebas en verde, push a `main`, pipeline en verde y la URL pública actualizada.

| Día | Fecha | Objetivo | Tareas de OpenSpec | Criterios de la rúbrica |
|---|---|---|---|---|
| 1 | Sáb 14 | Herramientas de diseño, proyecto creado, CI/CD desplegando, base con datos ficticios | MVP 1.0 – 1.8 | 5, 2 |
| 2 | Dom 15 | Identidad visual, login, roles, carreras y estudiantes | MVP 2.x y 3.x | 1, 2, 4 |
| 3 | Lun 16 | Talleres, entregas y calificación | MVP 4.x | 1, 4 |
| 4 | Mar 17 | Cuotas, pagos, bloqueo por mora y excepciones | MVP 5.x | 1, 4 |
| 5 | Mié 18 | Asistente RAG: ingesta, agente, pantalla | RAG 1.x – 3.x | 3 |
| 6 | Jue 19 | Mañana: E2E completo, evaluación del RAG, revisión visual. Tarde: diapositivas, guion, video de respaldo de la demo y ensayo cronometrado | MVP 6.x, RAG 4.x | 3, 4, 6 |
| 7 | Vie 20 | Mañana: checklist de "Antes de presentar". **Presentación** | – | – |

**Sin día de colchón** (la presentación pasó del sábado 21 al viernes 20, y se perdió el día de colchón). Reglas de recorte:
- Si el miércoles 18 en la noche el MVP (tareas 1.x a 5.x) no está completo, el asistente RAG se reduce a lo que pide el criterio 3: respuesta con cita del reglamento, "no sé" cuando no hay información y consulta del estado de cuenta.
- Las pantallas secundarias (por ejemplo, el resumen de cartera del administrador) van después del flujo de la demo.
- El bonus de WhatsApp queda fuera, salvo que todo esté en verde el jueves al mediodía.

## Avance

- [x] Día 1: tareas 1.0 a 1.5 el sábado; 1.6 y 1.8 se cerraron el domingo y 1.7 (MCP de shadcn) el lunes 16, al verificarla en una sesión nueva. [Bitácora](docs/bitacora/2026-11-14-dia-1.md)
- [ ] Día 2, parcial: revisión y aprobación del MVP, tareas 2.1 a 2.3 (11 de 31). Pasan al lunes 2.0, 2.4 a 2.6 y el grupo 3. [Bitácora](docs/bitacora/2026-11-15-dia-2.md)
- [ ] Día 3 (lunes 16, festivo), en curso:
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
  - MVP completo hasta el grupo 5 (29 de 31). Siguen el grupo 6 (E2E con Playwright y revisión visual) y el asistente RAG (día 5).
  - Propuestos, pendientes de decisión: un hook y un subagente revisor.
- [ ] Día 4
- [ ] Día 5
- [ ] Día 6
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
- [ ] `npm run eval:rag` con al menos 90 % de aciertos.
- [ ] La mañana del 20: seed recargado en la base remota (`npx wrangler d1 execute DB --remote --file db/seed/seed.sql`) para deshacer los cambios de los ensayos. El seed ya está generado con la fecha de la presentación (2026-11-20).
- [ ] Confirmar con el profesor que el seed ficticio en la base real cumple el criterio 2.

## Después de la presentación

- [ ] Antes de ir a producción con la Fundación, buscar "Senda" en el registro de marcas de la SIC (clases de Niza 9, 41 y 42). Si está tomado, se cambia `PRODUCTO_NOMBRE` y el símbolo (D19).
