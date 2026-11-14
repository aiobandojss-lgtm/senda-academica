# CLAUDE.md – Senda, plataforma académica para la Fundación

Contexto para Claude Code. Léelo completo al iniciar cada sesión.

## Quién trabaja aquí

- **Aymer Ivan**, dueño de CREATIVE BY CODE S.A.S. (Cali, Colombia). Experto en Oracle PL/SQL; también trabaja con .NET Core, Angular, Node.js, Flutter y n8n.
- Trabaja en **Windows 11 con VS Code** (terminal PowerShell). Los comandos y scripts deben funcionar en Windows: usa scripts de npm y Node, no scripts de bash.
- Quiere **aprender mientras construye**: explica qué vas a hacer y por qué, hazlo, verifica con evidencia y resume en pocas líneas qué cambió. Cuando haya varias opciones, muestra pros y contras antes de elegir. No le entregues bloques enormes de instrucciones de una sola vez.
- Todo en **español**: conversación, interfaz, mensajes de error, documentación, commits y nombres del dominio (estudiante, cuota, entrega...).
- Las acciones de cuentas y secretos las hace él: logins (`wrangler login`, `gh auth`), secretos (`wrangler secret put`, secretos de GitHub), reinicios de Claude Code y aprobaciones visuales. Dale el comando exacto y espera su resultado.

## Qué estamos construyendo y para qué

**Senda** (nombre genérico del producto, independiente de la Fundación; configurable). Un mismo producto con dos objetivos:

1. **MVP para una fundación educativa** que está comenzando y no tiene dinero: estudiantes por carrera, usuario y contraseña, talleres y evaluaciones con entregas, cuotas y pagos, y **bloqueo de acceso por mora de más de 30 días**. Web responsiva, sin app.
2. **Proyecto final del curso AI Agentic Engineer (Datapath)**, presentación en vivo el **sábado 21 de noviembre de 2026**. Encima del MVP va el **asistente académico Senda con RAG** que responde con documentos oficiales y datos reales del estudiante, sin alucinar.

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
| 6 | Criterio y dominio | Specs de OpenSpec + decisiones en `design.md` y `docs/decisiones/`; Aymer debe entender cada decisión |
| + | Bonus | Aviso de cartera por WhatsApp con n8n (solo si sobra tiempo) |

Como el criterio 6 evalúa que Aymer **entienda** lo construido, al cerrar cada tarea explica la decisión técnica principal en 2 o 3 frases.

## Metodología: OpenSpec 2.0 (spec-driven development)

OpenSpec 2.0 está inicializado: `openspec/config.yaml` y 6 skills en `.agents/skills/` (convención compartida entre agentes), enlazadas desde `.claude/skills/`. Si al clonar en Windows los enlaces quedan como archivos de texto, ejecuta `openspec update`. Las specs son la fuente de verdad: si el código y la spec no coinciden, se corrige uno de los dos, nunca se ignora.

Cambios planeados (validados con `openspec validate --all --strict`; ajustados el 2026-11-14 con mejoras de seguridad, Habeas Data y huecos funcionales):

1. `openspec/changes/mvp-plataforma-academica/` – capacidades `autenticacion`, `carreras-estudiantes`, `actividades-entregas`, `cartera`, `bloqueo-mora`. 31 tareas.
2. `openspec/changes/asistente-academico-rag/` – capacidades `base-conocimiento`, `asistente-academico`. 13 tareas. Empieza cuando el MVP esté implementado.

Flujo de trabajo (las skills se invocan como comandos):

- Implementar: `/openspec-apply-change mvp-plataforma-academica`. Trabaja **una tarea a la vez**, en orden, y marca su checkbox en `tasks.md` solo cuando su verificación pase.
- Si aparece un requisito nuevo o una spec está mal, primero actualiza el cambio (`/openspec-update-change`) y después el código.
- Al terminar un cambio: `/openspec-archive-change <nombre>`.
- Para revisar el estado: `openspec list`, `openspec status --change <nombre>` y `openspec validate --all --strict`.

## Stack y decisiones (detalle en los `design.md`)

- **Cloudflare Workers** (Worker `senda`) con **Hono** para la API (`/api/*`) y **React + Vite + Tailwind + shadcn/ui** servido como static assets del mismo Worker. Un solo `wrangler deploy`.
- **D1** (SQLite) para datos; migraciones en `migrations/` con `wrangler d1 migrations`. Las reglas críticas también viven en la base como triggers que abortan con códigos (`PAGO_SUPERA_SALDO`, `PAGO_INMUTABLE`, `CUOTA_CON_PAGOS`, `ENTREGA_CALIFICADA`); la API los traduce a mensajes en español (D13).
- **R2** para archivos (entregas y soportes). Nunca URLs públicas: la descarga pasa por la API con permisos.
- **Sesión**: JWT HS256 en cookie HttpOnly, 8 horas desde el ingreso (`JWT_SECRET` como secreto de Wrangler), **revocable** con `usuarios.sesion_version` (D4). Compuertas de primer ingreso: contraseña temporal y aviso de privacidad (D16).
- **Contraseñas**: PBKDF2-SHA256, 100.000 iteraciones, formato `pbkdf2_sha256$100000$<sal_b64>$<hash_b64>` (el seed usa el mismo formato). Límite de 5 intentos fallidos por documento en 15 minutos (D14). ⚠️ El plan Free de Workers da 10 ms de CPU por petición: se mide en la tarea 1.8.
- **Mora**: se calcula al vuelo con la función pura `calcularEstadoMora(cuotas, excepciones, hoy)` → `al_dia | en_riesgo | bloqueado | con_excepcion`; "hoy" siempre en America/Bogota. Bloqueado si alguna cuota con saldo > 0 tiene **más de 30 días** de vencida (31 o más), salvo excepción vigente. Se aplica en el login y en cada petición de un estudiante.
- **RAG**: Workers AI (embeddings `@cf/baai/bge-m3`) + Vectorize. Modelo de chat con function calling: verificar el catálogo vigente y comparar 2 candidatos. Historial en D1 (`asistente_mensajes`), 30 preguntas diarias, retención de 30 días.
- **Pruebas**: Vitest **^4.1** (lo exige `@cloudflare/vitest-pool-workers` 0.23; no subir a vitest 5) y Playwright para E2E.
- **Fechas**: `YYYY-MM-DD` para fechas de negocio, `YYYY-MM-DDTHH:MM:SSZ` (UTC) para fecha-hora. **Dinero**: enteros en pesos. **Notas**: 0.0 a 5.0 con un decimal. "Tardía" se calcula, no se guarda (D20).
- **Variables del Worker**: `PRODUCTO_NOMBRE` (Senda), `FUNDACION_NOMBRE`, `CONTACTO_FUNDACION`, `AVISO_PRIVACIDAD_VERSION` (`2026-11`, igual que el seed). Ningún nombre queda quemado en el código.

## Entorno

- **Node 24** con fnm (`.node-version`). En PowerShell fnm cambia de versión solo al entrar a la carpeta.
- En la herramienta Bash de Claude Code (Git Bash), antepone a cada comando de Node/npm: `eval "$(fnm env --shell bash)" && fnm use --silent-if-unchanged`. Sin eso se usa el Node 20 del sistema, que es demasiado viejo para wrangler, OpenSpec 2 y vitest.
- Finales de línea: `.gitattributes` fija LF y marca los binarios (no quitarlo: protege `placeholder.pdf`).

## Diseño de la interfaz

La interfaz debe verse profesional y con identidad propia (criterio 6), no como una plantilla. Herramientas (ver `design.md` D12):

| Herramienta | Alcance | Estado |
|---|---|---|
| Plugin `frontend-design` (oficial de Anthropic) | Usuario (global) | Instalado; se verifica en la tarea 1.0 |
| MCP de Playwright | Usuario (global) | Instalado; se verifica en la tarea 1.0 |
| MCP de shadcn/ui | Proyecto (`.mcp.json`) | Se configura en la tarea 1.7 con `npx shadcn@latest mcp init --client claude` |

Después de instalar algo, Claude Code no ve las herramientas nuevas hasta reiniciar la sesión: pide a Aymer que la reinicie y verifica con `/plugin` y `/mcp`.

Reglas de diseño:

- La guía visual vive en `docs/identidad-visual.md` (se crea en la tarea 2.0) y todas las pantallas la siguen.
- Usa componentes de shadcn/ui antes de crear uno propio.
- Ninguna pantalla se da por terminada sin revisar sus capturas en 375 px y 1280 px.
- Contraste accesible (WCAG AA) y textos en español claro, pensados para estudiantes que entran desde el celular.

## Datos

- `migrations/0001_inicial.sql` – esquema del MVP (vista `v_saldo_cuotas`, tabla `intentos_fallidos` y 5 triggers). **Desde que se aplique en la tarea 1.3 queda congelada**: cualquier cambio de esquema va en una migración nueva.
- `db/seed/generar-seed.mjs` – genera datos **ficticios** deterministas: 5 carreras, 15 cursos, 5 docentes, 60 estudiantes, actividades, entregas, cuotas y pagos, con perfiles de cartera para la demo y una cuenta de primer ingreso. Fecha de referencia por defecto: 2026-11-21.
- `db/seed/seed.sql` – resultado ya generado (empieza borrando las tablas: sirve para reiniciar la base). `db/seed/CUENTAS-DEMO.md` – cuentas para la demo (contraseña `Demo2026*`).
- `db/seed/placeholder.pdf` – archivo que se sube a R2 en `seed/placeholder.pdf` para que las entregas del seed se puedan descargar.
- `docs/rag/` – documentos ficticios para el RAG (reglamento, calendario, preguntas frecuentes, 2 planes de estudio).

Cuando lleguen los datos reales de la Fundación: base nueva, mismas migraciones, carga real. Nada del código debe depender de datos del seed.

## Documentación (`docs/`)

- `docs/README.md` – índice.
- `docs/decisiones/` – ADR numerados (contexto, decisión, alternativas, consecuencias) para decisiones que no caben en un `design.md`.
- `docs/bitacora/` – **una entrada por día de trabajo**: qué se hizo, conceptos aprendidos, problemas y cómo se resolvieron. Es la materia prima de la sustentación y del manual de metodología (repositorio aparte `manual-ingenieria-agentica`). Al cerrar cada día, propone la entrada.
- `docs/operacion/` y `docs/presentacion/` – se llenan al acercarse el despliegue y la demo.

## Reglas que no se negocian

- **Habeas Data (Ley 1581 de 2012)**: no registrar en logs contraseñas, documentos ni correos. Al modelo de IA nunca se le envía documento, correo ni celular. El docente no recibe datos de contacto de sus estudiantes (D18).
- **Permisos en el servidor**, nunca solo en el frontend.
- **No enviar mensajes** (WhatsApp, correo, SMS) a datos del seed: los celulares del seed están vacíos a propósito. Para probar el bonus de WhatsApp se usa el número propio de Aymer.
- **Secretos** (`JWT_SECRET`, tokens de Cloudflare) solo con `wrangler secret put` o secretos de GitHub; nunca en el repositorio. Nunca copiar archivos de las carpetas de clases anteriores (algunas tienen credenciales en texto plano).
- **No editar migraciones ya aplicadas.**
- No agregar dependencias pesadas sin explicar por qué.
- Commits frecuentes en español, con verificación previa (lint, typecheck, pruebas según aplique).

## Comandos (se crean en la tarea 1.1; ajústalos aquí si cambian)

```
npm run dev            # servidor local con API y frontend
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm test               # Vitest
npm run test:e2e       # Playwright
npm run db:migrate     # wrangler d1 migrations apply DB --local
npm run db:seed        # node db/seed/generar-seed.mjs && wrangler d1 execute DB --local --file db/seed/seed.sql
npm run deploy         # build + wrangler deploy
```

## Plan de los 8 días

Ver `PLAN.md`. Hoy toca lo que esté marcado como siguiente en ese archivo.
