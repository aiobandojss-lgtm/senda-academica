# Tasks

## 1. Cerrar sesión invalida el token (spec `autenticacion`, design.md D1 y D2)

- [x] 1.1 Escribir en rojo, en `api/test/auth.test.ts` (grupo `POST /api/auth/salir`), las pruebas con el nombre exacto de sus escenarios:
  - "Cerrar sesión": además de borrar la cookie, un token copiado antes de salir responde 401.
  - "Cierre de sesión desde otro equipo": con dos sesiones del mismo usuario, salir con una deja a la otra en 401.
  - "Cierre con una sesión que ya no es válida": salir con un token ya revocado responde 204 y la sesión vigente sigue respondiendo 200.

  Verificación: `npx vitest run api/test/auth.test.ts`. Las dos primeras fallan por la razón correcta (el token sigue respondiendo 200 después de salir). La tercera pasa desde el inicio, porque protege contra una implementación ingenua, y se comprueba con la mutación de la tarea 1.2.
- [x] 1.2 Implementar D1 en `POST /api/auth/salir` (`api/src/rutas/auth.ts`). Si el token tiene firma válida y no ha vencido, ejecutar `UPDATE usuarios SET sesion_version = sesion_version + 1 WHERE id = ? AND sesion_version = ?`. Después, borrar la cookie y responder 204, como hoy (D2). Verificación:
  - las pruebas de 1.1 pasan;
  - una mutación que quita la condición `AND sesion_version = ?` hace fallar "Cierre con una sesión que ya no es válida";
  - una mutación que quita la escritura hace fallar las otras dos.
- [x] 1.3 Reordenar la prueba "Llamada directa a la API con contraseña temporal" de `api/test/permisos.test.ts`: verificar la compuerta (403 `DEBE_CAMBIAR_PASSWORD`) antes de cerrar sesión, sin cambiar lo que comprueba. Verificación: `npm test` en verde completo.
- [x] 1.4 Documentar en `CLAUDE.md` (viñeta "Sesión": cerrar sesión también revoca con `sesion_version`, y cierra los otros equipos del usuario) y en `docs/presentacion/guion.md` ("Preparación": no cerrar la sesión de una persona que siga abierta en otro navegador de la demo). Verificación: los dos textos quedan en el diff, sin caracteres invisibles (el hook no avisa).

## 2. Spec del asistente (spec `asistente-academico`, design.md D3)

- [x] 2.1 Confirmar sin gastar cuota que la evaluación ya califica como pide el THEN nuevo. Verificación:
  - `npm run eval:rag -- --recalificar eval/resultados/2026-11-19T1415-gpt-oss-20b.json` deja el caso `explicar-arreglo` aprobado;
  - la prueba "Pregunta ajena / Pedir que resuelva el taller / Pedir que explique un tema de un curso" de `api/test/agente.test.ts` sigue en verde.

  Sin cambios de código ni de instrucciones.

## 3. Verificación de conjunto

- [x] 3.1 Correr `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` y `npx openspec validate --all --strict`. Verificación: todo en verde. Después del E2E, `npm run db:seed` deja la base local como antes.
- [ ] 3.2 Pedir al subagente `revisor-spec` la revisión del diff del cambio contra las specs delta y las reglas que no se negocian. Verificación: cada hallazgo se verifica contra el código y queda corregido o anotado, con la razón, en la bitácora del día.

## Workflow follow-up

- Archivar el cambio con `/openspec-archive-change cerrar-sesion-y-temas-de-cursos`. Después, `npm run trazabilidad` debe dar 130 de 130: los dos escenarios nuevos ya tienen prueba desde la tarea 1.1.
- Aymer hace el push y el pipeline despliega.
- Prueba manual en producción: abrir la sesión de una cuenta de la demo en dos navegadores, cerrarla en uno y comprobar que el otro vuelve a la pantalla de ingreso al navegar. Después, recargar el seed remoto según el plan del lunes, porque la prueba no cambia datos de la demo.
