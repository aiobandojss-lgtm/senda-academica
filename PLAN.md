# Plan de trabajo – presentación el sábado 21 de noviembre de 2026

Cada día cierra con: pruebas en verde, push a `main`, pipeline en verde y la URL pública actualizada.

| Día | Fecha | Objetivo | Tareas de OpenSpec | Criterios de la rúbrica |
|---|---|---|---|---|
| 1 | Sáb 14 | Herramientas de diseño, proyecto creado, CI/CD desplegando, base con datos ficticios | MVP 1.0 – 1.7 | 5, 2 |
| 2 | Dom 15 | Identidad visual, login, roles, carreras y estudiantes | MVP 2.x y 3.x | 1, 2, 4 |
| 3 | Lun 16 | Talleres, entregas y calificación | MVP 4.x | 1, 4 |
| 4 | Mar 17 | Cuotas, pagos, bloqueo por mora y excepciones | MVP 5.x | 1, 4 |
| 5 | Mié 18 | Asistente RAG: ingesta, agente, pantalla | RAG 1.x – 3.x | 3 |
| 6 | Jue 19 | E2E completo, evaluación del RAG, identidad visual | MVP 6.x, RAG 4.x | 3, 4, 6 |
| 7 | Vie 20 | Colchón para atrasos; bonus WhatsApp solo si todo está en verde; ensayo | – | Bonus |
| 8 | Sáb 21 | Presentación | – | – |

## Avance

- [ ] Día 1
- [ ] Día 2
- [ ] Día 3
- [ ] Día 4
- [ ] Día 5
- [ ] Día 6
- [ ] Día 7

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
- [ ] Seed regenerado con la fecha de la presentación (`node db/seed/generar-seed.mjs --fecha-referencia 2026-11-21`) y recargado en la base remota.
- [ ] Confirmar con el profesor que el seed ficticio en la base real cumple el criterio 2.
