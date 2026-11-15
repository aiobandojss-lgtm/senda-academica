# Senda – plataforma académica

Plataforma web para que una fundación educativa gestione sus estudiantes, sus talleres y evaluaciones, y su cartera, con bloqueo automático de acceso por mora y un asistente académico con IA que responde con documentos oficiales y datos reales del estudiante, sin inventar.

> 🚧 **En construcción** (noviembre de 2026). Proyecto final del curso *AI Agentic Engineer* y MVP para una fundación real. Desarrollado por CREATIVE BY CODE S.A.S. con desarrollo guiado por especificaciones (OpenSpec) y Claude Code.

## Stack

| Capa | Tecnología |
|---|---|
| API | Cloudflare Workers + Hono |
| Frontend | React + Vite + Tailwind + shadcn/ui (static assets del mismo Worker) |
| Datos | Cloudflare D1 (SQLite) con migraciones y triggers |
| Archivos | Workers KV en la demo, Cloudflare R2 en producción (descarga solo por la API, con permisos) |
| IA | Workers AI (embeddings bge-m3 + modelo con function calling) y Vectorize |
| Calidad | Vitest + Playwright; CI/CD con GitHub Actions |

## Estructura

| Ruta | Para qué |
|---|---|
| `openspec/` | Especificaciones: cambios `mvp-plataforma-academica` y `asistente-academico-rag` (proposal, specs, design, tasks) |
| `migrations/` | Esquema de D1 |
| `db/seed/` | Generador de datos ficticios deterministas y cuentas de demostración |
| `docs/` | Documentación del producto: decisiones, bitácora, operación y presentación |
| `CLAUDE.md` | Contexto para Claude Code |
| `PLAN.md` | Plan de trabajo y guion de la presentación |

## Requisitos para desarrollar

- Node.js 24 (ver `.node-version`; se recomienda fnm).
- OpenSpec 2: `npm i -g @fission-ai/openspec@latest`.
- Cuenta de Cloudflare (plan gratuito) y de GitHub.

Las instrucciones para correr el proyecto se completan cuando exista el código (tarea 1.1 del MVP).
