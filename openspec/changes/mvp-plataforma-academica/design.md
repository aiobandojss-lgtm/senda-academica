# Design

## Context

Proyecto nuevo, sin código previo. Lo construye una sola persona en pocos días y debe correr con costo casi cero en los planes gratuitos de Cloudflare. El mismo producto es el proyecto final del curso, que exige: flujo end-to-end en vivo, datos desde una base real, pruebas en verde, CI/CD y una URL pública (ver `docs/rubrica.md`). Motivación y alcance: ver `proposal.md`. Requisitos: ver `specs/`.

## Goals / Non-Goals

**Goals:**
- Un solo despliegue (un Worker llamado `senda`) que sirve API y frontend.
- Toda la lógica de negocio sensible (permisos, mora, validaciones) en el servidor y cubierta por pruebas; las reglas críticas de dinero y notas, además, protegidas en la base de datos.
- Base de datos versionada con migraciones y recargable con un script de seed.

**Non-Goals:**
- Multi-tenant (una sola fundación por despliegue).
- Alta concurrencia o escalado: se esperan menos de 500 estudiantes.
- Envío de correos: la contraseña temporal la entrega el administrador (la recuperación por correo es una fase posterior).
- Periodos académicos: el MVP opera un periodo a la vez (fase posterior).

## Decisions

### D1. Un Worker con static assets en lugar de Pages + Worker separados
El Worker expone `/api/*` con Hono y sirve el build de React/Vite como static assets. Un solo `wrangler deploy`, un solo pipeline, sin CORS. Alternativa: Pages para el frontend y un Worker para la API; descartada por duplicar despliegues y configuración. (La propuesta comercial menciona "Pages + Workers"; el resultado para la Fundación es el mismo.)

### D2. Hono para la API
Liviano, nativo de Workers, con middlewares de JWT y validación (zod). Alternativa: itty-router; Hono tiene mejor ecosistema y tipado.

### D3. React + Vite + Tailwind + shadcn/ui para el frontend
Rápido de construir y de desplegar como estático. Los componentes de interfaz (formularios, tablas, diálogos, menús) salen de **shadcn/ui**: son accesibles, responsivos y quedan como código propio dentro de `web/src/components/ui/`, así que se adaptan a la identidad del producto sin depender de una librería cerrada. Alternativa: componentes hechos desde cero, descartados por tiempo y por calidad de accesibilidad.

### D4. Sesión con JWT firmado en cookie HttpOnly, revocable
JWT HS256 firmado con el secreto `JWT_SECRET`, en cookie `HttpOnly; Secure; SameSite=Lax`, expiración 8 horas desde el ingreso. Contiene `sub` (id de usuario), `rol`, `ver` (versión de sesión) y `exp`. En cada petición protegida el middleware lee al usuario por su llave primaria y verifica: que esté activo, que `ver` coincida con `usuarios.sesion_version`, y las compuertas de primer ingreso (D16). Restablecer la contraseña, desactivar al usuario o que él cambie su contraseña incrementa `sesion_version`, lo que invalida las sesiones abiertas; al cambiar su propia contraseña se le emite un token nuevo para que su sesión actual siga abierta. Alternativa: JWT puro sin consulta a la base; descartada porque un token robado o de un usuario desactivado seguiría valiendo hasta 8 horas. El costo es una lectura indexada a D1 por petición, que de todas formas se hace para estudiantes por la mora (D6).

### D5. Contraseñas con PBKDF2-SHA256 (Web Crypto)
Formato guardado: `pbkdf2_sha256$100000$<sal_base64>$<hash_base64>` (sal de 16 bytes, hash de 32 bytes). 100.000 iteraciones es el máximo que acepta Web Crypto en Workers. bcrypt/argon2 no están disponibles de forma nativa en Workers. El script de seed genera hashes con el mismo formato. Como el número de iteraciones viaja dentro del hash, se puede cambiar en el futuro y migrar cada usuario en su siguiente ingreso.

### D6. Mora calculada al vuelo, no guardada
El estado (`al_dia` / `en_riesgo` / `bloqueado` / `con_excepcion`) se calcula con una consulta sobre `cuotas`, `pagos` (no anulados) y `excepciones_mora`, usando la fecha actual en America/Bogota. Se encapsula en una función pura `calcularEstadoMora(cuotas, excepciones, hoy)` probada con unit tests, y un middleware la aplica en el login y en cada petición de un estudiante; solo `bloqueado` impide el acceso. Alternativa: un campo `bloqueado` actualizado por un cron; descartada porque puede quedar desactualizado y el desbloqueo no sería inmediato.

### D7. Archivos detrás de `AlmacenArchivos`, con acceso solo por la API
Las entregas y soportes se guardan con llave `entregas/<actividad_id>/<estudiante_id>/<uuid>.<ext>` (o `soportes/...`). Nunca se exponen URLs públicas: la descarga pasa por `/api/archivos/...`, que valida permisos. La subida se hace por la API (multipart) validando tipo y tamaño (10 MB). El código usa la interfaz `AlmacenArchivos` (`guardar`, `obtener`, `eliminar`) con dos implementaciones elegidas por la variable `ALMACEN_ARCHIVOS`: **Workers KV** (`ARCHIVOS_KV`) mientras la cuenta no tenga medio de pago, y **R2** (`ARCHIVOS_R2`) en producción (R2 exige una suscripción con medio de pago aunque su plan gratuito no cobre; ver `docs/decisiones/ADR-002`). Al reemplazar una entrega, primero se guarda el archivo nuevo y se actualiza la fila; después se borra el objeto anterior (si el borrado falla, queda un objeto huérfano, nunca una entrega sin archivo). Cada subida usa una llave nueva, nunca se sobrescribe. Alternativa: URLs prefirmadas de R2; más complejas, no necesarias para este volumen y no disponibles en KV.

### D8. Carga masiva en CSV
CSV UTF-8 con separador coma o punto y coma (Excel en español usa `;`). Columnas de la plantilla: `tipo_documento, documento, nombres, apellidos, correo, celular, codigo_carrera, semestre, cohorte, fecha_ingreso`. Se valida todo el archivo y se inserta en un `batch` de D1 (todo o nada). Alternativa: leer `.xlsx`; agrega una dependencia pesada sin aportar al MVP.

### D9. Fechas y dinero
Fechas de negocio como texto ISO `YYYY-MM-DD`; fechas-hora en UTC ISO 8601 con formato fijo `YYYY-MM-DDTHH:MM:SSZ` (así se pueden comparar como texto). Valores en pesos colombianos como enteros (sin decimales). Notas como número con un decimal.

### D10. Datos ficticios por seed
`db/seed/generar-seed.mjs` crea datos realistas y deterministas a partir de una fecha de referencia (por defecto el día de la presentación), con perfiles de cartera predefinidos para la demo y una cuenta de primer ingreso. Para pasar a producción se borra la base y se cargan los datos reales con el mismo esquema.

### D11. Pruebas
- Unitarias e integración de la API con Vitest `^4.1` y `@cloudflare/vitest-plugin` (D1, KV y R2 locales emulados por Miniflare, sin acceso a los recursos remotos: `remoteBindings: false`). El kit nombraba `@cloudflare/vitest-pool-workers`, que Cloudflare renombró a `@cloudflare/vitest-plugin` y dejó sin actualizaciones en octubre de 2026.
- E2E con Playwright contra el servidor local.
- CI: GitHub Actions corre lint, typecheck, unitarias y E2E; si pasan y la rama es `main`, aplica las migraciones remotas y despliega con Wrangler.

### D12. Herramientas de diseño para Claude Code
Para que la interfaz tenga identidad propia y no un aspecto de plantilla (criterio 6 de la rúbrica), Claude Code trabaja con tres herramientas:
- **Plugin `frontend-design`** (oficial de Anthropic, alcance de usuario): guía las decisiones de tipografía, jerarquía, espaciado y color al escribir interfaz.
- **MCP de shadcn/ui** (alcance de proyecto): permite buscar e instalar componentes de shadcn/ui en `web/` en lugar de inventarlos.
- **MCP de Playwright** (alcance de usuario): permite abrir la aplicación, tomar capturas en 375 px y 1280 px y corregir lo que se vea mal antes de dar una pantalla por terminada.

La guía visual (paleta, tipografías, tono, uso del logo) se escribe una vez en `docs/identidad-visual.md` y todas las pantallas la siguen. Alternativa: diseñar primero en Figma; descartada por el plazo y porque la Fundación aún no tiene identidad gráfica definida.

### D13. Reglas críticas también en la base de datos (triggers)
Además de validarse en la API, estas reglas se protegen con triggers de SQLite que abortan con un código conocido (`RAISE(ABORT, 'CODIGO')`), que la API traduce a un mensaje en español:
- `PAGO_SUPERA_SALDO`: un pago activo no puede superar el saldo de la cuota.
- `PAGO_INMUTABLE`: un pago solo puede cambiar de activo a anulado (con motivo); nunca editarse ni reactivarse.
- `CUOTA_CON_PAGOS`: una cuota con pagos (incluidos anulados) no puede cambiar valor ni fecha ni eliminarse.
- `ENTREGA_CALIFICADA`: una entrega calificada no puede cambiar de archivo.

Es defensa en profundidad: aunque la API tenga un error, la base no acepta datos inválidos (el mismo principio que en Oracle se aplica con triggers y `RAISE_APPLICATION_ERROR`). No se crean triggers de borrado sobre `pagos` ni `entregas` para que el seed pueda reiniciar la base; la API no ofrece esas operaciones. Alternativa: validar solo en la API; descartada porque una sola ruta mal escrita podría dejar saldos negativos.

### D14. Límite de intentos de ingreso en D1
Tabla `intentos_fallidos (documento, creado_en)`. Antes de verificar la contraseña se cuentan los fallos del documento en los últimos 15 minutos; con 5 o más se responde "Demasiados intentos" sin calcular el hash (esto también ahorra CPU). Un fallo inserta una fila; un ingreso exitoso borra las filas del documento; las filas de más de un día se borran de forma oportunista. Se cuenta por documento y no por IP porque los estudiantes pueden compartir red (salas de la Fundación). Trade-off conocido: un tercero podría bloquear temporalmente la cuenta de alguien escribiendo mal su documento a propósito; con 15 minutos el impacto es bajo. Alternativa: el binding de Rate Limiting de Cloudflare; descartado porque cuenta por ubicación de forma aproximada y es más difícil de probar en local.

### D15. Inscripciones automáticas
Las inscripciones se guardan en la tabla `inscripciones` (no se calculan) para conservar el historial al cambiar de semestre. Se agregan, nunca se borran automáticamente: al registrar un estudiante (cursos activos de su carrera y semestre), al cambiar su semestre (cursos del nuevo semestre) y al crear un curso (estudiantes activos de esa carrera y semestre), usando `INSERT OR IGNORE`. Alternativa: derivar los cursos del estudiante de su semestre actual; descartada porque al avanzar de semestre perdería acceso a sus notas anteriores.

### D16. Compuertas de primer ingreso: contraseña temporal y aviso de privacidad
`usuarios.debe_cambiar_password` y `usuarios.aviso_version_aceptada` frente a la variable `AVISO_PRIVACIDAD_VERSION`. Mientras falte cualquiera de las dos, el middleware solo permite `GET /api/auth/yo`, el cambio de contraseña, la aceptación del aviso y el cierre de sesión; cualquier otra ruta responde 403 con el código `DEBE_CAMBIAR_PASSWORD` o `DEBE_ACEPTAR_AVISO`, y el frontend muestra la pantalla correspondiente. Publicar una nueva versión del aviso es cambiar la variable. El texto del aviso vive en el frontend y lo aporta la Fundación (responsable del tratamiento); mientras tanto se usa un borrador marcado como tal.

### D17. Contraseñas temporales que se muestran una sola vez
Al crear un usuario o restablecer su contraseña se genera una contraseña aleatoria de 10 caracteres con `crypto.getRandomValues`, sin caracteres ambiguos (0/O, 1/l/I). La API la devuelve solo en esa respuesta y guarda únicamente su hash. En la carga masiva, la respuesta trae la lista documento–contraseña y el frontend arma el CSV de credenciales en el navegador; el servidor no lo guarda.

### D18. Minimización de datos por rol
Cada ruta devuelve solo los campos que su rol necesita (proyecciones explícitas, nunca `SELECT *` hacia el cliente). El docente recibe de sus estudiantes nombres, apellidos y datos académicos; nunca documento, correo ni celular. Se prueba con pruebas de integración que inspeccionan la respuesta.

### D19. Nombre del producto e institución configurables
Variables en `wrangler.jsonc`: `PRODUCTO_NOMBRE` ("Senda"), `FUNDACION_NOMBRE` ("Fundación (demo)" hasta que la Fundación autorice mostrar su nombre), `CONTACTO_FUNDACION`, `AVISO_PRIVACIDAD_VERSION` y `ALMACEN_ARCHIVOS` (D7). El frontend lee las públicas de `GET /api/config/publica`; ningún nombre queda quemado en el código.

### D20. Marca de entrega tardía calculada al vuelo
"Tardía" se calcula en la consulta (`entregado_en > fecha_limite`) en lugar de guardarse, para que una ampliación del plazo se refleje sola; es el mismo criterio que la mora (D6).

## Risks / Trade-offs

- [El plazo es muy corto] → El orden de tareas prioriza el flujo de la demo (login → entrega → calificación → bloqueo) y deja pantallas secundarias para el final.
- [Límite de CPU de 10 ms por petición en el plan Free de Workers] → La verificación PBKDF2 de 100.000 iteraciones puede superarlo (error 1102). Medido en la tarea 1.8 (ADR-003): 100.000 iteraciones consumen unos 20 ms y funcionan por la tolerancia a excesos ocasionales. Se mantienen en la demo, que tiene pocos ingresos, y se pasa a Workers Paid después de la presentación. Plan B si aparece un error 1102 en los ensayos: bajar a 10.000 y regenerar el seed.
- [Límite de 100.000 iteraciones de PBKDF2 en Web Crypto] → Por debajo de la recomendación actual de OWASP para PBKDF2-SHA256; aceptable para este caso con el límite de intentos (D14) y documentado.
- [Sin medio de pago antes de la presentación (20 de noviembre)] → Todo debe funcionar en el plan Free sin tarjeta: archivos en KV (D7, ADR-002) y PBKDF2 con 100.000 iteraciones apoyado en la tolerancia a excesos ocasionales (ADR-003).
- [Límites de KV gratis: 1 GB, 1.000 escrituras al día, 25 MiB por archivo] → Suficiente para la demo; producción usa R2.
- [Triggers dentro de migraciones de D1] → Verificar en la tarea 1.3 que `wrangler d1 migrations apply` procesa bien los bloques `BEGIN … END`, en local y en remoto.
- [El reloj del servidor define la mora] → Toda comparación de fechas pasa por una función con la zona America/Bogota y se prueba con fechas fijas inyectadas.
- [Datos ficticios con documentos o celulares que podrían ser reales] → Los documentos ficticios usan el prefijo 99 y los celulares quedan vacíos; nunca se envían mensajes a números del seed.
- [Datos personales] → No se registran contraseñas ni documentos en logs; los archivos solo se descargan con permiso; el docente no recibe datos de contacto (D18).

## Migration Plan

1. Crear la base D1 y el namespace KV de archivos; aplicar `migrations/0001_inicial.sql`.
2. Cargar el seed ficticio y subir `db/seed/placeholder.pdf` al almacén de archivos con la llave `seed/placeholder.pdf`.
3. Al pasar a producción: activar R2 y migrar los archivos (ADR-002), crear una base nueva, aplicar migraciones y cargar los datos reales de la Fundación.

## Open Questions

- Texto y canal de contacto exactos del mensaje de bloqueo (configurable con la variable `CONTACTO_FUNDACION`).
- Nombre y logo definitivos de la Fundación (variable `FUNDACION_NOMBRE`).
- Texto definitivo del aviso de privacidad (lo aporta la Fundación como responsable del tratamiento). Debe informar la transferencia internacional de datos (Ley 1581): D1 está en el este de Norteamérica (`enam`, EE. UU., país que la SIC reconoce con nivel adecuado de protección) y KV distribuye copias de los archivos en la red global de Cloudflare.
- Periodos académicos y recuperación de contraseña por correo: cambios posteriores al MVP.
