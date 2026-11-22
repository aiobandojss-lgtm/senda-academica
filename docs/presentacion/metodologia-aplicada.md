# Metodología del curso aplicada en Senda

Base para el guion de la presentación. Muestra qué prácticas del curso AI Agentic Engineer se aplicaron, cómo y dónde está la evidencia. Es un documento vivo: se actualiza al cerrar cada grupo de tareas.

**Estado al 2026-11-21 (noche):**
- **Todas las tareas hechas:** MVP 31 de 31, asistente RAG 13 de 13 y cierre de sesión 10 de 10. Los tres cambios de OpenSpec están archivados.
- 413 pruebas de Vitest y 3 pruebas E2E con Playwright (el flujo de la demo, el asistente y el primer ingreso), en verde.
- Pipeline: 37 de 38 ejecuciones en verde. La única roja es la prueba de fuego del Lab 14 (día 4), que debía fallar.
- En <https://senda.creativebycode.workers.dev>, los tres flujos de la demo:
  - el académico: el docente publica, el estudiante entrega desde el celular y ve su nota;
  - el de cartera: el estudiante en mora no entra; se registra el pago y entra;
  - el asistente: responde con cita y dice "no tengo esa información" cuando no sabe. Se probó en producción desde el celular.
- Presentación: lunes 23 de noviembre. Guion en [guion.md](guion.md).

Fuentes del curso que se compararon: las guías de OpenSpec, MCP, skills y pruebas, pruebas E2E y agentes QA, y arquitectura (clase 04).

## Mapa: práctica del curso → cómo se aplicó → evidencia

| Práctica del curso | Cómo se aplicó | Evidencia para mostrar |
|---|---|---|
| **Spec-Driven Development (OpenSpec 2)** | Ciclo completo proposal → specs → design → tasks → código → **archivo** en tres cambios: 31 tareas del MVP, 13 del RAG y 10 del cierre de sesión, cada una con su verificación. Al archivar, las specs delta pasaron a `openspec/specs/`: **7 capacidades, 55 requisitos y 130 escenarios WHEN/THEN**, que describen el producto terminado. Las decisiones, con su alternativa descartada, quedan en los `design.md` archivados | `openspec/specs/`; `openspec validate --all --strict` en verde |
| **Compuerta humana** | El agente no implementó comportamiento hasta que Aymer leyó y aprobó el proposal y las specs. Se aprobaron con supuestos, que se validarán con la Fundación | [Revisión del MVP](../revision/2026-11-15-revision-mvp.md) |
| **"Cuando la realidad contradice el plan"** | Primero se corrige el artefacto y después el código. Casos: D14 (condición de carrera), D17 (la "o" también es ambigua) y D11 (paquete de pruebas renombrado por Cloudflare) | Commits que cambian `design.md` antes que el código |
| **Skills** | 6 skills de OpenSpec en `.agents/skills/`, una convención compartida por varios agentes (también Antigravity), enlazadas desde `.claude/skills/`. `/openspec-apply-change` trabaja una tarea a la vez y marca el checkbox solo con la verificación en verde. La skill de TDD impone rojo → verde → refactor. El plugin `frontend-design` se usa en la identidad visual (tarea 2.0) | `.agents/skills/`, `tasks.md` |
| **Contexto para el agente** | `CLAUDE.md` con el stack, las reglas que no se negocian (Habeas Data, secretos, migraciones congeladas) y las reglas aprendidas en cada tarea. Además, memoria entre sesiones | `CLAUDE.md` |
| **MCP** | **context7**: documentación vigente de las librerías (las migraciones en la base de pruebas, el orden de arranque de Playwright, los precios de Workers AI). **Playwright**: el agente abre la aplicación y revisa capturas a 375 y 1280 px; en la tarea 6.2, un recorrido automático midió 25 pantallas en 50 capturas y encontró 4 diferencias con la guía visual. **shadcn/ui**: componentes desde el registro oficial (tarea 1.7) | `.mcp.json`; [revisión visual](../revision/2026-11-19-revision-visual.md) y [recorrido](../revision/recorrido-visual-mcp.js) |
| **IA con fundamento, medida** | Tres capas contra la alucinación (umbral, instrucciones y validación de citas), ajustadas después de una alucinación real con el modelo real. Evaluación con 25 preguntas y reglas fijas, sin un modelo juez: gpt-oss-20b 96 %, llama-3.3-70b 88 %. El 21 de noviembre, 100 %: la única falla se diagnosticó con evidencia (0,549 frente al umbral de 0,55) y se corrigió en el documento, no en el umbral. El costo se midió en tokens: ~31 neuronas por pregunta | RAG `design.md` D5 y D7, `eval/` y `npm run eval:rag` |
| **E2E sin gastar cuota** | El asistente entra a la prueba E2E con un modelo y una búsqueda simulados, que el Worker solo acepta en localhost | `e2e/asistente.spec.ts`, `api/src/rag/simulado.ts` |
| **Pruebas desde la spec, no desde el código** | Cada escenario WHEN/THEN se vuelve una prueba que lleva su nombre: **130 de 130**, y `npm run trazabilidad` lo comprueba en cada push. Al cruzarlos aparecieron 5 escenarios sin prueba automática, que se cubrieron (entre ellos, el primer ingreso en el navegador y la fuente "Entregas de talleres"). Corren en workerd (el runtime de producción) contra una D1 efímera con las migraciones reales, y con usuarios propios de cada prueba, no los del seed | `api/test/*.test.ts`; `npm run trazabilidad -- --detalle` |
| **TDD de verdad: el rojo correcto** | Siempre rojo antes de verde, y el rojo debe fallar por la razón correcta. En la tarea 2.1 se detectó y corrigió una prueba que pasaba con la función vacía | [Bitácora del día 2](../bitacora/2026-11-15-dia-2.md) |
| **Probar las pruebas: mutación** | 17 mutaciones, todas detectadas: se daña el código a propósito (quitar HttpOnly, leer el token sin verificar la firma, saltarse el límite...) y alguna prueba debe fallar | Bitácora del día 2 |
| **E2E con Playwright como compuerta** | Una prueba recorre el flujo de la demo en un navegador real contra el build de producción, con una persona por contexto (estudiantes en celular, docente y administrador en escritorio). Busca los elementos por rol y etiqueta, como un lector de pantalla. Si el flujo se rompe, no se despliega | `e2e/demo.spec.ts`; job "e2e" del pipeline |
| **CI/CD** | GitHub Actions: calidad (lint, tipos, pruebas, build) y E2E en paralelo → migraciones remotas → deploy → prueba de humo. Actions fijadas por SHA, token de Cloudflare con permisos mínimos y vencimiento, y `secrets.required` para que el deploy falle si falta un secreto. **Prueba de fuego (Lab 14):** la regla de mora se dañó a propósito (30 → 29 días) con la predicción escrita antes, y el pipeline falló tal como se predijo | `.github/workflows/ci.yml`, [despliegue.md](../operacion/despliegue.md), pull request #1 en GitHub |
| **Humano en el bucle y seguridad** | Los secretos los carga Aymer y nunca pasan por el chat. El clasificador de permisos bloqueó un `wrangler secret put` del agente, y se respetó. Ante varias opciones se presentan pros y contras antes de decidir | `docs/operacion/despliegue.md` |
| **Decisiones explicadas** (criterio 6) | ADR con contexto, decisión, alternativas y consecuencias. ADR-003 midió antes de decidir: 20 ms de CPU frente a 10 ms del plan Free | `docs/decisiones/` |
| **Bitácora diaria** | Qué se hizo, qué se aprendió y qué problemas hubo, cada día | `docs/bitacora/` |

## La historia que resume la metodología (90 segundos)

El **límite de intentos de ingreso (tarea 2.3)** recorre todo el ciclo con un solo requisito:

1. **Spec:** "el sexto intento después de cinco fallos se rechaza aunque la contraseña sea correcta".
2. **Diseño:** al implementar D14, el agente detectó que "contar y luego insertar" deja pasar una ráfaga de intentos simultáneos. Se detuvo y presentó dos opciones con sus pros y contras.
3. **Decisión humana:** Aymer eligió registrar el intento antes de verificar, en una transacción de D1. D14 se actualizó antes que el código.
4. **Mutación:** la versión original dejó pasar **10 de 10** intentos simultáneos; la elegida, exactamente **5**.
5. **CI/CD y demo en vivo:** en la URL pública, el sexto intento responde 429 "Demasiados intentos".

## Hooks y subagente (día 6, adelantados del viernes)

Las dos prácticas que faltaban, elegidas por Aymer entre varias opciones, para que cada una resuelva un problema que de verdad pasó:

| Práctica | Cómo se aplicó | Evidencia |
|---|---|---|
| **Hooks** | **Guardián de reglas** (antes de cada acción): bloquea leer o editar `.dev.vars` y editar una migración que ya está en git. Dos reglas "que no se negocian" de `CLAUDE.md` pasaron de ser una instrucción que el agente debe recordar a una barrera automática. **Detector de caracteres invisibles** (después de cada edición): avisa con línea y columna si quedó un espacio duro, un BOM o una tilde suelta, el problema que se repitió los días 3 y 6. Se descartó un typecheck tras cada edición: lento y ruidoso a mitad de un cambio | `.claude/settings.json`, `.claude/hooks/`; 23 pruebas en `node .claude/hooks/probar-hooks.mjs` |
| **Subagente revisor** | `revisor-spec`, de solo lectura y con su propio contexto: revisa el diff de una tarea contra los escenarios de la spec y las reglas que no se negocian, y reporta hallazgos con archivo y línea. Es una mirada independiente: no ve el razonamiento de quien escribió el código | `.claude/agents/revisor-spec.md` |

Hechas desde el día 3: la visión (revisión visual con el MCP de Playwright), el RAG con guardas y evaluación de 90 % o más, el archivo de los cambios y la trazabilidad de 130 de 130 escenarios con su prueba.

## Guion

El guion está en [guion.md](guion.md). La decisión técnica elegida por Aymer para contar son las guardas contra la alucinación del asistente. La historia del límite de intentos (arriba) queda como respaldo para las preguntas.
