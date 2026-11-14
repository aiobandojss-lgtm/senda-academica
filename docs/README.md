# Documentación de Senda

| Documento | Qué contiene |
|---|---|
| [rubrica.md](rubrica.md) | Rúbrica del proyecto final del curso |
| [identidad-visual.md](identidad-visual.md) | Guía visual de Senda (se crea en la tarea 2.0 del MVP) |
| [decisiones/](decisiones/) | Registros de decisiones de arquitectura (ADR) |
| [bitacora/](bitacora/) | Diario de desarrollo: qué se hizo cada día, qué se aprendió y qué problemas hubo |
| [operacion/](operacion/) | Despliegue, paso a producción, respaldos y Habeas Data (se llena antes del despliegue real) |
| [presentacion/](presentacion/) | Guion, checklist de la demo y preguntas esperadas (día 7) |
| [rag/](rag/) | Corpus del asistente: documentos ficticios de la Fundación |

Las especificaciones funcionales no viven aquí sino en `openspec/` (fuente de verdad del comportamiento). Las decisiones de cada cambio están en su `design.md`; aquí van las decisiones transversales al proyecto.

## Decisiones (ADR)

| # | Decisión | Estado |
|---|---|---|
| [001](decisiones/ADR-001-hosting-cloudflare.md) | Hosting en Cloudflare en lugar de Supabase + Vercel | Aceptada |
