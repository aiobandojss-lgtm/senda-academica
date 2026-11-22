# Design

## Context

La motivación está en proposal.md ("Why"). Estado actual relevante:

- **Sesión (design.md D4 del MVP, archivado en `openspec/changes/archive/2026-11-19-mvp-plataforma-academica/`):** JWT HS256 en la cookie `__Host-sesion`, con la versión de sesión del usuario (`ver`). En cada petición, `requiereSesion` (`api/src/seguridad/permisos.ts`) compara esa versión con `usuarios.sesion_version`. Si no coinciden, responde 401. El cambio de contraseña, el restablecimiento y la desactivación ya suben esa versión.
- **`POST /api/auth/salir`** es una ruta pública (`RUTAS_PUBLICAS` en `api/src/index.ts`). Así funciona aunque falte una compuerta (contraseña temporal o aviso) o el estudiante esté bloqueado por mora. Hoy solo borra la cookie y siempre responde 204.
- **El frontend** (`web/src/sesion/ContextoSesion.tsx`) llama a esa ruta, ignora un error de red y vuelve a la pantalla de ingreso. Si el estudiante queda suspendido por mora, también la llama.
- **Las instrucciones del asistente** (`api/src/rag/agente.ts`, regla 7) ya le piden responder "que solo ayudas con temas de la Fundación" y no explicar temas de los cursos.

## Goals / Non-Goals

**Goals:**
- Que cerrar sesión invalide el token en el servidor, sin migraciones y sin una consulta más en las demás peticiones.
- Que un token que ya no es válido no pueda cerrar las sesiones vigentes.
- Que la spec del asistente describa lo que el diseño ya pide al modelo.

**Non-Goals:**
- Cambiar el frontend, las instrucciones del modelo o la evaluación del asistente.
- Revocar solo el token del equipo actual (ver D1, alternativas).

## Decisions

### D1. Revocar subiendo `sesion_version`, condicionado a la versión del token

Al cerrar sesión se lee el token como hoy (firma y vencimiento, `leerSesion`). Si es válido, se ejecuta una sola escritura:

```sql
UPDATE usuarios SET sesion_version = sesion_version + 1 WHERE id = ? AND sesion_version = ?
```

con el id y la versión del token. Por qué así:
- **Reutiliza el mecanismo de D4,** que ya está probado. Toda copia del token, y toda otra sesión del usuario, falla en la siguiente petición, porque `requiereSesion` ya compara la versión.
- **La condición `AND sesion_version = ?` es la defensa del escenario "Cierre con una sesión que ya no es válida".** Un token viejo (por ejemplo, de antes de un cambio de contraseña) no coincide, así que la escritura no cambia nada y las sesiones vigentes siguen. Es una sola sentencia, sin una lectura previa que pueda quedar desactualizada entre la lectura y la escritura.
- **No hace falta verificar que el usuario esté activo:** desactivarlo ya subió la versión, así que su token no coincide.

Alternativas descartadas:
- **Lista de tokens revocados** (un identificador por token, guardado en D1 o en KV). Cerraría solo el equipo actual, pero exige una migración nueva y una consulta más en cada petición. No vale la pena a cuatro días de la presentación. Si la Fundación lo pide, va en otro cambio.
- **Subir la versión sin la condición.** Es más simple, pero una cookie robada que ya fue revocada serviría para cerrarle la sesión al usuario una y otra vez.
- **Acortar la vida del token.** Reduce la ventana de riesgo, pero no cumple el THEN: la sesión seguiría siendo válida después de cerrarla.

### D2. El contrato de la ruta no cambia

`POST /api/auth/salir` sigue siendo pública. Siempre borra la cookie y responde 204, haya o no sesión, sea válida o no. Así no revela si un token sirve. Sigue siendo POST: con `SameSite=Lax`, otro sitio no puede enviar la cookie en un POST, así que no puede cerrar la sesión de nadie (CSRF).

**La cookie se borra antes de intentar la revocación, y una falla de la revocación no cambia la respuesta.** Si D1 falla o el secreto está mal configurado, el error queda en el log, sin datos personales, y la respuesta sigue siendo 204 con la cookie borrada. Así, en el peor caso, el cierre queda igual que antes de este cambio: este navegador queda sin sesión y una copia del token sirve hasta que venza. Decisión de Aymer del 19 de noviembre, por un hallazgo del subagente revisor-spec. La primera versión respondía 500 sin borrar la cookie, y como el frontend ignora el error y muestra la pantalla de ingreso, en un computador compartido el siguiente entraba con la cuenta del anterior. Alternativa descartada: borrar primero y responder 500. Nadie vería el error, porque el frontend lo ignora, y habría que confiar en que el manejador de errores conserve el borrado de la cookie.

### D3. Spec del asistente: ajustar el THEN, no el prompt

El THEN de "Pedir que explique un tema de un curso" acepta las dos negativas: "no tengo esa información" o "solo ayudo con temas de la Fundación". Lo que la spec protege es que el modelo no explique el tema con su propio conocimiento. Eso lo mide la evaluación con el modelo real, no el CI, en el caso `explicar-arreglo` de `eval/preguntas.json`:

- `rechaza` acepta las negativas que piden las reglas 5 a 7 de las instrucciones. Entre ellas están las dos del THEN, pero también otras, como "no puedo…".
- `noContiene` falla si aparece alguna de cuatro palabras propias de una explicación ("estructura de datos", "almacena", "índice", "posición"). Es una aproximación: una explicación redactada sin esas palabras pasaría.

La respuesta real del 19 de noviembre ("Lo siento, solo ayudo con temas de Fundación (demo).") cumple el THEN. En el CI, la prueba de `api/test/agente.test.ts` que lleva el nombre del escenario verifica la regla 7 de las instrucciones y que la negativa pase la validación (D5 del RAG). Con un modelo guionado no puede verificar que el modelo real no explique. No hay cambio de código. Después de la presentación se puede ampliar `noContiene`.

Alternativa descartada: cambiar la regla 7 para que diga "no tengo esa información". Obligaría a repetir la evaluación (unas 800 neuronas y 26 de las 30 preguntas diarias de la estudiante), y un cambio en el prompt puede mover otras respuestas a cuatro días de la presentación.

## Risks / Trade-offs

- **[Riesgo] Cerrar sesión también cierra los otros equipos del usuario.** → Aymer lo aceptó. En la demo, cada persona usa su propio navegador: no se cierra la sesión de una persona que esté abierta en otro navegador que se vaya a usar después. Se anota en la preparación del guion.
- **[Riesgo] Una prueba existente usa el token después de salir** (`api/test/permisos.test.ts`, "Llamada directa a la API con contraseña temporal"). Con la revocación recibiría 401 en lugar del 403 de la compuerta. → Se reordena para verificar la compuerta antes de salir, sin cambiar lo que comprueba.
- **[Riesgo] Si la revocación falla** (D1 o el secreto), el token sigue siendo válido hasta que vence. → La cookie se borra igual y se responde 204 (D2), así que este navegador queda sin sesión. El error queda en el log para revisarlo. Es el mismo nivel de protección que había antes del cambio, nunca uno peor.
- **[Trade-off] Una escritura en D1 por cada cierre de sesión.** → Despreciable frente a las 100.000 escrituras diarias del plan Free.

## Migration Plan

- Sin migración de datos: `sesion_version` ya existe.
- Despliegue por el pipeline de siempre: Aymer hace el push, el CI corre las pruebas y el E2E, y despliega.
- Reversión: revertir el commit. Las sesiones que se cerraron mientras tanto siguen cerradas, que es lo esperado.
