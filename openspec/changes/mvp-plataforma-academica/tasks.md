# Tasks

## 1. Base del proyecto y despliegue (día 1)

- [ ] 1.0 Instalar las herramientas de diseño de Claude Code (design.md D12): ejecutar `claude plugin install frontend-design@claude-plugins-official --scope user` y `claude mcp add --scope user playwright -- cmd /c npx @playwright/mcp@latest` (en Windows nativo `npx` va con `cmd /c`); pedir a Aymer que reinicie la sesión de Claude Code y verificar con `/plugin` y `/mcp` que ambos aparecen activos
- [ ] 1.1 Crear el proyecto con `api/` (Worker + Hono) y `web/` (React + Vite + Tailwind + shadcn/ui inicializado con `npx shadcn@latest init`) y un `package.json` raíz con scripts `dev`, `build`, `test`, `test:e2e`, `deploy`; verificar que `npm run dev` muestra la página inicial y `GET /api/salud` responde `{"ok":true}`
- [ ] 1.2 Configurar `wrangler.jsonc` con D1 (`DB`), R2 (`ARCHIVOS`), static assets y variables `FUNDACION_NOMBRE`, `CONTACTO_FUNDACION`; verificar con `npx wrangler dev` sin errores
- [ ] 1.3 Crear la base D1 remota y el bucket R2, y aplicar `migrations/0001_inicial.sql` local y remoto; verificar con `wrangler d1 execute DB --command "SELECT count(*) FROM carreras"`
- [ ] 1.4 Cargar `db/seed/seed.sql` (local y remoto) y subir `db/seed/placeholder.pdf` a R2; verificar que `SELECT count(*) FROM estudiantes` devuelve 60
- [ ] 1.5 Configurar Vitest con `@cloudflare/vitest-pool-workers` y una prueba de `/api/salud`; verificar `npm test` en verde
- [ ] 1.6 Crear el workflow de GitHub Actions (instalar, probar, build, `wrangler deploy` en `main`) con los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`; verificar que un push a `main` deja el pipeline en verde y la URL pública responde
- [ ] 1.7 Configurar el MCP de shadcn/ui a nivel de proyecto (`npx shadcn@latest mcp init --client claude`) de forma que encuentre el `components.json` de `web/`; reiniciar la sesión y verificar con `/mcp` que está conectado y que puede listar componentes

## 2. Autenticación y roles (día 2)

- [ ] 2.0 Escribir `docs/identidad-visual.md` (paleta con contraste accesible, tipografías, tono, uso del logo provisional) usando el plugin `frontend-design`, y aplicarla al tema de Tailwind/shadcn; verificar con capturas de Playwright de una pantalla de ejemplo en 375 px y 1280 px y la aprobación de Aymer
- [ ] 2.1 Implementar hash y verificación PBKDF2 con el formato de `design.md` (D5); verificar con unit tests que una contraseña del seed (`Demo2026*`) valida y otra no
- [ ] 2.2 Implementar `POST /api/auth/ingresar`, `POST /api/auth/salir` y `GET /api/auth/yo` con JWT en cookie HttpOnly (D4); verificar con pruebas de integración los escenarios de credenciales correctas, incorrectas, documento inexistente e inactivo
- [ ] 2.3 Implementar el middleware de autenticación y de permisos por rol; verificar con pruebas que un estudiante no accede a rutas de administrador y que sin sesión se responde 401
- [ ] 2.4 Implementar cambio obligatorio de contraseña y restablecimiento por el administrador; verificar con pruebas los escenarios de la spec `autenticacion`
- [ ] 2.5 Construir en `web/` la pantalla de ingreso, el cambio de contraseña y el layout por rol (menú de administrador, docente y estudiante); verificar a mano en el celular (vista responsiva) y en escritorio

## 3. Carreras, cursos y estudiantes (día 2)

- [ ] 3.1 Implementar la API de carreras, cursos y docentes (crear, editar, desactivar, asignar docente); verificar con pruebas los escenarios de código repetido y desactivación
- [ ] 3.2 Implementar la API de estudiantes (registrar, editar, listar con búsqueda y filtros por carrera y estado de cartera) con inscripción automática en los cursos de su semestre; verificar con pruebas el documento duplicado y la inscripción
- [ ] 3.3 Implementar la carga masiva por CSV (separador `,` o `;`, todo o nada) y la plantilla descargable; verificar con pruebas un archivo válido y uno con errores por fila
- [ ] 3.4 Construir las pantallas de administración de carreras, cursos y estudiantes; verificar que listan los datos del seed

## 4. Actividades y entregas (día 3)

- [ ] 4.1 Implementar la API de actividades (crear, editar, publicar) restringida al docente del curso; verificar con pruebas que un borrador no es visible para estudiantes
- [ ] 4.2 Implementar la subida de entregas a R2 con validación de tipo y tamaño, reemplazo antes de la nota y marca de tardía; verificar con pruebas los escenarios de la spec `actividades-entregas`
- [ ] 4.3 Implementar la descarga protegida de archivos y la calificación (0.0 a 5.0, un decimal); verificar con pruebas el acceso denegado a otro estudiante y la nota fuera de rango
- [ ] 4.4 Construir las pantallas del docente (mis cursos, actividades, seguimiento de entregas, calificar) y del estudiante (mis cursos, actividades, subir entrega, ver nota); verificar el flujo completo a mano con usuarios del seed

## 5. Cartera y bloqueo por mora (día 4)

- [ ] 5.1 Implementar la función pura `calcularEstadoMora(cuotas, excepciones, hoy)` y la fecha "hoy" en America/Bogota; verificar con unit tests todos los escenarios de la spec `bloqueo-mora` (31 días, 30 días, pago parcial, excepción vigente y vencida)
- [ ] 5.2 Implementar la API de cuotas (generar plan, cuota individual, editar sin pagos) y de pagos (registrar, anular con motivo, validación de saldo); verificar con pruebas los escenarios de la spec `cartera`
- [ ] 5.3 Aplicar el bloqueo en el login y en el middleware de cada petición de estudiante, con el mensaje y el contacto de la Fundación; verificar con pruebas que el estudiante en mora del seed no ingresa y que al registrar su pago sí ingresa
- [ ] 5.4 Implementar excepciones de mora (crear con motivo y fecha final); verificar con pruebas que el estudiante con excepción del seed ingresa
- [ ] 5.5 Construir el estado de cuenta del estudiante y, para el administrador, el registro de pagos, las excepciones y el resumen de cartera; verificar con los perfiles de cartera del seed

## 6. Integración de la demo (día 6)

- [ ] 6.1 Escribir la prueba E2E con Playwright del flujo de la demo: el estudiante al día ingresa y entrega un taller, el docente lo califica, el estudiante ve la nota, el estudiante en mora no puede ingresar y, tras registrar su pago, sí; verificar `npm run test:e2e` en verde local y en CI
- [ ] 6.2 Revisar todas las pantallas contra `docs/identidad-visual.md` con el MCP de Playwright y corregir diferencias; verificar con capturas en 375 px y 1280 px

## Workflow follow-up

- Archivar el cambio con `/openspec-archive-change` cuando todas las tareas estén marcadas y el pipeline esté en verde.
