# ADR-001: Hosting en Cloudflare en lugar de Supabase + Vercel

- **Estado:** aceptada
- **Fecha:** 2026-11-14
- **Decide:** Aymer Ivan (CREATIVE BY CODE)

## Contexto

En el curso se trabajó con Supabase (Postgres, Auth, RLS, Edge Functions) y se mencionó Vercel para el despliegue. Para Senda había que decidir si seguir ese camino o usar Cloudflare, que es lo que la propuesta comercial ya le había prometido a la Fundación.

Hechos que pesaron:

- La rúbrica (criterio 5) pide "pipeline CI/CD activo y una versión desplegada accesible" y aclara que "se evalúa el principio, no la forma exacta". No exige un proveedor.
- La Fundación no tiene presupuesto: el producto debe correr en planes gratuitos.
- El autor ya tiene muchas cuentas de Supabase y Vercel ocupadas en otros proyectos; el plan gratuito de Supabase permite 2 proyectos activos por cuenta.
- El producto va a producción real, no solo a la demo.

## Decisión

Cloudflare para todo: Workers (API con Hono y frontend como static assets), D1 (base de datos), R2 (archivos), Workers AI y Vectorize (asistente RAG). CI/CD con GitHub Actions y Wrangler.

## Alternativas consideradas

| Criterio | Cloudflare (elegida) | Supabase + Vercel |
|---|---|---|
| Cuentas | Una sola, un solo proveedor | Dos proveedores; límite de proyectos gratuitos ya alcanzado |
| Producción real | No se pausa por inactividad | El proyecto gratuito de Supabase se pausa tras 7 días sin uso |
| Plan gratuito | Workers 100.000 peticiones/día; D1 5 GB y 5 millones de filas leídas/día; R2 10 GB sin costo de salida; Workers AI 10.000 neuronas/día | Generoso, pero repartido en dos servicios |
| Autenticación | Se construye (JWT + PBKDF2) | Supabase Auth listo |
| Autorización | SQLite sin RLS: permisos en el middleware de la API + triggers para reglas críticas | Postgres con RLS |
| IA | Modelos abiertos de Workers AI, sin llaves externas ni costo | Proveedor externo con costo mensual |
| Curva de aprendizaje | Wrangler y D1 son nuevos para el autor | Conocido del curso |

## Consecuencias

**Positivas**
- Costo cero para la Fundación mientras el uso quepa en el plan gratuito; un solo despliegue (`wrangler deploy`) y un solo pipeline.
- La autenticación y los permisos quedan en código propio y probado, lo que obliga a entenderlos (criterio 6).
- Reglas de negocio protegidas en dos capas: API y triggers de la base (D13 del MVP).

**Negativas y cómo se mitigan**
- **CPU de 10 ms por petición en el plan Free:** la verificación PBKDF2 de 100.000 iteraciones puede superarla. Se mide en la tarea 1.8; si falla, plan Workers Paid (USD 5/mes) o menos iteraciones. Se registrará en un ADR propio.
- **Sin RLS:** cada ruta debe aplicar permisos y proyecciones por rol; se cubre con pruebas de integración por rol.
- **Modelos de IA menos precisos en español:** guardas contra alucinación, conjunto de evaluación con meta ≥ 90 % y una interfaz `ModeloLenguaje` que permite cambiar de proveedor.
- **Cuota diaria de Workers AI:** límite de 30 preguntas por estudiante y evaluación fuera del CI.
