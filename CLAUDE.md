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
2. **Proyecto final del curso AI Agentic Engineer (Datapath)**, presentación en vivo el **lunes 23 de noviembre de 2026** (pasó del viernes 20; confirmado el 19 de noviembre). Encima del MVP va el **asistente académico Senda con RAG** que responde con documentos oficiales y datos reales del estudiante, sin alucinar.

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

**Fuente de verdad del producto: `openspec/specs/`**, con 7 capacidades: `autenticacion`, `carreras-estudiantes`, `actividades-entregas`, `cartera`, `bloqueo-mora`, `base-conocimiento` y `asistente-academico`.

Los tres cambios del proyecto están **implementados y archivados**, con sus specs sincronizadas en `openspec/specs/`. Sus decisiones siguen en su `design.md` y el código las cita como "design.md Dn" (MVP), "RAG design.md Dn" y "cambio cerrar-sesion-y-temas-de-cursos, design.md Dn":

1. `openspec/changes/archive/2026-11-19-mvp-plataforma-academica/`: autenticación, carreras y estudiantes, actividades y entregas, cartera y bloqueo por mora. 31 tareas.
2. `openspec/changes/archive/2026-11-19-asistente-academico-rag/`: base de conocimiento y asistente académico. 13 tareas.
3. `openspec/changes/archive/2026-11-21-cerrar-sesion-y-temas-de-cursos/`: cerrar sesión revoca el token en el servidor y el asistente no explica temas de los cursos. 10 tareas (archivado tras la prueba manual del 21 de noviembre: 46 de 47).

Flujo de trabajo para lo que siga (las skills se invocan como comandos):

- Un cambio nuevo empieza con `/openspec-propose`, que crea la propuesta, las specs delta, el design y las tareas, y lo revisa Aymer antes de programar.
- Implementar: `/openspec-apply-change <nombre>`. Trabaja **una tarea a la vez**, en orden, y marca su checkbox en `tasks.md` solo cuando su verificación pase.
- Si aparece un requisito nuevo o una spec está mal, primero actualiza el cambio (`/openspec-update-change`) y después el código.
- Al terminar un cambio: `/openspec-archive-change <nombre>`.
- Para revisar el estado: `openspec list`, `openspec status --change <nombre>` y `openspec validate --all --strict`.

## Stack y decisiones (detalle en los `design.md`)

- **Cloudflare Workers** (Worker `senda`) con **Hono** para la API (`/api/*`) y **React + Vite + Tailwind + shadcn/ui** con **React Router 8** (modo declarativo) y **TanStack Query** (`web/src/lib/consultas.ts`) servido como static assets del mismo Worker. Un solo `wrangler deploy`.
- **D1** (SQLite) para datos; migraciones en `migrations/` con `wrangler d1 migrations`. Las reglas críticas también viven en la base como triggers que abortan con códigos (`PAGO_SUPERA_SALDO`, `PAGO_INMUTABLE`, `CUOTA_CON_PAGOS`, `ENTREGA_CALIFICADA`); la API los traduce a mensajes en español (D13).
- **Archivos** (entregas y soportes) detrás de la interfaz `AlmacenArchivos`: **Workers KV** hasta después de la presentación (23 de noviembre) (R2 exige medio de pago) y **R2** en producción; lo elige la variable `ALMACEN_ARCHIVOS` (D7, ADR-002). Nunca URLs públicas: la descarga pasa por la API con permisos.
- **Sesión**: JWT HS256 en la cookie `__Host-sesion` (HttpOnly, Secure, SameSite=Lax), 8 horas desde el ingreso (`JWT_SECRET` como secreto de Wrangler), **revocable** con `usuarios.sesion_version` (D4). Cerrar sesión también la sube (cambio `cerrar-sesion-y-temas-de-cursos`, D1): revoca el token en el servidor y cierra los otros equipos del usuario, y solo un token vigente puede hacerlo. Compuertas de primer ingreso: contraseña temporal y aviso de privacidad (D16). Errores de la API siempre como `{ codigo, mensaje }` (`api/src/errores.ts`); validación de cuerpos con zod (`validarJson`).
- **Contraseñas**: PBKDF2-SHA256, 100.000 iteraciones, formato `pbkdf2_sha256$100000$<sal_b64>$<hash_b64>` (el seed usa el mismo formato). Límite de 5 intentos fallidos por documento en 15 minutos (D14). ⚠️ El plan Free de Workers da 10 ms de CPU por petición: se mide en la tarea 1.8.
- **Mora**: se calcula al vuelo con la función pura `calcularEstadoMora(cuotas, excepciones, hoy)` → `al_dia | en_riesgo | bloqueado | con_excepcion`; "hoy" siempre en America/Bogota. Bloqueado si alguna cuota con saldo > 0 tiene **más de 30 días** de vencida (31 o más), salvo excepción vigente. Se aplica en el login y en cada petición de un estudiante.
- **RAG**: Workers AI (embeddings `@cf/baai/bge-m3`) + Vectorize. Modelo de chat con function calling: `@cf/openai/gpt-oss-20b` en `MODELO_CHAT`, elegido por la evaluación de la tarea 4.1 (96 % contra 88 % de `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, con la mitad del costo: ~31 neuronas por pregunta, unas 320 preguntas diarias en el plan Free). El 21 de noviembre llegó a 25 de 25: la falla de "semana de parciales" era un fragmento con 0,549 frente al umbral de 0,55, y se corrigió escribiendo el calendario con las palabras del estudiante, no bajando el umbral. Para probar otro modelo solo en desarrollo: `MODELO_CHAT=<modelo> npm run dev`. Workers AI no tiene simulador local: `npm run dev` lo llama de verdad y gasta cuota, y las pruebas y el E2E corren sin bindings remotos (`CLOUDFLARE_VITE_FORCE_LOCAL=true` en `playwright.config.ts`). El E2E usa el modelo y la búsqueda simulados (`MODELO_SIMULADO=1`, `api/src/rag/simulado.ts`), que el Worker solo acepta en localhost. Historial en D1 (`asistente_mensajes`), 30 preguntas diarias, retención de 30 días.
- **Pruebas**: Vitest **^4.1** con `@cloudflare/vitest-plugin` (el antiguo `@cloudflare/vitest-pool-workers`, que Cloudflare renombró y marcó como obsoleto en octubre de 2026) y Playwright para E2E. Las pruebas de la API corren en workerd con D1 y KV locales y efímeros (`remoteBindings: false` en `vitest.config.ts`); viven en `api/test/` y se tipan con `tsconfig.test.json`. Las funciones puras del frontend (sin DOM, como el intérprete de respuestas del asistente) se prueban igual, en `web/test/`. El calificador de la evaluación del RAG y la revisión de sus casos están en `eval/`. **Trazabilidad:** el nombre de cada prueba empieza con el nombre **exacto** del escenario que verifica, seguido de dos puntos (`it("Archivo demasiado grande: …")`; si verifica dos, `"Escenario A / Escenario B: …"`), y `npm run trazabilidad` comprueba en el CI que los 130 escenarios de `openspec/specs/` tienen su prueba. No basta con que el nombre contenga el escenario, ni cuentan las pruebas saltadas (`.skip`, `.only`); la regla tiene sus propias pruebas en `scripts/regla-trazabilidad.test.ts` (endurecida el 2026-11-19 por un hallazgo del subagente revisor). Un escenario nuevo necesita su prueba con ese nombre, y esa prueba debe verificar el THEN, no solo llevar el nombre.
- **Fechas**: `YYYY-MM-DD` para fechas de negocio, `YYYY-MM-DDTHH:MM:SSZ` (UTC) para fecha-hora. **Dinero**: enteros en pesos. **Notas**: 0.0 a 5.0 con un decimal. "Tardía" se calcula, no se guarda (D20).
- **Variables del Worker**: `PRODUCTO_NOMBRE` (Senda), `FUNDACION_NOMBRE` (la Fundación se llama **Funafrocol**, pero la demo pública muestra "Fundación (demo)" hasta que autoricen por escrito), `CONTACTO_FUNDACION`, `AVISO_PRIVACIDAD_VERSION` (`2026-11`, igual que el seed), `ALMACEN_ARCHIVOS` (`kv` | `r2`). Ningún nombre queda quemado en el código.
- **Cloudflare**: subdominio `creativebycode` → demo en `senda.creativebycode.workers.dev`. **Sin medio de pago hasta después de la presentación (23 de noviembre)**: todo debe funcionar en el plan Free sin tarjeta. Producción irá en un dominio propio de la Fundación.

## Entorno

- **VS Code y Claude Code se abren en esta carpeta (`proyecto/`, la raíz del repo)**, no en `Proyecto_Final/`. Claude Code solo carga `.mcp.json` y `.claude/settings.json` (hooks) desde la carpeta de la sesión, y así la configuración del agente queda versionada con el código (decisión del 2026-11-16, tarea 1.7).
- **Hooks del proyecto** (`.claude/settings.json`, con los scripts en `.claude/hooks/`, decisión de Aymer del 2026-11-19):
  - **Guardián de reglas** (PreToolUse, en Read, Edit, Write, Grep y Bash): bloquea leer o editar `.dev.vars` y editar una migración que ya está en git. También bloquea las búsquedas recursivas desde Bash (`grep -r`, `findstr /s`, `rg --no-ignore`), que leerían `.dev.vars` y su copia en `dist/senda/`: para buscar en el código, usa la herramienta Grep (respeta `.gitignore`) o `git grep`. `permissions.deny` también niega `.dev.vars`. Es una red contra descuidos, no un sandbox.
  - **Detector de caracteres invisibles** (PostToolUse, en Edit y Write): avisa con línea y columna si un archivo quedó con espacios duros, BOM o tildes sueltas, el problema de los escapes `\u` de los días 3 y 6.
  - Pruebas: `node .claude/hooks/probar-hooks.mjs`. Si un hook bloquea algo legítimo, se corrige el hook con su prueba; nunca se esquiva.
- **Subagente `revisor-spec`** (`.claude/agents/revisor-spec.md`): revisor independiente y de solo lectura. Úsalo al cerrar cada tarea: revisa el diff contra los escenarios de `openspec/specs/` y las reglas que no se negocian, y reporta hallazgos con archivo y línea, sin corregir nada.
- **Node 24** con fnm (`.node-version`). En PowerShell fnm cambia de versión solo al entrar a la carpeta.
- En la herramienta Bash de Claude Code (Git Bash), antepone a cada comando de Node/npm: `eval "$(fnm env --shell bash)" && fnm use --silent-if-unchanged`. Sin eso se usa el Node 20 del sistema, que es demasiado viejo para wrangler, OpenSpec 2 y vitest.
- Finales de línea: `.gitattributes` fija LF y marca los binarios (no quitarlo: protege `placeholder.pdf`).
- Secretos locales en `.dev.vars` (plantilla `.dev.vars.example`). Regla de Wrangler aprendida en la tarea 2.2: **si existe `.dev.vars`, se usa solo ese archivo**; `.env` y `process.env` se leen únicamente cuando no existe (por eso `vitest.config.ts` fija `JWT_SECRET` con `miniflare.bindings`). Los nombres requeridos se declaran en `secrets.required` de `wrangler.jsonc`: así `wrangler types` no depende de `.dev.vars` y `wrangler deploy` falla si falta un secreto en Cloudflare. Cargar o cambiar un secreto remoto lo hace Aymer (comando en `docs/operacion/despliegue.md`).

## Diseño de la interfaz

La interfaz debe verse profesional y con identidad propia (criterio 6), no como una plantilla. Herramientas (ver `design.md` D12):

| Herramienta | Alcance | Estado |
|---|---|---|
| Plugin `frontend-design` (oficial de Anthropic) | Usuario (global) | Instalado; se verifica en la tarea 1.0 |
| MCP de Playwright | Usuario (global) | Instalado; se verifica en la tarea 1.0 |
| MCP de shadcn/ui | Proyecto (`.mcp.json`) | Configurado y verificado en la tarea 1.7: `npx shadcn mcp` usa la versión del `package-lock.json`, no `@latest` |

Después de instalar algo, Claude Code no ve las herramientas nuevas hasta reiniciar la sesión: pide a Aymer que la reinicie y verifica con `/plugin` y `/mcp`.

Reglas de diseño:

- La guía visual vive en `docs/identidad-visual.md` (se crea en la tarea 2.0) y todas las pantallas la siguen.
- Usa componentes de shadcn/ui antes de crear uno propio. Para buscarlos y ver ejemplos, usa el MCP de shadcn. Para instalarlos, usa `npx shadcn add <componente>`, con la versión del proyecto, aunque el MCP sugiera `shadcn@latest`.
- Al buscar o listar con el MCP de shadcn, pasa siempre `registries: ["@shadcn"]`. Sin ese parámetro responde "No registries are configured", aunque `get_project_registries` sí encuentra el registro (comprobado en la tarea 1.7).
- No vuelvas a ejecutar `shadcn mcp init`: además de escribir `.mcp.json`, mueve `shadcn` a `devDependencies` (en la tarea 1.7 se revirtió; va en `dependencies` por el CSS).
- Ninguna pantalla se da por terminada sin revisar sus capturas en 375 px y 1280 px. Con el MCP de Playwright, emula `reducedMotion: 'reduce'` (el navegador en segundo plano pausa las animaciones) y abre `http://[::1]:5173`, no `localhost:5173`: Chrome recuerda el zoom por sitio y `localhost` quedó al 80 % (con eso, 375 px de pantalla miden 469 px de CSS). Confírmalo con `window.devicePixelRatio === 1`.
- Contraste accesible (WCAG AA) y textos en español claro, pensados para estudiantes que entran desde el celular.

## Datos

- `migrations/0001_inicial.sql` – esquema del MVP (vista `v_saldo_cuotas`, tabla `intentos_fallidos` y 5 triggers). **Aplicada en local y en remoto el 2026-11-14 (tarea 1.3): está congelada**: cualquier cambio de esquema va en una migración nueva.
- `db/seed/generar-seed.mjs` – genera datos **ficticios** deterministas: 5 carreras, 15 cursos, 5 docentes, 60 estudiantes, actividades, entregas, cuotas y pagos, con perfiles de cartera para la demo y una cuenta de primer ingreso. Fecha de referencia por defecto: 2026-11-23 (día de la presentación). Se usa la misma todos los días hasta la presentación: los estados de cartera no cambian entre el 6 de noviembre y el 2 de diciembre (las cuotas vencen el día 5 y el acuerdo de pago de la demo vence el 2 de diciembre) y el Taller 3 de la demo queda abierto hasta el 26.
- `db/seed/seed.sql` – resultado ya generado (empieza borrando las tablas: sirve para reiniciar la base). `db/seed/CUENTAS-DEMO.md` – cuentas para la demo (contraseña `Demo2026*`).
- `db/seed/placeholder.pdf` – archivo que se sube al almacén de archivos con la llave `seed/placeholder.pdf` para que las entregas del seed se puedan descargar.
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

## Estructura del código

- Un solo `package.json` y un solo proyecto Vite en la raíz (`vite.config.ts`, `index.html`, `components.json`, `wrangler.jsonc`).
- `api/src/` – Worker con Hono; todas las rutas bajo `/api` (`basePath`). `api/worker-configuration.d.ts` lo genera `npm run cf-typegen` (se versiona; regenerarlo al cambiar `wrangler.jsonc`). Usa `--strict-vars=false` para que las variables queden como `string` y no como su valor literal (si no, `env.ALMACEN_ARCHIVOS === "r2"` no compila); el valor se valida en tiempo de ejecución.
- `web/src/` – React; alias `@/` → `web/src/`; componentes de shadcn/ui en `web/src/components/ui/` (style `radix-nova`, base Radix, utilidad `cn` del paquete `cn` de shadcn).
  - `lib/api.ts`: único cliente de la API; convierte `{ codigo, mensaje }` en `ErrorApi` y avisa a la sesión de los 401 y de las compuertas.
  - `sesion/`: `ProveedorSesion` carga la configuración pública y `/auth/yo`; `destino.ts` tiene la única regla de navegación (`destinoDe`). Las puertas de `App.tsx` solo redirigen: la seguridad está en la API.
  - `layout/menus.ts`: el menú de cada rol. Cada sección nueva reemplaza su `SeccionPendiente` en `App.tsx`.
  - Animación de entrada: la constante `ENTRADA` de `lib/movimiento.ts` (250 ms).
- TypeScript con referencias: `tsconfig.app.json` (web), `tsconfig.worker.json` (api, tipos del runtime de Workers, sin DOM), `tsconfig.node.json` (configuración).
- Identificadores del dominio en español, como en los specs (`calcularEstadoMora`, `AlmacenArchivos`); comentarios en español.

## Dependencias (reglas aprendidas en las tareas 1.1 y 1.5)

- **Los tres paquetes de Cloudflare se actualizan juntos**: `wrangler` (versión exacta), `@cloudflare/vite-plugin` y `@cloudflare/vitest-plugin` (versión exacta) deben depender del mismo Wrangler para tener un solo `workerd` y que las pruebas corran en el mismo runtime que `npm run dev`. Hoy: Wrangler 4.160.0, vite-plugin 1.69.1 y vitest-plugin 1.7.0. Verificar con `npm ls wrangler miniflare workerd` que todo sale `deduped`.
- **Antes de instalar un paquete que nombra el kit, revisar `npm view <paquete> deprecated`**: `@cloudflare/vitest-pool-workers` estaba obsoleto y renombrado.
- **TypeScript `~6.0`**: `typescript-eslint` no soporta TypeScript 7 todavía. **Vitest `^4.1`** por la tarea 1.5; vitest-plugin 1.7 ya acepta Vitest 5, pero no se cambia de versión mayor antes de la presentación.
- **npm 11 no ejecuta scripts de instalación sin aprobación** (`allowScripts` en `package.json`). Aprobados: `workerd` y `esbuild`. Ante un paquete nuevo con scripts: revisar quién lo publica y qué hace su script antes de `npm install-scripts approve`.
- **`npm audit`**: 10 alertas moderadas (revisado en la tarea 2.6) con dos orígenes, ninguno en el código que se despliega:
  - `minimatch` dentro de `typescript-eslint`, la herramienta de lint.
  - El CLI de `shadcn` (`ts-morph`). Está en `dependencies` porque el CSS importa `shadcn/tailwind.css`, pero el código vulnerable es el del CLI y no llega al navegador ni al Worker.

  Aceptadas. `npm audit fix --force` las "arreglaría" bajando `shadcn` a 1.0.0 y `typescript-eslint` a 8.36: **nunca** ejecutarlo sin leer qué cambia.

## Comandos

```
npm run dev            # Vite + Worker en workerd en http://localhost:5173 (API y frontend en el mismo puerto); requiere `wrangler login` por Workers AI
npm run build          # tsc -b + build de producción (dist/client y dist/senda)
npm run lint           # ESLint
npm run typecheck      # tsc -b (web, api y configuración)
npm run cf-typegen     # regenera api/worker-configuration.d.ts tras cambiar wrangler.jsonc
npm run deploy         # build + wrangler deploy
npm test               # Vitest: pruebas de la API en workerd (npm run test:watch para modo interactivo)
npm run test:e2e       # Playwright: flujo de la demo y el asistente (con el modelo simulado) contra el build de producción (vite preview, puerto 4173); recarga el seed local antes y lo deja como al final de la demo (después: npm run db:seed). Solo sirve del 6 al 26 de noviembre de 2026 (ver PLAN.md). Si la D1 local no tiene documentos (un clon nuevo), los carga en modo simulado, sin vectores: después, `npm run dev` responderá "no tengo esa información" hasta correr npm run rag:indexar
npm run db:migrate     # aplica las migraciones pendientes en la D1 local
npm run db:seed        # regenera el seed (determinista), lo carga en la D1 local y sube el PDF de ejemplo al KV local
npm run eval:rag       # evaluación del asistente (tarea RAG 4.1): pregunta eval/preguntas.json por la API (con npm run dev arriba y el seed local recién cargado) como la estudiante al día y califica con reglas fijas. Pide su cuenta (o SENDA_ESTUDIANTE_DOCUMENTO y SENDA_ESTUDIANTE_CONTRASENA). Gasta ~800 neuronas y 26 de las 30 preguntas diarias de la estudiante. --casos a,b repite solo esos casos; --recalificar <reporte> vuelve a calificar un reporte guardado sin gastar cuota
npm run trazabilidad   # cruza openspec/specs con los nombres de las pruebas: cada escenario debe tener una prueba con su nombre (falla si no; corre en el CI). --detalle muestra qué prueba cubre cada escenario
npm run rag:indexar    # carga docs/rag en la base de conocimiento por la API (con npm run dev arriba): espacio "local" de Vectorize. Pide la cuenta de administrador (o SENDA_ADMIN_DOCUMENTO y SENDA_ADMIN_CONTRASENA). Gasta unas pocas neuronas
```

Vectorize es el índice real también en desarrollo: `npm run dev` escribe en el espacio `local` (lo fija `vite.config.ts`) y producción en `produccion` (RAG design.md D2). Vectorize aplica los cambios unos minutos después (consistencia eventual); se ve con `npx wrangler vectorize info fundacion-docs`. Antes de evaluar o probar, espera a que `processedUpToDatetime` sea posterior al **final** de la carga, no al inicio: el 21 de noviembre una evaluación arrancó 15 segundos antes de tiempo y falló un caso del reglamento.

Las operaciones remotas **no** tienen script a propósito, porque un `npm run` remoto es demasiado fácil de ejecutar por error. Se escriben explícitas, se muestran antes de ejecutarlas y cada una tiene su costo en el plan Free:

```
npx wrangler d1 migrations apply DB --remote
npx wrangler d1 execute DB --remote --file db/seed/seed.sql      # recarga completa: ~3.500 de las 100.000 filas escritas por día
npx wrangler kv key put seed/placeholder.pdf --path db/seed/placeholder.pdf --binding ARCHIVOS_KV --remote
```

Para detener un servidor de desarrollo lanzado en segundo plano desde Git Bash: buscar el PID con `netstat -ano | grep ":5173 " | grep LISTENING` y terminar el árbol con `taskkill //PID <pid> //T //F`.

## Plan de trabajo (del sábado 14 al lunes 23 de noviembre)

Ver `PLAN.md`. Hoy toca lo que esté marcado como siguiente en ese archivo.
