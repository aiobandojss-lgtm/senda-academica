# Design

## Context

Proyecto nuevo, sin código previo. Lo construye una sola persona en pocos días y debe correr con costo casi cero en los planes gratuitos de Cloudflare. El mismo producto es el proyecto final del curso, que exige: flujo end-to-end en vivo, datos desde una base real, pruebas en verde, CI/CD y una URL pública (ver `docs/rubrica.md`). Motivación y alcance: ver `proposal.md`. Requisitos: ver `specs/`.

## Goals / Non-Goals

**Goals:**
- Un solo despliegue (un Worker) que sirve API y frontend.
- Toda la lógica de negocio sensible (permisos, mora, validaciones) en el servidor y cubierta por pruebas.
- Base de datos versionada con migraciones y recargable con un script de seed.

**Non-Goals:**
- Multi-tenant (una sola fundación por despliegue).
- Alta concurrencia o escalado: se esperan menos de 500 estudiantes.
- Envío de correos: la contraseña temporal la entrega el administrador.

## Decisions

### D1. Un Worker con static assets en lugar de Pages + Worker separados
El Worker expone `/api/*` con Hono y sirve el build de React/Vite como static assets. Un solo `wrangler deploy`, un solo pipeline, sin CORS. Alternativa: Pages para el frontend y un Worker para la API; descartada por duplicar despliegues y configuración. (La propuesta comercial menciona "Pages + Workers"; el resultado para la Fundación es el mismo.)

### D2. Hono para la API
Liviano, nativo de Workers, con middlewares de JWT y validación (zod). Alternativa: itty-router; Hono tiene mejor ecosistema y tipado.

### D3. React + Vite + Tailwind + shadcn/ui para el frontend
Rápido de construir y de desplegar como estático. Los componentes de interfaz (formularios, tablas, diálogos, menús) salen de **shadcn/ui**: son accesibles, responsivos y quedan como código propio dentro de `web/src/components/ui/`, así que se adaptan a la identidad de la Fundación sin depender de una librería cerrada. Alternativas: Angular (stack conocido del autor), descartada para este plazo por el peso del build y la configuración; componentes hechos desde cero, descartados por tiempo y por calidad de accesibilidad. Si el autor prefiere Angular, solo cambia la carpeta `web/`; la API no cambia.

### D4. Sesión con JWT firmado en cookie HttpOnly
JWT HS256 firmado con el secreto `JWT_SECRET`, en cookie `HttpOnly; Secure; SameSite=Lax`, expiración 8 horas. Contiene `sub` (id de usuario), `rol` y `exp`. Sin tabla de sesiones: el cierre de sesión borra la cookie. Alternativa: sesiones en KV o D1; innecesario para este volumen.

### D5. Contraseñas con PBKDF2-SHA256 (Web Crypto)
Formato guardado: `pbkdf2_sha256$100000$<sal_base64>$<hash_base64>` (sal de 16 bytes, hash de 32 bytes). 100.000 iteraciones es el máximo que acepta Web Crypto en Workers. bcrypt/argon2 no están disponibles de forma nativa en Workers. El script de seed genera hashes con el mismo formato.

### D6. Mora calculada al vuelo, no guardada
El estado (al día / en riesgo / bloqueado) se calcula con una consulta sobre `cuotas`, `pagos` (no anulados) y `excepciones_mora`, usando la fecha actual en America/Bogota. Se encapsula en una función pura `calcularEstadoMora(cuotas, excepciones, hoy)` probada con unit tests, y un middleware la aplica en el login y en cada petición de un estudiante. Alternativa: un campo `bloqueado` actualizado por un cron; descartada porque puede quedar desactualizado y el desbloqueo no sería inmediato.

### D7. Archivos en R2 con acceso por la API
Las entregas se guardan en R2 con llave `entregas/<actividad_id>/<estudiante_id>/<uuid>.<ext>`. Nunca se exponen URLs públicas: la descarga pasa por `/api/archivos/...`, que valida permisos. La subida se hace por la API (multipart) validando tipo y tamaño (10 MB). Alternativa: URLs prefirmadas; más complejas y no necesarias para este volumen.

### D8. Carga masiva en CSV
CSV UTF-8 con separador coma o punto y coma (Excel en español usa `;`). Se valida todo el archivo y se inserta en un `batch` de D1 (todo o nada). Alternativa: leer `.xlsx`; agrega una dependencia pesada sin aportar al MVP.

### D9. Fechas y dinero
Fechas de negocio como texto ISO `YYYY-MM-DD`; fechas-hora en UTC ISO 8601. Valores en pesos colombianos como enteros (sin decimales). Notas como número con un decimal.

### D10. Datos ficticios por seed
`db/seed/generar-seed.mjs` crea datos realistas y deterministas a partir de una fecha de referencia (por defecto el día de la presentación), con perfiles de cartera predefinidos para la demo. Para pasar a producción se borra la base y se cargan los datos reales con el mismo esquema.

### D11. Pruebas
- Unitarias e integración de la API con Vitest y `@cloudflare/vitest-pool-workers` (D1 y R2 locales).
- E2E con Playwright contra `wrangler dev`.
- CI: GitHub Actions corre lint, unitarias y E2E; si pasan y la rama es `main`, despliega con Wrangler.

### D12. Herramientas de diseño para Claude Code
Para que la interfaz tenga identidad propia y no un aspecto de plantilla (criterio 6 de la rúbrica), Claude Code trabaja con tres herramientas:
- **Plugin `frontend-design`** (oficial de Anthropic, alcance de usuario): guía las decisiones de tipografía, jerarquía, espaciado y color al escribir interfaz.
- **MCP de shadcn/ui** (alcance de proyecto): permite buscar e instalar componentes de shadcn/ui en `web/` en lugar de inventarlos.
- **MCP de Playwright** (alcance de usuario): permite abrir la aplicación, tomar capturas en 375 px y 1280 px y corregir lo que se vea mal antes de dar una pantalla por terminada.

La guía visual (paleta, tipografías, tono, uso del logo) se escribe una vez en `docs/identidad-visual.md` y todas las pantallas la siguen. Alternativa: diseñar primero en Figma; descartada por el plazo y porque la Fundación aún no tiene identidad gráfica definida.

## Risks / Trade-offs

- [El plazo es muy corto] → El orden de tareas prioriza el flujo de la demo (login → entrega → calificación → bloqueo) y deja pantallas secundarias para el final.
- [Límite de 100.000 iteraciones de PBKDF2] → Suficiente para este caso; se documenta.
- [El reloj del servidor define la mora] → Toda comparación de fechas pasa por una función con la zona America/Bogota y se prueba con fechas fijas inyectadas.
- [Datos ficticios con documentos o celulares que podrían ser reales] → Los documentos ficticios usan el prefijo 99 y los celulares quedan vacíos; nunca se envían mensajes a números del seed.
- [Datos personales] → No se registran contraseñas ni documentos en logs; los archivos solo se descargan con permiso.

## Migration Plan

1. Crear la base D1 y el bucket R2; aplicar `migrations/0001_inicial.sql`.
2. Cargar el seed ficticio y subir `db/seed/placeholder.pdf` a R2.
3. Al pasar a producción: crear una base nueva, aplicar migraciones y cargar los datos reales de la Fundación.

## Open Questions

- Texto y canal de contacto exactos del mensaje de bloqueo (se deja configurable con la variable `CONTACTO_FUNDACION`).
- Nombre y logo definitivos de la Fundación (variable `FUNDACION_NOMBRE`).
