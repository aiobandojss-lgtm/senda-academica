# Plataforma académica – Fundación (kit de arranque)

Este kit trae todo lo planeado antes de escribir código: contexto para Claude Code, specs de OpenSpec validadas, esquema de base de datos, datos ficticios y documentos para el RAG.

## Qué hay

| Ruta | Para qué |
|---|---|
| `CLAUDE.md` | Contexto que Claude Code lee en cada sesión (proyecto, rúbrica, stack, reglas) |
| `PLAN.md` | Plan de 8 días y guion de la presentación |
| `openspec/` | Configuración y los dos cambios: `mvp-plataforma-academica` y `asistente-academico-rag` |
| `migrations/0001_inicial.sql` | Esquema de D1 |
| `db/seed/` | Generador de datos ficticios, `seed.sql` listo, `placeholder.pdf` y `CUENTAS-DEMO.md` |
| `docs/rag/` | Documentos ficticios para el asistente |
| `docs/rubrica.md` | Rúbrica del curso |

## Cómo arrancar (Windows)

**1. Requisitos.** Node.js 20 o superior (`node -v`), Git, una cuenta gratuita de Cloudflare y una de GitHub.

**2. Ubicar el proyecto.** Descomprime en una ruta sin espacios, por ejemplo `C:\Proyectos\plataforma-fundacion`, y ábrela en VS Code.

**3. Activar OpenSpec para Claude Code.** En la terminal de VS Code:

```
npm install -g @fission-ai/openspec@latest
openspec init --tools claude --language es
openspec validate --all --strict
```

`init` respeta la configuración y los cambios que ya trae el kit; solo agrega los comandos `/openspec-*` para Claude Code. La validación debe mostrar los dos cambios en verde.

**4. Repositorio.** Crea un repositorio privado en GitHub y sube el proyecto:

```
git init
git add .
git commit -m "Kit inicial: specs OpenSpec, esquema y datos ficticios"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/plataforma-fundacion.git
git push -u origin main
```

**5. Cloudflare.** `npx wrangler login` (abre el navegador para autorizar).

**6. Arrancar con Claude Code.** En la carpeta del proyecto ejecuta `claude` y pega este primer mensaje:

> Lee CLAUDE.md, PLAN.md y el cambio de OpenSpec mvp-plataforma-academica (proposal, specs, design y tasks). Hoy es el día 1. Aplica el cambio con /openspec-apply-change empezando por la tarea 1.0 (instalar las herramientas de diseño). Trabaja una tarea a la vez, verifica como indica la tarea, márcala en tasks.md y detente al terminar cada una para que yo la revise antes de seguir.

En la tarea 1.0, Claude Code instala de forma global el plugin `frontend-design` y el MCP de Playwright, y en la 1.7 el MCP de shadcn/ui para el proyecto. Cuando te lo pida, cierra la sesión (`/exit`) y vuelve a ejecutar `claude` para que cargue las herramientas nuevas.

## Regenerar los datos ficticios

```
node db/seed/generar-seed.mjs --fecha-referencia 2026-11-21
```

Con la misma fecha siempre salen los mismos datos. Las cuotas se calculan respecto a esa fecha, para que el día de la demo los estudiantes de prueba estén al día, en riesgo, bloqueados o con excepción, como dice `CUENTAS-DEMO.md`.
