# Documentación de Senda

| Documento | Qué contiene |
|---|---|
| [rubrica.md](rubrica.md) | Rúbrica del proyecto final del curso |
| [identidad-visual.md](identidad-visual.md) | Guía visual de Senda: concepto, paleta con contrastes medidos, tipografías, símbolo, componentes y tono. La guía viva está en `/guia` (solo en desarrollo) |
| [decisiones/](decisiones/) | Registros de decisiones de arquitectura (ADR) |
| [revision/](revision/) | Revisiones de Aymer a los cambios de OpenSpec ([MVP](revision/2026-11-15-revision-mvp.md), [asistente RAG](revision/2026-11-17-revision-rag.md)) y la [revisión visual de todas las pantallas](revision/2026-11-19-revision-visual.md) con el MCP de Playwright |
| [bitacora/](bitacora/) | Diario de desarrollo: qué se hizo cada día, qué se aprendió y qué problemas hubo |
| [operacion/](operacion/) | [Despliegue y credenciales del CI](operacion/despliegue.md); después: paso a producción, respaldos y Habeas Data |
| [presentacion/](presentacion/) | [Metodología del curso aplicada](presentacion/metodologia-aplicada.md) (se actualiza con el avance), guion, checklist de la demo y preguntas esperadas |
| [rag/](rag/) | Corpus del asistente: documentos ficticios de la Fundación |

Las especificaciones funcionales no viven aquí sino en `openspec/` (fuente de verdad del comportamiento). Las decisiones de cada cambio están en su `design.md`; aquí van las decisiones transversales al proyecto.

## Decisiones (ADR)

| # | Decisión | Estado |
|---|---|---|
| [001](decisiones/ADR-001-hosting-cloudflare.md) | Hosting en Cloudflare en lugar de Supabase + Vercel | Aceptada |
| [002](decisiones/ADR-002-archivos-kv-demo-r2-produccion.md) | Archivos en Workers KV durante la demo y en R2 en producción | Aceptada |
| [003](decisiones/ADR-003-iteraciones-pbkdf2-plan-free.md) | 100.000 iteraciones de PBKDF2 en el plan Free hasta pasar a Paid después de la presentación | Aceptada |
