# Metodología del curso aplicada en Senda

Base para el guion de la presentación. Muestra qué prácticas del curso AI Agentic Engineer se aplicaron, cómo y dónde está la evidencia. Es un documento vivo: se actualiza al cerrar cada grupo de tareas.

**Estado al 2026-11-16 (noche):**
- MVP: 21 de 31 tareas (grupos 1, 2 y 3 completos, y la 5.1 adelantada).
- 157 pruebas en verde.
- 18 de 18 ejecuciones del pipeline en verde.
- 46 commits.
- En <https://senda.creativebycode.workers.dev>: ingreso, primer ingreso (contraseña temporal y aviso de privacidad), menú por rol y la administración de carreras, cursos, docentes y estudiantes, incluida la carga masiva por CSV.

Fuentes del curso que se compararon: las guías de OpenSpec, MCP, skills y pruebas, pruebas E2E y agentes QA, y arquitectura (clase 04).

## Mapa: práctica del curso → cómo se aplicó → evidencia

| Práctica del curso | Cómo se aplicó | Evidencia para mostrar |
|---|---|---|
| **Spec-Driven Development (OpenSpec 2)** | Ciclo proposal → specs → design → tasks en dos cambios. **MVP:** 5 capacidades, 38 requisitos, 82 escenarios WHEN/THEN, 20 decisiones con su alternativa descartada y 31 tareas, cada una con su verificación. **RAG:** 2 capacidades, 14 requisitos, 23 escenarios, 10 decisiones y 13 tareas | `openspec/changes/`; `openspec validate --all --strict` en verde |
| **Compuerta humana** | El agente no implementó comportamiento hasta que Aymer leyó y aprobó el proposal y las specs. Se aprobaron con supuestos, que se validarán con la Fundación | [Revisión del MVP](../revision/2026-11-15-revision-mvp.md) |
| **"Cuando la realidad contradice el plan"** | Primero se corrige el artefacto y después el código. Casos: D14 (condición de carrera), D17 (la "o" también es ambigua) y D11 (paquete de pruebas renombrado por Cloudflare) | Commits que cambian `design.md` antes que el código |
| **Skills** | 6 skills de OpenSpec en `.agents/skills/`, una convención compartida por varios agentes (también Antigravity), enlazadas desde `.claude/skills/`. `/openspec-apply-change` trabaja una tarea a la vez y marca el checkbox solo con la verificación en verde. La skill de TDD impone rojo → verde → refactor. El plugin `frontend-design` se usa en la identidad visual (tarea 2.0) | `.agents/skills/`, `tasks.md` |
| **Contexto para el agente** | `CLAUDE.md` con el stack, las reglas que no se negocian (Habeas Data, secretos, migraciones congeladas) y las reglas aprendidas en cada tarea. Además, memoria entre sesiones | `CLAUDE.md` |
| **MCP** | **context7**: documentación vigente de las librerías; con ella se encontró cómo aplicar las migraciones reales a la base de pruebas. **Playwright**: el agente abre la aplicación y revisa capturas a 375 y 1280 px. **shadcn/ui**: componentes desde el registro oficial (tarea 1.7) | `.mcp.json`; capturas de las pantallas |
| **Pruebas desde la spec, no desde el código** | Cada escenario WHEN/THEN se vuelve una prueba con el mismo nombre. Corren en workerd (el runtime de producción) contra una D1 efímera con las migraciones reales, y con usuarios propios de cada prueba, no los del seed | `api/test/*.test.ts` |
| **TDD de verdad: el rojo correcto** | Siempre rojo antes de verde, y el rojo debe fallar por la razón correcta. En la tarea 2.1 se detectó y corrigió una prueba que pasaba con la función vacía | [Bitácora del día 2](../bitacora/2026-11-15-dia-2.md) |
| **Probar las pruebas: mutación** | 17 mutaciones, todas detectadas: se daña el código a propósito (quitar HttpOnly, leer el token sin verificar la firma, saltarse el límite...) y alguna prueba debe fallar | Bitácora del día 2 |
| **CI/CD** | GitHub Actions: calidad (lint, tipos, pruebas, build) → migraciones remotas → deploy → prueba de humo. Actions fijadas por SHA, token de Cloudflare con permisos mínimos y vencimiento, y `secrets.required` para que el deploy falle si falta un secreto | `.github/workflows/ci.yml`, [despliegue.md](../operacion/despliegue.md) |
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

## Prácticas del curso pendientes

| Práctica | Plan |
|---|---|
| MCP de shadcn/ui | Tarea 1.7 |
| Hooks | Propuesta: typecheck automático tras cada edición o bloqueo de lectura de `.dev.vars` |
| Subagente que revisa el código | Propuesta: revisión independiente al cerrar cada tarea |
| E2E con Playwright como compuerta del CI | Grupo 6 del MVP |
| Visión: el agente revisa las pantallas | Capturas a 375 y 1280 px en cada pantalla (tareas 2.6 en adelante) |
| RAG con guardas y evaluación ≥ 90 % | Cambio `asistente-academico-rag` |
| Archivar el cambio | `/openspec-archive-change`: las specs pasan a ser la fuente de verdad del sistema |

## Propuesta de guion (~10 minutos)

La rúbrica pide "~10 minutos de demo en vivo", y 5 de los 6 criterios se demuestran con el producto funcionando. Por eso la metodología se cuenta **usando el producto como evidencia**, no en diapositivas aparte.

| Tiempo | Bloque | Criterios |
|---|---|---|
| 1 min | El problema de la Fundación y qué es Senda | – |
| 2,5 min | OpenSpec con la historia del límite de intentos | 6, 4, 5 |
| 3 min | Demo del flujo (entrega → nota → asistente → bloqueo por mora → pago), diciendo qué spec respalda cada paso | 1, 2, 3 |
| 1,5 min | Calidad: pruebas, mutación y pipeline en verde | 4, 5 |
| 1,5 min | El agente con contexto: `CLAUDE.md`, skills, MCP, hooks y humano en el bucle | 6 |
| 0,5 min | Cierre | – |

Pregunta para el profesor: cuánto pesa la exposición de la metodología frente a la demo en vivo.
