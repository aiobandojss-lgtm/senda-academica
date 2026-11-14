# CLAUDE.md – Plataforma académica para la Fundación

Contexto para Claude Code. Léelo completo al iniciar cada sesión.

## Quién trabaja aquí

- **Aymer Ivan**, dueño de CREATIVE BY CODE S.A.S. (Cali, Colombia). Experto en Oracle PL/SQL; también trabaja con .NET Core, Angular, Node.js, Flutter y n8n.
- Trabaja en **Windows 11 con VS Code**. Los comandos y scripts deben funcionar en Windows (PowerShell): usa scripts de npm y Node, no scripts de bash.
- Prefiere avanzar **paso a paso**: explica qué vas a hacer, hazlo, y al final resume en pocas líneas qué cambió y por qué. No le entregues bloques enormes de instrucciones de una sola vez.
- Todo en **español**: conversación, interfaz, mensajes de error, documentación y nombres del dominio (estudiante, cuota, entrega...).

## Qué estamos construyendo y para qué

Un mismo producto con dos objetivos:

1. **MVP para una fundación educativa** que está comenzando y no tiene dinero: estudiantes por carrera, usuario y contraseña, talleres y evaluaciones con entregas, cuotas y pagos, y **bloqueo de acceso por mora de más de 30 días**. Web responsiva, sin app.
2. **Proyecto final del curso AI Agentic Engineer (Datapath)**, presentación en vivo el **sábado 21 de noviembre de 2026**. Encima del MVP va un **asistente académico con RAG** que responde con documentos oficiales y datos reales del estudiante, sin alucinar.

Prioridad: primero el flujo de la demo funcionando de punta a punta; luego lo demás.

## Rúbrica del proyecto final (ver `docs/rubrica.md`)

Cada criterio vale 0, 1 o 2. Todo se demuestra en vivo:

| # | Criterio | Cómo lo cumplimos |
|---|---|---|
| 1 | Funciona end-to-end | Estudiante entra → entrega taller → docente califica → estudiante ve nota → estudiante en mora no entra → se registra pago → entra |
| 2 | Datos reales | Todo sale de D1 por la API. **Nunca** datos quemados en el frontend. Seed ficticio cargado en la base real |
| 3 | IA con fundamento | Asistente RAG con citas, umbral de similitud y respuesta "no tengo esa información" |
| 4 | Calidad verificada | Vitest (unitarias + integración) y Playwright (E2E), en verde |
| 5 | Publicado y vivo | GitHub Actions → `wrangler deploy` en `main`, URL pública |
| 6 | Criterio y dominio | Specs de OpenSpec + decisiones en `design.md`; Aymer debe entender cada decisión |
| + | Bonus | Aviso de cartera por WhatsApp con n8n (solo si sobra tiempo) |

Como el criterio 6 evalúa que Aymer **entienda** lo construido, al cerrar cada tarea explica la decisión técnica principal en 2 o 3 frases.

## Metodología: OpenSpec (spec-driven development)

OpenSpec 2.x ya está inicializado (`openspec/config.yaml`, skills en `.claude/skills/`). Las specs son la fuente de verdad: si el código y la spec no coinciden, se corrige uno de los dos, nunca se ignora.

Cambios planeados (ya con proposal, specs, design y tasks validados con `openspec validate --all --strict`):

1. `openspec/changes/mvp-plataforma-academica/` – capacidades `autenticacion`, `carreras-estudiantes`, `actividades-entregas`, `cartera`, `bloqueo-mora`.
2. `openspec/changes/asistente-academico-rag/` – capacidades `base-conocimiento`, `asistente-academico`. Empieza cuando el MVP esté implementado.

Flujo de trabajo:

- Implementar: `/openspec-apply-change mvp-plataforma-academica`. Trabaja **una tarea a la vez**, en orden, y marca su checkbox en `tasks.md` solo cuando su verificación pase.
- Si aparece un requisito nuevo o una spec está mal, primero actualiza la spec (`/openspec-update-change`) y después el código.
- Al terminar un cambio: `/openspec-archive-change <nombre>`.
- Para revisar el estado: `openspec status --change <nombre>` y `openspec validate --all --strict`.

## Stack y decisiones (detalle en los `design.md`)

- **Cloudflare Workers** con **Hono** para la API (`/api/*`) y **React + Vite + Tailwind + shadcn/ui** servido como static assets del mismo Worker. Un solo `wrangler deploy`.
- **D1** (SQLite) para datos; migraciones en `migrations/` con `wrangler d1 migrations`.
- **R2** para archivos (entregas y soportes). Nunca URLs públicas: la descarga pasa por la API con permisos.
- **Sesión**: JWT HS256 en cookie HttpOnly, 8 horas (`JWT_SECRET` como secreto de Wrangler).
- **Contraseñas**: PBKDF2-SHA256, 100.000 iteraciones, formato `pbkdf2_sha256$100000$<sal_b64>$<hash_b64>` (el seed usa el mismo formato).
- **Mora**: se calcula al vuelo con la función pura `calcularEstadoMora(cuotas, excepciones, hoy)`; "hoy" siempre en America/Bogota. Bloqueado si alguna cuota con saldo > 0 tiene **más de 30 días** de vencida (31 o más), salvo excepción vigente. Se aplica en el login y en cada petición de un estudiante.
- **RAG**: Workers AI (embeddings `@cf/baai/bge-m3`) + Vectorize. Modelo de chat con function calling: verificar el catálogo vigente antes de elegirlo.
- **Pruebas**: Vitest con `@cloudflare/vitest-pool-workers`; Playwright para E2E.
- **Fechas**: `YYYY-MM-DD` para fechas de negocio, ISO UTC para fecha-hora. **Dinero**: enteros en pesos. **Notas**: 0.0 a 5.0 con un decimal.

## Diseño de la interfaz

La interfaz debe verse profesional y con identidad propia (criterio 6), no como una plantilla. Herramientas (se instalan en las tareas 1.0 y 1.7 del MVP; ver `design.md` D12):

| Herramienta | Alcance | Uso |
|---|---|---|
| Plugin `frontend-design` (oficial de Anthropic) | Usuario (global) | Criterio de diseño: tipografía, jerarquía, espaciado, color |
| MCP de shadcn/ui | Proyecto (`.mcp.json`) | Buscar e instalar componentes en `web/`; no inventar componentes que ya existen |
| MCP de Playwright | Usuario (global) | Abrir la app y revisar capturas en 375 px (celular) y 1280 px (escritorio) |

Instalación (Windows nativo: `npx` va con `cmd /c`):

```
claude plugin install frontend-design@claude-plugins-official --scope user
claude mcp add --scope user playwright -- cmd /c npx @playwright/mcp@latest
npx shadcn@latest mcp init --client claude        # dentro del proyecto, después de inicializar shadcn en web/
```

Después de instalar, Claude Code no ve las herramientas nuevas hasta reiniciar la sesión: pide a Aymer que la reinicie y verifica con `/plugin` y `/mcp`.

Reglas de diseño:

- La guía visual vive en `docs/identidad-visual.md` (se crea en la tarea 2.0) y todas las pantallas la siguen.
- Usa componentes de shadcn/ui antes de crear uno propio.
- Ninguna pantalla se da por terminada sin revisar sus capturas en 375 px y 1280 px.
- Contraste accesible (WCAG AA) y textos en español claro, pensados para estudiantes que entran desde el celular.

## Datos

- `migrations/0001_inicial.sql` – esquema del MVP (incluye la vista `v_saldo_cuotas`).
- `db/seed/generar-seed.mjs` – genera datos **ficticios** deterministas: 5 carreras, 15 cursos, 5 docentes, 60 estudiantes, actividades, entregas, cuotas y pagos, con perfiles de cartera para la demo. Fecha de referencia por defecto: 2026-11-21.
- `db/seed/seed.sql` – resultado ya generado. `db/seed/CUENTAS-DEMO.md` – cuentas para la demo (contraseña `Demo2026*`).
- `db/seed/placeholder.pdf` – archivo que se sube a R2 en `seed/placeholder.pdf` para que las entregas del seed se puedan descargar.
- `docs/rag/` – documentos ficticios para el RAG (reglamento, calendario, preguntas frecuentes, 2 planes de estudio).

Cuando lleguen los datos reales de la Fundación: base nueva, mismas migraciones, carga real. Nada del código debe depender de datos del seed.

## Reglas que no se negocian

- **Habeas Data (Ley 1581 de 2012)**: no registrar en logs contraseñas, documentos ni correos. Al modelo de IA nunca se le envía documento, correo ni celular.
- **Permisos en el servidor**, nunca solo en el frontend.
- **No enviar mensajes** (WhatsApp, correo, SMS) a datos del seed: los celulares del seed están vacíos a propósito. Para probar el bonus de WhatsApp se usa el número propio de Aymer.
- **Secretos** (`JWT_SECRET`, tokens de Cloudflare) solo con `wrangler secret put` o secretos de GitHub; nunca en el repositorio.
- No agregar dependencias pesadas sin explicar por qué.

## Comandos (se crean en la tarea 1.1; ajústalos aquí si cambian)

```
npm run dev            # wrangler dev con API y frontend
npm test               # Vitest
npm run test:e2e       # Playwright
npm run db:migrate     # wrangler d1 migrations apply DB --local
npm run db:seed        # node db/seed/generar-seed.mjs && wrangler d1 execute DB --local --file db/seed/seed.sql
npm run deploy         # build + wrangler deploy
```

## Plan de los 8 días

Ver `PLAN.md`. Hoy toca lo que esté marcado como siguiente en ese archivo.
