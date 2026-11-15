# Documentación de Senda

| Documento | Qué contiene |
|---|---|
| [rubrica.md](rubrica.md) | Rúbrica del proyecto final del curso |
| [identidad-visual.md](identidad-visual.md) | Guía visual de Senda (se crea en la tarea 2.0 del MVP) |
| [decisiones/](decisiones/) | Registros de decisiones de arquitectura (ADR) |
| [bitacora/](bitacora/) | Diario de desarrollo: qué se hizo cada día, qué se aprendió y qué problemas hubo |
| [operacion/](operacion/) | [Despliegue y credenciales del CI](operacion/despliegue.md); después: paso a producción, respaldos y Habeas Data |
| [presentacion/](presentacion/) | Guion, checklist de la demo y preguntas esperadas (día 7) |
| [rag/](rag/) | Corpus del asistente: documentos ficticios de la Fundación |

Las especificaciones funcionales no viven aquí sino en `openspec/` (fuente de verdad del comportamiento). Las decisiones de cada cambio están en su `design.md`; aquí van las decisiones transversales al proyecto.

## Decisiones (ADR)

| # | Decisión | Estado |
|---|---|---|
| [001](decisiones/ADR-001-hosting-cloudflare.md) | Hosting en Cloudflare en lugar de Supabase + Vercel | Aceptada |
| [002](decisiones/ADR-002-archivos-kv-demo-r2-produccion.md) | Archivos en Workers KV durante la demo y en R2 en producción | Aceptada |
| [003](decisiones/ADR-003-iteraciones-pbkdf2-plan-free.md) | 100.000 iteraciones de PBKDF2 en el plan Free hasta pasar a Paid después de la presentación | Aceptada |
