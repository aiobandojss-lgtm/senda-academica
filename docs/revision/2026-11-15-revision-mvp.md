# Revisión y aprobación del cambio `mvp-plataforma-academica`

**Revisor:** Aymer (dueño del producto) · **Fecha:** 15 de noviembre de 2026 · **Estado:** ✅ aprobado con supuestos (ver "Decisiones registradas")

Aquí se aprueba **qué** hace el producto antes de programar sus reglas de negocio. Cada requisito aprobado se convierte en código y en pruebas: lo que apruebes es lo que Senda hará, y lo que defenderás ante el jurado.

## Cómo leer (unos 50 minutos)

1. Abre cada archivo en VS Code y presiona `Ctrl+Shift+V` para ver la vista previa. Todos están en `openspec/changes/mvp-plataforma-academica/` (archivado el 2026-11-19 en `openspec/changes/archive/2026-11-19-mvp-plataforma-academica/`; sus specs quedaron en `openspec/specs/`).
2. **Vocabulario de las specs:**
   - **Requirement:** lo que el sistema debe hacer.
   - **SHALL / MUST:** obligatorio. **MUST NOT:** prohibido.
   - **Scenario (WHEN / THEN):** un ejemplo concreto y verificable. Cada escenario se convierte en una prueba automática.
3. Lee **como dueño del producto, no como corrector**. La pregunta no es "¿está bien escrito?" sino "¿así funciona la Fundación?" y "¿podría explicar esto?".
4. Para cada punto de la lista, respóndeme en el chat con su número y **OK** o el **cambio** que quieres (por ejemplo: "1 OK, 7 cambiar: …, 13 pregunto a la Fundación"). Yo registro tus decisiones en este documento.

Orden recomendado: `proposal.md` → `autenticacion` → `carreras-estudiantes` → `actividades-entregas` → `cartera` → `bloqueo-mora` → `design.md` (por encima).

---

## Paso 1 · `proposal.md` (5 minutos)

Léelo completo: es corto. Revisa:

- **Por qué** (líneas 3 a 7): ¿describe el problema real de la Fundación?
- **Fuera del alcance** (línea 20): ¿es aceptable que el MVP **no** tenga lo siguiente?

### P1. Lo que queda fuera
- **Qué dice:** el MVP no incluye recuperación de contraseña por correo, periodos académicos, manejo especial de menores de edad, becas ni descuentos, entre otros.
- **Para pensar:**
  - **Menores de edad.** Si Funafrocol tiene estudiantes menores de 18, la Ley 1581 exige un tratamiento especial de sus datos: autorización del acudiente. Habría que preguntarle a la Fundación.
  - **Becas.** Se pueden representar con una cuota de menor valor para ese estudiante, sin construir nada nuevo.
- **Tu decisión:** OK / cambio / preguntar a la Fundación.

---

## Paso 2 · Las specs (35 minutos)

### `specs/autenticacion/spec.md`

**1. El usuario es el número de documento** · líneas 9 a 26
- **Qué dice:** se ingresa con el documento y una contraseña. Ante un error, el mensaje es siempre "Documento o contraseña incorrectos", sin revelar si el documento existe.
- **Por qué:** en Colombia todo estudiante tiene documento, pero no siempre correo. El mensaje genérico evita que alguien averigüe quién está registrado.
- **Pregunta:** ¿la Fundación identifica así a sus estudiantes?

**2. Cinco intentos fallidos bloquean ese documento durante 15 minutos** · líneas 28 a 41
- **Qué dice:** el sexto intento se rechaza aunque la contraseña sea correcta, y un ingreso exitoso reinicia el conteo.
- **Por qué:** evita que alguien adivine contraseñas probando muchas.
- **Pregunta:** ¿5 intentos y 15 minutos te parece razonable?

**3. Contraseña de al menos 8 caracteres, distinta del documento** · líneas 50 a 67
- **Qué dice:** no exige mayúsculas ni símbolos. El primer ingreso obliga a cambiar la contraseña temporal, y el servidor rechaza todo lo demás hasta que se cambie.
- **Por qué:** la recomendación actual (NIST) privilegia la longitud sobre la complejidad, porque las reglas complejas llevan a contraseñas anotadas en papel.
- **Pregunta:** ¿8 caracteres es suficiente para estudiantes de programas técnicos?

**4. Si un estudiante olvida su contraseña, solo el administrador la restablece** · líneas 80 a 85 (y proposal, línea 20)
- **Qué dice:** el administrador genera una contraseña temporal aleatoria que se muestra **una sola vez**. No hay "olvidé mi contraseña" por correo en el MVP.
- **Pregunta:** ¿la Fundación puede atender esas solicitudes, por ejemplo por WhatsApp a la coordinación?

**5. La sesión dura 8 horas desde el ingreso** · líneas 87 a 96
- **Qué dice:** a las 8 horas pide ingresar de nuevo. El tiempo no se reinicia con la actividad.
- **Pregunta:** si los estudiantes usan **computadores compartidos** (salas o cafés internet), ¿8 horas es mucho? Siempre pueden pulsar "Cerrar sesión".

**6. El aviso de privacidad es obligatorio** · líneas 113 a 126
- **Qué dice:** nadie usa la plataforma sin aceptar la versión vigente del aviso, y si la Fundación publica otra versión, se pide aceptar de nuevo.
- **Por qué:** lo exige la Ley 1581 de 2012. El texto lo aporta la Fundación.
- **Pregunta:** solo confirmar.

**7. El docente no ve el documento, el correo ni el celular de sus estudiantes** · líneas 128 a 145
- **Qué dice:** el docente solo ve nombres, apellidos y el estado de las entregas.
- **Por qué:** minimización de datos (Habeas Data): cada rol recibe solo lo que necesita.
- **Pregunta:** ¿los docentes necesitan contactar a los estudiantes por fuera de la plataforma? Si sí, ¿lo hacen por la coordinación?

### `specs/carreras-estudiantes/spec.md`

**8. Datos de cada estudiante** · líneas 31 a 40
- **Qué dice:** tipo y número de documento, nombres, apellidos, correo, celular (opcional), carrera, semestre actual y fecha de ingreso.
- **Pregunta:** ¿falta algún dato que la Fundación necesite, como fecha de nacimiento o acudiente? Pide solo lo indispensable: cada dato adicional es más responsabilidad legal.

**9. Inscripción automática en los cursos del semestre** · líneas 42 a 55
- **Qué dice:** cada estudiante queda inscrito en **todos** los cursos de su carrera y su semestre: al registrarlo, al cambiarle el semestre o al crear un curso. Al cambiar de semestre conserva sus notas anteriores.
- **⚠️ Lo que no hay:** inscribir a un estudiante en un curso **suelto**, por ejemplo para repetir uno reprobado o tomar uno de otro semestre.
- **Pregunta:** ¿la Fundación necesita eso **ya**? Mi recomendación es dejarlo para después del MVP, salvo que sea común.

**10. Carga masiva por CSV: todo o nada** · líneas 72 a 85 (columnas en design.md, línea 44)
- **Qué dice:** si una fila tiene un error, no se guarda ninguna y se muestra cada error con su número de fila. El archivo de credenciales iniciales se descarga **una sola vez**.
- **Por qué:** evita cargas a medias, difíciles de corregir. Las contraseñas nunca quedan guardadas en texto plano.
- **Pregunta:** solo confirmar.

**11. Desactivar en lugar de borrar** · líneas 94 a 107
- **Qué dice:** un estudiante retirado se desactiva: no ingresa, pero su historial académico y de pagos se conserva.
- **Pregunta:** solo confirmar.

### `specs/actividades-entregas/spec.md`

**12. Un archivo por actividad: PDF, DOCX, JPG o PNG, hasta 10 MB** · líneas 20 a 33
- **Pregunta:** ¿los talleres de la Fundación se entregan así? ¿Necesitan **Excel** (por ejemplo, en Contabilidad) o **varios archivos** por entrega?

**13. Las entregas tardías se aceptan y se marcan como "tardías"** · líneas 46 a 55
- **Qué dice:** después de la fecha límite se puede seguir entregando, con la marca visible para el docente. Si el docente amplía el plazo, la marca desaparece sola.
- **Pregunta:** ¿la Fundación prefiere **rechazar** las entregas después de la fecha límite? El MVP deja la decisión al docente al calificar.

**14. Nota de 0.0 a 5.0 con un decimal y comentario opcional** · líneas 64 a 73
- **Qué dice:** el estudiante ve la nota y el comentario. El MVP **no** calcula la nota definitiva del curso ni si aprobó.
- **Pregunta:** ¿está bien que la nota definitiva quede para después?

### `specs/cartera/spec.md`

**15. Medios de pago: efectivo, transferencia o consignación** · líneas 31 a 44
- **Qué dice:** pagos totales o parciales, nunca mayores al saldo de la cuota, con soporte opcional.
- **Pregunta:** ¿Nequi o Daviplata cuentan como "transferencia", o los quieres como medio aparte?

**16. Los pagos no se modifican: se anulan con motivo y se registra uno nuevo** · líneas 46 a 55 (y líneas 16 a 29 para las cuotas)
- **Qué dice:** el pago anulado queda en el historial. Una cuota con pagos, aunque estén anulados, no se edita ni se borra. Esto también lo protegen los triggers de la base de datos.
- **Por qué:** es dinero. El historial debe ser auditable, como en un sistema contable.
- **Pregunta:** solo confirmar.

### `specs/bloqueo-mora/spec.md`

**17. Bloqueo con más de 30 días de atraso: el día 31 bloquea y el día 30 no** · líneas 9 a 26
- **Qué dice:** se cuenta con la fecha de Colombia, y un pago parcial no desbloquea mientras la cuota tenga saldo.
- **Pregunta:** ¿"más de 30 días" es exactamente la regla de la Fundación?

**18. Cuatro estados: al día, en riesgo, bloqueado, con excepción** · líneas 28 a 37
- **Qué dice:** solo "bloqueado" impide el acceso. "En riesgo" significa que tiene una cuota vencida con menos de 31 días de atraso.
- **⚠️ Para pensar:** el estudiante ve sus días de atraso en el estado de cuenta, pero **no recibe un aviso** del tipo "si no pagas antes del 5 de diciembre se suspenderá tu acceso".
- **Pregunta:** ¿lo agregamos? Es un cambio pequeño que evita que el bloqueo tome por sorpresa al estudiante, y se ve bien en la demo.

**19. Excepciones con motivo y fecha final (inclusive)** · líneas 60 a 69
- **Qué dice:** el administrador autoriza, por ejemplo, un acuerdo de pago hasta el 30 de noviembre. Ese día todavía puede ingresar, y el 1 de diciembre vuelve a quedar bloqueado si la mora sigue.
- **Pregunta:** solo confirmar.

**20. Mensaje de bloqueo con el contacto de la Fundación** · líneas 39 a 44
- **Qué dice:** el estudiante bloqueado ve que su acceso está suspendido por mora y cómo comunicarse con la Fundación.
- **Pregunta:** el texto y el canal (WhatsApp, correo, oficina) los define la Fundación. Por ahora queda uno provisional.

---

## Paso 3 · `design.md` por encima (10 minutos)

Este documento explica **cómo** se construye. No lo apruebas regla por regla, pero lee estas decisiones, porque son las que el jurado puede preguntarte:

| Decisión | En una frase |
|---|---|
| D4 (línea 31) | La sesión es un JWT en una cookie que JavaScript no puede leer, y se invalida al cambiar la contraseña |
| D5 (línea 34) | Las contraseñas se guardan con PBKDF2, un hash lento con sal. Hoy se mide si cabe en el plan gratuito (tarea 1.8) |
| D6 (línea 37) | La mora se **calcula** en cada petición en lugar de guardarse: un pago desbloquea al instante |
| D13 (línea 65) | Las reglas de dinero y notas también viven en la base (triggers), como `RAISE_APPLICATION_ERROR` en Oracle |
| D16 (línea 80) | Las compuertas del primer ingreso (contraseña temporal y aviso) se aplican en el servidor, no solo en la pantalla |
| D18 (línea 86) | Cada rol recibe solo los datos que necesita |
| Open Questions (línea 113) | Lo que todavía debe responder la Fundación |

---

## Paso 4 · Aprobación

Cuando me respondas los 20 puntos y P1:

1. Aplico tus cambios a las specs con `/openspec-update-change`. Si cambia el modelo de datos, el cambio va en una migración nueva.
2. Registro aquí tus decisiones y cambio el estado a **aprobado**.
3. Hago un commit "Aprobar el cambio mvp-plataforma-academica" y lo anoto en la bitácora.

Los puntos que dependan de la Fundación pueden quedar **aprobados con valor provisional** y anotados en sus Open Questions. Así no frenan el desarrollo, y cambiarlos después es solo un ajuste de spec.

## Decisiones registradas

**Aprobado por Aymer el 15 de noviembre de 2026.** El proposal y las 5 specs se aprueban con sus valores actuales. Los valores que dependen de la Fundación son **supuestos para la entrega del curso**: se validarán con sus usuarios después de la presentación, y lo que cambie entrará como un nuevo cambio de OpenSpec.

| Punto | Decisión |
|---|---|
| P1 y 1 a 20 | Aprobados con los valores de las specs |
| 8. Datos del estudiante | Se mantiene el conjunto actual, por minimización (Ley 1581). El celular ya está, como opcional. El tipo de sangre (dato sensible de salud), los contactos de emergencia y la dirección se validan con la Fundación. Si los necesita, entran en un cambio posterior con su finalidad, autorización y permisos de acceso (migración nueva) |
| 9. Cursos sueltos | No se incluyen en el MVP |
| 10. CSV | La demo usa un archivo de 2 o 3 filas (ADR-003) |
| 15. Nequi y Daviplata | Se registran como "transferencia" |
| 18. Aviso de "en riesgo" | No se agrega por ahora. Queda como mejora opcional si sobra tiempo antes de la presentación |

## Agenda para validar con la Fundación (después de la presentación)

Participan la coordinación o administración, un docente y un estudiante. Cada respuesta que cambie una regla se convierte en un nuevo cambio de OpenSpec (por ejemplo, `ajustes-validacion-fundacion`, creado con `/openspec-propose`).

- [ ] ¿Hay estudiantes **menores de edad**? Si los hay: autorización del acudiente y sus datos.
- [ ] **Datos adicionales** del estudiante (tipo de sangre, contacto de emergencia, dirección…): ¿cuáles se necesitan y **para qué**?
- [ ] Ingreso: usuario = documento, contraseña de 8 caracteres, 5 intentos cada 15 minutos y sesión de 8 horas (¿hay computadores compartidos?).
- [ ] Quién restablece las contraseñas olvidadas y por qué canal.
- [ ] ¿Los docentes necesitan contactar a los estudiantes? ¿Por qué medio?
- [ ] Inscripción en cursos sueltos (repitentes u homologaciones).
- [ ] Entregas: formatos (¿Excel? ¿varios archivos?), tamaño máximo y si se aceptan tardías.
- [ ] Nota definitiva del curso y nota mínima para aprobar.
- [ ] Medios de pago que usan los estudiantes.
- [ ] Regla de mora (más de 30 días), aviso previo al bloqueo y política de excepciones.
- [ ] Texto del aviso de privacidad (incluida la transferencia internacional de datos), canal de contacto del mensaje de bloqueo, y nombre, logo y colores autorizados.
