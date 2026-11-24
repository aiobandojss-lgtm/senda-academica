# Senda – plataforma académica con un asistente que no inventa

Plataforma web para que una fundación educativa que está empezando, y no tiene presupuesto, gestione sus estudiantes, sus talleres y evaluaciones y su cartera. Bloquea el acceso automáticamente cuando una cuota pasa de 30 días vencida. Incluye un asistente académico con IA que responde con los documentos oficiales y con los datos reales del estudiante, cita su fuente y, si no tiene la información, lo dice en lugar de inventar.

[![CI/CD](https://github.com/aiobandojss-lgtm/senda-academica/actions/workflows/ci.yml/badge.svg)](https://github.com/aiobandojss-lgtm/senda-academica/actions/workflows/ci.yml)

> **Proyecto final del curso *AI Agentic Engineer* (Datapath)**, por Aymer Ivan Obando Valois (CREATIVE BY CODE S.A.S., Cali). También es el MVP para una fundación educativa real. Se construyó con desarrollo guiado por especificaciones (OpenSpec) y con Claude Code como agente.

## Pruébelo

**Demo publicada:** <https://senda.creativebycode.workers.dev>. Corre en el plan gratuito de Cloudflare y se despliega sola en cada push a `main`.

Los datos son ficticios, pero están cargados en la base de datos real. La contraseña de todas las cuentas es `Demo2026*`; la lista completa está en [db/seed/CUENTAS-DEMO.md](db/seed/CUENTAS-DEMO.md).

| Usuario (documento) | Quién es | Qué probar |
|---|---|---|
| `9900001001` | Paola, estudiante al día | Subir su entrega del Taller 3 de Lógica, ver su nota y preguntarle al asistente |
| `9900000103` | Liliana, docente | Calificar la entrega de Paola (Mis cursos → Lógica → Taller 3) |
| `9900001002` | Manuela, estudiante en mora | No puede entrar: tiene una cuota con más de 30 días de vencida |
| `9900000001` | Administración | Cartera → Manuela → registrar el pago de la cuota de octubre; después Manuela entra |

Preguntas para el asistente (cuenta de Paola):

- **Con respuesta y cita:** «¿Cuál es la nota mínima para aprobar?», «¿Cuándo es la semana de parciales?»
- **Con sus datos reales:** «¿Cuánto debo en total?»
- **Sin información, y debe decirlo en lugar de inventar:** «¿Qué venden en la cafetería?»

## Cómo verificar cada criterio de la rúbrica

| # | Criterio | Dónde está la evidencia |
|---|---|---|
| 1 | Funciona de punta a punta | El flujo de la tabla anterior: Paola entrega, Liliana califica, Paola ve su nota, Manuela no entra por mora, se registra el pago y entra. El mismo flujo lo repite solo la prueba E2E [e2e/demo.spec.ts](e2e/demo.spec.ts) en cada push. |
| 2 | Datos reales | Todo sale de Cloudflare D1 por la API; el frontend no tiene datos escritos y [web/src/lib/api.ts](web/src/lib/api.ts) es su único cliente. Esquema en [migrations/](migrations/), con triggers que protegen las reglas críticas en la propia base. Datos ficticios deterministas generados por [db/seed/generar-seed.mjs](db/seed/generar-seed.mjs). |
| 3 | IA con fundamento | RAG con Workers AI y Vectorize. Tres guardas: umbral de similitud 0,55 ([api/src/rag/herramientas.ts](api/src/rag/herramientas.ts)), respuesta sin cita reemplazada por «no tengo esa información» ([api/src/rag/agente.ts](api/src/rag/agente.ts)) y cifras solo si salen de una fuente. Se mide con 25 preguntas calificadas por reglas fijas ([eval/](eval/)): 25 de 25 en la última corrida. Los reportes anteriores se conservan, incluido uno de 92 %: el modelo no es determinista. |
| 4 | Calidad verificada | 413 pruebas de Vitest (unitarias e integración, en workerd, el mismo runtime de producción) y 3 flujos E2E con Playwright. [scripts/trazabilidad.mjs](scripts/trazabilidad.mjs) comprueba en el CI que los **130 escenarios** de las specs tienen una prueba con su nombre: hoy 130 de 130. |
| 5 | Publicado y vivo | [GitHub Actions](https://github.com/aiobandojss-lgtm/senda-academica/actions): lint, typecheck, pruebas, trazabilidad y E2E; si todo pasa, `wrangler deploy` a producción. El [PR #1, «Prueba de fuego»](https://github.com/aiobandojss-lgtm/senda-academica/pull/1), daña la regla de mora a propósito: las pruebas lo detectan y el PR queda en rojo. Como el despliegue exige que pasen la calidad y el E2E, un cambio así no llega a producción. |
| 6 | Criterio y dominio | Specs en [openspec/specs/](openspec/specs/) (7 capacidades, 130 escenarios). Tres cambios con su propuesta, diseño y tareas en [openspec/changes/archive/](openspec/changes/archive/); cada `design.md` explica sus decisiones con las alternativas descartadas. Decisiones de arquitectura en [docs/decisiones/](docs/decisiones/), identidad visual en [docs/identidad-visual.md](docs/identidad-visual.md) y una bitácora diaria en [docs/bitacora/](docs/bitacora/). |

## Cómo se construyó

- **Specs primero (OpenSpec).** Cada cambio pasó por propuesta, specs, diseño y tareas. Aymer los revisó antes de programar; después se implementaron una tarea a la vez y se archivaron. Las specs son la fuente de verdad: si el código y la spec no coinciden, se corrige uno de los dos.
- **Un agente con reglas (Claude Code).**
  - [CLAUDE.md](CLAUDE.md) le da al agente el contexto del proyecto y las reglas que no se negocian.
  - Las skills de OpenSpec están en [.claude/skills/](.claude/skills/).
  - Los hooks ([.claude/hooks/](.claude/hooks/)) le impiden leer secretos o editar migraciones ya aplicadas.
  - Un subagente revisor independiente ([.claude/agents/revisor-spec.md](.claude/agents/revisor-spec.md)) revisa cada tarea contra las specs.
  - Se usaron los MCP de Playwright (revisión visual) y de shadcn/ui.
- **El humano decide.** Las decisiones de producto (por ejemplo, corregir el texto del calendario en lugar de bajar el umbral del RAG) quedaron registradas con su porqué.
- **Privacidad (Ley 1581 de 2012).** Al modelo de IA nunca se le envía documento, correo ni celular. Los logs no guardan datos personales. Los permisos se validan en el servidor, no solo en la pantalla.

## Stack

| Capa | Tecnología |
|---|---|
| API | Cloudflare Workers + Hono |
| Frontend | React + Vite + Tailwind + shadcn/ui (static assets del mismo Worker) |
| Datos | Cloudflare D1 (SQLite) con migraciones y triggers |
| Archivos | Workers KV en la demo, Cloudflare R2 en producción (descarga solo por la API, con permisos) |
| IA | Workers AI (embeddings `bge-m3` y `gpt-oss-20b` con function calling) y Vectorize |
| Calidad | Vitest + Playwright; CI/CD con GitHub Actions |

## Estructura

| Ruta | Para qué |
|---|---|
| `api/` | Worker de Cloudflare con Hono (todas las rutas bajo `/api`) y sus pruebas en `api/test/` |
| `web/` | Frontend React + Tailwind + shadcn/ui |
| `e2e/` | Pruebas de punta a punta con Playwright |
| `openspec/` | Specs (`specs/`) y los tres cambios archivados (`changes/archive/`) |
| `migrations/` | Esquema de D1 |
| `db/seed/` | Generador de datos ficticios deterministas y cuentas de demostración |
| `eval/` | Evaluación del asistente: preguntas, calificador y reportes |
| `docs/` | Decisiones, bitácora, documentos del RAG (`docs/rag/`), operación y presentación |
| `CLAUDE.md` y `.claude/` | Contexto, skills, hooks y subagente del agente |
| `PLAN.md` | Plan de trabajo día a día |

## Correr en local

Requisitos: Node.js 24 (ver `.node-version`; se recomienda fnm), OpenSpec 2 (`npm i -g @fission-ai/openspec@latest`) y una cuenta de Cloudflare en el plan gratuito.

```bash
npm ci                           # instala exactamente lo del package-lock.json
cp .dev.vars.example .dev.vars   # y pon en JWT_SECRET una clave aleatoria (el archivo explica cómo generarla)
npm run db:migrate               # crea las tablas en la D1 local
npm run db:seed                  # carga los datos ficticios (cuentas en db/seed/CUENTAS-DEMO.md)
npm run dev                      # http://localhost:5173 (frontend y API en el mismo puerto)
```

Verificación rápida: `GET http://localhost:5173/api/salud` responde `{"ok":true}`. El asistente usa Workers AI, que no tiene simulador local: `npm run dev` necesita `wrangler login`.

| Script | Para qué |
|---|---|
| `npm run dev` | Servidor de desarrollo: React con recarga en caliente y el Worker en workerd |
| `npm run build` | Typecheck + build de producción |
| `npm run lint` / `npm run typecheck` | Calidad estática |
| `npm test` | Pruebas de la API con Vitest dentro de workerd |
| `npm run test:e2e` | Flujos E2E con Playwright, con el modelo de IA simulado |
| `npm run trazabilidad` | Comprueba que cada escenario de las specs tiene su prueba |
| `npm run eval:rag` | Evalúa el asistente con las 25 preguntas de `eval/preguntas.json` |
| `npm run deploy` | Build + despliegue con Wrangler |
