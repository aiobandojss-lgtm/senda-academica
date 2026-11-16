# Tasks

## 1. Base del proyecto y despliegue (día 1)

- [x] 1.0 Verificar las herramientas de diseño de Claude Code (design.md D12): el plugin `frontend-design` y el MCP de Playwright ya están instalados a nivel de usuario; si faltara alguno, instalarlo con `claude plugin install frontend-design@claude-plugins-official --scope user` o `claude mcp add --scope user playwright -- cmd /c npx @playwright/mcp@latest`; verificar con `/plugin` y `/mcp` que ambos aparecen activos
- [x] 1.1 Crear el proyecto con `api/` (Worker + Hono) y `web/` (React + Vite + Tailwind + shadcn/ui inicializado con `npx shadcn@latest init`) y un `package.json` raíz con scripts `dev`, `build`, `lint`, `typecheck`, `deploy` (`test` y `test:e2e` se agregan en las tareas 1.5 y 6.1, cuando exista lo que prueban); consultar antes la plantilla vigente de Cloudflare (Vite + `@cloudflare/vite-plugin`) y explicar la elección; verificar que `npm run dev` muestra la página inicial y `GET /api/salud` responde `{"ok":true}`
- [x] 1.2 Configurar `wrangler.jsonc` con `name: "senda"`, D1 (`DB`), KV de archivos (`ARCHIVOS_KV`, D7; R2 se agrega después de la presentación según ADR-002), static assets y variables `PRODUCTO_NOMBRE`, `FUNDACION_NOMBRE`, `CONTACTO_FUNDACION`, `AVISO_PRIVACIDAD_VERSION`, `ALMACEN_ARCHIVOS` (D19); verificar con `npm run dev` sin errores
- [x] 1.3 Crear la base D1 remota y el namespace KV de archivos, y aplicar `migrations/0001_inicial.sql` local y remoto; verificar con `wrangler d1 execute DB --command "SELECT count(*) FROM carreras"` y con `SELECT name FROM sqlite_master WHERE type='trigger'` que los triggers de D13 existen en ambos entornos
- [x] 1.4 Cargar `db/seed/seed.sql` (local y remoto) y subir `db/seed/placeholder.pdf` al almacén de archivos con la llave `seed/placeholder.pdf`; verificar que `SELECT count(*) FROM estudiantes` devuelve 60 y que la llave existe en el namespace
- [x] 1.5 Configurar Vitest (`^4.1`) con `@cloudflare/vitest-plugin` (el antiguo `@cloudflare/vitest-pool-workers`, renombrado y obsoleto) y una prueba de `/api/salud`; verificar `npm test` en verde
- [x] 1.6 Crear el workflow de GitHub Actions (instalar, lint, typecheck, probar, build, y en `main` aplicar migraciones remotas y `wrangler deploy`) con los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`; verificar que un push a `main` deja el pipeline en verde y la URL pública responde
- [x] 1.7 Configurar el MCP de shadcn/ui a nivel de proyecto (`npx shadcn@latest mcp init --client claude`) de forma que encuentre el `components.json` de la raíz (sus alias apuntan a `web/src`); reiniciar la sesión y verificar con `/mcp` que está conectado y que puede listar componentes
- [x] 1.8 Medir el costo de CPU de la verificación PBKDF2 de 100.000 iteraciones en el Worker desplegado (endpoint temporal protegido, que se elimina después); verificar en el dashboard de Cloudflare (CPU time y errores 1102) y registrar la decisión (plan Free o Paid, iteraciones) en `docs/decisiones/`

## 2. Autenticación y roles (día 2)

- [x] 2.0 Escribir `docs/identidad-visual.md` para Senda (paleta con contraste accesible, tipografías, tono, logotipo provisional) usando el plugin `frontend-design`, y aplicarla al tema de Tailwind/shadcn; verificar con capturas de Playwright de una pantalla de ejemplo en 375 px y 1280 px y la aprobación de Aymer
- [x] 2.1 Implementar hash y verificación PBKDF2 con el formato de `design.md` (D5) y la generación de contraseñas temporales (D17); verificar con unit tests que una contraseña del seed (`Demo2026*`) valida y otra no, y que las temporales tienen 10 caracteres sin ambiguos
- [x] 2.2 Implementar `POST /api/auth/ingresar`, `POST /api/auth/salir` y `GET /api/auth/yo` con JWT en cookie HttpOnly que incluye la versión de sesión (D4); verificar con pruebas de integración los escenarios de credenciales correctas, incorrectas, documento inexistente e inactivo
- [x] 2.3 Implementar el límite de intentos de ingreso (D14) con la tabla `intentos_fallidos`; verificar con pruebas los tres escenarios de la spec `autenticacion` (sexto intento bloqueado aunque la contraseña sea correcta, documento inexistente con el mismo mensaje, ingreso exitoso reinicia el conteo)
- [x] 2.4 Implementar el middleware de autenticación y permisos por rol, con verificación de usuario activo, de `sesion_version` y de las compuertas de primer ingreso (D4, D16); verificar con pruebas que un estudiante no accede a rutas de administrador, que sin sesión se responde 401, que un token con versión vieja responde 401 y que con contraseña temporal solo se permiten las rutas de D16
- [x] 2.5 Implementar el cambio de contraseña (obligatorio y voluntario, siempre con la contraseña actual; la nueva con mínimo 8 caracteres, distinta del documento y de la actual), el restablecimiento por el administrador (contraseña temporal mostrada una vez, incrementa `sesion_version` y borra los intentos fallidos) y la aceptación del aviso de privacidad (`POST /api/auth/aviso`); verificar con pruebas los escenarios de la spec `autenticacion`
- [ ] 2.6 Implementar `GET /api/config/publica` (D19: sin sesión, devuelve solo `PRODUCTO_NOMBRE`, `FUNDACION_NOMBRE`, `CONTACTO_FUNDACION` y `AVISO_PRIVACIDAD_VERSION`) y construir en `web/` la pantalla de ingreso, el cambio de contraseña, la aceptación del aviso de privacidad (borrador marcado como tal) y el layout por rol (menú de administrador, docente y estudiante), tomando los nombres de ese endpoint; verificar con una prueba que el endpoint responde sin sesión y no expone `ALMACEN_ARCHIVOS` ni secretos, y a mano en el celular (vista responsiva) y en escritorio, incluida la cuenta de primer ingreso del seed

## 3. Carreras, cursos y estudiantes (día 2)

- [ ] 3.1 Implementar la API de carreras, cursos y docentes (crear, editar, desactivar, asignar docente) con inscripción automática de los estudiantes activos al crear un curso (D15); verificar con pruebas los escenarios de código repetido, desactivación y curso creado después de registrar a los estudiantes
- [ ] 3.2 Implementar la API de estudiantes (registrar, editar, cambiar semestre, listar con búsqueda y filtros por carrera y estado de cartera, desactivar y reactivar con invalidación de sesiones) con inscripción automática (D15) y proyecciones por rol (D18); verificar con pruebas el documento duplicado, la inscripción al registrar y al cambiar de semestre, la desactivación y que el docente no recibe documento ni correo
- [ ] 3.3 Implementar la carga masiva por CSV (separador `,` o `;`, todo o nada) con la plantilla descargable y la respuesta de credenciales iniciales (D8, D17); verificar con pruebas un archivo válido, uno con errores por fila y que la base no guarda contraseñas en texto plano
- [ ] 3.4 Construir las pantallas de administración de carreras, cursos, estudiantes y docentes (incluida la descarga del CSV de credenciales y la desactivación); verificar que listan los datos del seed

## 4. Actividades y entregas (día 3)

- [ ] 4.1 Implementar la API de actividades (crear, editar, publicar) restringida al docente del curso; verificar con pruebas que un borrador no es visible para estudiantes
- [ ] 4.2 Implementar la interfaz `AlmacenArchivos` con sus implementaciones KV y R2 (D7) y la subida de entregas con validación de tipo y tamaño, reemplazo antes de la nota con borrado del archivo anterior (D7) y marca de tardía calculada al vuelo (D20); verificar con pruebas los escenarios de la spec `actividades-entregas`, incluido que el trigger `ENTREGA_CALIFICADA` rechaza el cambio de archivo aunque se intente directo en SQL
- [ ] 4.3 Implementar la descarga protegida de archivos y la calificación (0.0 a 5.0, un decimal); verificar con pruebas el acceso denegado a otro estudiante, la nota fuera de rango y que el seguimiento del docente no incluye datos de contacto
- [ ] 4.4 Construir las pantallas del docente (mis cursos, actividades, seguimiento de entregas, calificar) y del estudiante (mis cursos, actividades, subir entrega, ver nota); verificar el flujo completo a mano con usuarios del seed

## 5. Cartera y bloqueo por mora (día 4)

- [ ] 5.1 Implementar la función pura `calcularEstadoMora(cuotas, excepciones, hoy)` con los cuatro estados (D6) y la fecha "hoy" en America/Bogota; verificar con unit tests todos los escenarios de la spec `bloqueo-mora` (31 días, 30 días, pago parcial, excepción vigente y vencida, en riesgo)
- [ ] 5.2 Implementar la API de cuotas (generar plan, cuota individual, editar o eliminar sin pagos) y de pagos (registrar, anular con motivo, validación de saldo), traduciendo los códigos de los triggers de D13 a mensajes en español; verificar con pruebas los escenarios de la spec `cartera` y que los triggers `PAGO_SUPERA_SALDO`, `PAGO_INMUTABLE` y `CUOTA_CON_PAGOS` rechazan los cambios aunque se intenten directo en SQL
- [ ] 5.3 Aplicar el bloqueo en el login y en el middleware de cada petición de estudiante, con el mensaje y el contacto de la Fundación; verificar con pruebas que el estudiante en mora del seed no ingresa y que al registrar su pago sí ingresa
- [ ] 5.4 Implementar excepciones de mora (crear con motivo y fecha final); verificar con pruebas que el estudiante con excepción del seed ingresa y aparece con estado "con excepción"
- [ ] 5.5 Construir el estado de cuenta del estudiante y, para el administrador, el registro de pagos, las excepciones y el resumen de cartera; verificar con los perfiles de cartera del seed

## 6. Integración de la demo (día 6)

- [ ] 6.1 Escribir la prueba E2E con Playwright del flujo de la demo: el estudiante al día ingresa y entrega un taller, el docente lo califica, el estudiante ve la nota, el estudiante en mora no puede ingresar y, tras registrar su pago, sí; verificar `npm run test:e2e` en verde local y en CI
- [ ] 6.2 Revisar todas las pantallas contra `docs/identidad-visual.md` con el MCP de Playwright y corregir diferencias; verificar con capturas en 375 px y 1280 px

## Workflow follow-up

- Archivar el cambio con `/openspec-archive-change` cuando todas las tareas estén marcadas y el pipeline esté en verde.
