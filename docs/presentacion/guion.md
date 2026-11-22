# Guion de la presentación – lunes 23 de noviembre de 2026

**Versión 1** (jueves 19). Se ajusta con los ensayos del domingo.

- **Formato:** unos 10 minutos de demo en vivo, más preguntas ([rúbrica](../rubrica.md)).
- **Hilo conductor:** contar la metodología del curso **usando el producto como evidencia**. La rúbrica pide tres momentos: el problema, la demo del flujo principal y una decisión técnica de la que estés orgulloso.
- **Decisión técnica elegida por Aymer:** las guardas contra la alucinación del asistente.
- **URL:** <https://senda.creativebycode.workers.dev> · **Cuentas:** [CUENTAS-DEMO.md](../../db/seed/CUENTAS-DEMO.md), con la contraseña `Demo2026*` para todas.

## Resumen de tiempos

| Minuto | Bloque | Criterios |
|---|---|---|
| 0:00 – 1:00 | 1. El problema y qué es Senda | – |
| 1:00 – 5:00 | 2. Demo en vivo del flujo principal | 1, 2, 3 |
| 5:00 – 7:30 | 3. La decisión técnica: un asistente que no inventa | 3, 6 |
| 7:30 – 9:15 | 4. Cómo se construyó: la metodología | 4, 5, 6 |
| 9:15 – 10:00 | 5. Cierre | – |

## 1. El problema y qué es Senda (1 minuto)

**Qué dices:**
- "Una fundación educativa que empieza, sin dinero, con estudiantes técnicos que estudian desde el celular. Hoy no tiene cómo controlar quién entregó, quién va al día con los pagos ni a quién bloquear."
- "Senda resuelve eso en el plan gratuito de Cloudflare: carreras y estudiantes, talleres con entregas y notas, cuotas y pagos, y el bloqueo automático por mora de más de 30 días. Encima, un asistente que responde con los documentos oficiales y con los datos del propio estudiante, sin inventar."
- "Todo lo que van a ver sale de la base de datos real; los datos son ficticios porque la Fundación aún no ha entregado los suyos."

**Qué muestras:** la pantalla de ingreso en el celular, con el lema "Tu camino académico, paso a paso".

## 2. Demo en vivo del flujo principal (4 minutos)

En cada paso, di en una frase qué spec lo respalda: así se ve que el producto sale de las specs.

| Tiempo | Quién y dónde | Qué haces | Qué dices |
|---|---|---|---|
| 30 s | **Paola** (celular) | Ingresa, toca "Subir mi entrega" del Taller 3, elige el PDF y sube | "Paola va al día. Sube su taller desde el celular; el archivo se valida por su contenido, no por la extensión." |
| 45 s | **Liliana, la docente** (escritorio) | Abre Lógica de programación → Taller 3 → "Calificar" en la fila de Paola → nota 4,2 y comentario → "Guardar nota" | "La docente ve quién entregó y califica. No ve el celular ni el correo de sus estudiantes: Habeas Data." |
| 15 s | **Paola** (celular) | Abre el Taller 3 y muestra "4,2 de 5,0" | "La nota llega al instante." |
| 1 min 15 s | **Paola** (celular) | Abre el asistente: 1) la sugerencia "¿Cuál es la nota mínima para aprobar un curso?"; 2) "¿Cuánto debo en total?"; 3) escribe "¿Cuál es el horario de la cafetería?" | 1) "Responde 3.0 y cita la fuente: Reglamento estudiantil, Evaluación y calificaciones." 2) "$360.000: sale de su estado de cuenta real, en este momento." 3) "Eso no está en ningún documento: dice que no tiene la información y remite a la Fundación. No inventa." |
| 1 min 15 s | **Manuela** (otra ventana) y **administración** (escritorio) | Manuela intenta ingresar: acceso suspendido. Administración abre su estado de cuenta → "Registrar pago" en octubre → Manuela ingresa | "Manuela tiene una cuota con 49 días de atraso: no entra. No hay un proceso nocturno; el estado se calcula en cada petición. Se registra el pago y entra en el mismo instante, ahora 'en riesgo' porque aún debe noviembre." |

## 3. La decisión técnica: un asistente que no inventa (2 minutos y medio)

Es la historia de la que estás orgulloso. Cuéntala en cinco pasos:

1. **La regla, en la spec:** "Si no recupera información suficiente, el asistente MUST decir que no tiene esa información y MUST NOT inventar datos, fechas, valores ni normas" (spec `asistente-academico`, "Reconocer cuando no sabe").
2. **La prueba real lo contradijo.** Con el modelo real, el asistente respondió de memoria: "La nota mínima es **4.0**. [Reglamento Académico]". La nota correcta es 3.0, y esa cita no existe. La validación de entonces la dejaba pasar.
3. **Primero el diseño, después el código.** Se actualizó `design.md` (D5) y luego se programaron 3 capas de defensa:
   - **Umbral de similitud (0,55):** un fragmento poco parecido no cuenta como fuente. Se midió antes: 0,743 con el fragmento correcto y 0,35 con un texto ajeno.
   - **Instrucciones estrictas:** el modelo debe consultar una herramienta antes de responder sobre la Fundación.
   - **Validación de la respuesta, en el código:** toda cita debe ser un fragmento recuperado de verdad, y sin herramientas no se aceptan cifras. Si falla, la respuesta se reemplaza por "no tengo esa información". **Esta capa no depende de que el modelo obedezca.**
4. **Pruebas que reproducen el error real:** un modelo simulado repite exactamente la alucinación del "4.0", y la prueba verifica que se reemplaza.
5. **Medido, no opinado:** 25 preguntas con su respuesta esperada y dos modelos.
   - gpt-oss-20b acierta el **96 %** y llama-3.3-70b el **88 %**; gpt-oss cuesta la mitad. Por eso se eligió gpt-oss.
   - Cada pregunta cuesta unas 31 neuronas: el plan gratuito aguanta unas 320 preguntas diarias.
   - La única falla de gpt-oss es segura: se negó a responder algo que sí estaba en el calendario.

**Qué muestras:** el `design.md` del RAG en D5, la prueba con el error real ("sin herramientas y con una 'cita' inventada sin raya: se reemplaza", en `api/test/agente.test.ts`) y la tabla de resultados de la evaluación (D7).

**Frase de cierre del bloque:** "Preferimos un asistente que diga 'no sé' a uno que invente una nota."

## 4. Cómo se construyó: la metodología (1 minuto y 45 segundos)

| Práctica | Qué dices | Qué muestras |
|---|---|---|
| **OpenSpec** (desarrollo guiado por specs) | "Nada se programó sin una spec aprobada por mí: proponer, revisar, implementar y archivar. Hoy el producto está descrito en 7 capacidades, con 55 requisitos y 130 escenarios, y cada escenario tiene una prueba que lleva su nombre: un comando lo verifica en cada push." | `openspec/specs/` y `npm run trazabilidad`: "Escenarios con prueba: 130 de 130" |
| **Pruebas y CI/CD** | "413 pruebas automáticas y 3 E2E con Playwright. Si el flujo de la demo se rompe, el pipeline no despliega. Y lo comprobé: dañé a propósito la regla de mora, de 30 a 29 días, escribí antes qué debía fallar y el pipeline lo atrapó tal cual. Es la única ejecución en rojo de toda la historia." | GitHub Actions en verde, y el pull request #1, "Prueba de fuego", en rojo |
| **El agente con contexto** | "Claude Code trabajó con un `CLAUDE.md` de reglas que no se negocian, skills de OpenSpec y TDD, y MCP: Playwright para revisar las 50 capturas de las pantallas, y context7 para la documentación vigente. Las reglas más importantes no dependen de que el agente las recuerde: un hook le bloquea leer los secretos o editar una migración aplicada, otro le avisa si deja caracteres invisibles, y un subagente revisor, que no vio cómo se escribió el código, lo revisa contra la spec." | `CLAUDE.md`, `.claude/settings.json` y el [informe de la revisión visual](../revision/2026-11-19-revision-visual.md) |
| **Humano en el bucle** | "Las decisiones las tomé yo: los secretos los cargo yo y las specs las apruebo yo. El agente presenta opciones con pros y contras." | Una revisión aprobada en `docs/revision/` |
| **Más allá de lo pedido** (bonus) | "Además de lo que pide la rúbrica: la evaluación medida del asistente, la revisión visual automatizada y una prueba E2E del asistente sin gastar cuota, con un candado para que la simulación nunca llegue a producción." | – |

## 5. Cierre (45 segundos)

- "Senda funciona hoy, publicado y probado, en el plan gratuito. Para la Fundación sigue el paso a producción: su dominio, sus datos reales y el almacenamiento definitivo, R2."
- "Lo que me llevo: con un agente, la diferencia la hace la disciplina. Spec primero, pruebas que fallan por la razón correcta y medir antes de decidir."

## Preparación antes de empezar

- **Navegadores separados:** cada sesión vive en una cookie, así que cada persona va en su propio navegador o perfil. **Cerrar sesión cierra a esa persona en todos los equipos** (desde el 19 de noviembre). Si en un ensayo abres a Paola en el celular y en el computador, cerrarla en uno la saca también del otro: vuelve a ingresar antes de la demo.
  - **Celular:** Paola, con la pantalla de ingreso abierta.
  - **Escritorio, perfil 1:** Liliana, la docente (`9900000103`).
  - **Escritorio, perfil 2:** administración (`9900000001`).
  - **Ventana de incógnito:** Manuela (`9900001002`).
- **Pestañas de apoyo:**
  - GitHub Actions con la última ejecución en verde;
  - `design.md` del RAG en D5 y D7;
  - `openspec/specs/`;
  - la prueba del "4.0" en `api/test/agente.test.ts`.
- **Datos:** recargar el seed remoto esa mañana. La demo cambia datos (la entrega, la nota y el pago) y los ensayos también.
- **Cuota de IA:** no correr la evaluación ese día. Cada pregunta de la demo cuesta unas 31 neuronas, y Paola tiene 30 preguntas diarias.

## Plan B

| Si falla... | Haces |
|---|---|
| El internet | Datos móviles del celular como respaldo; si no, el video de respaldo |
| El asistente responde "no está disponible" | Explicas que es la regla D11 (sin cuota o sin servicio, avisa en lugar de inventar) y muestras esa parte en el video |
| Cualquier paso del flujo | Pasas al video de respaldo en ese punto y sigues el guion |

## Preguntas esperadas (para completar el domingo)

| Pregunta | Respuesta corta |
|---|---|
| ¿Cómo sabes que el asistente no inventa? | Por las 3 capas y la evaluación: 96 % de aciertos, y la falla que tiene es negarse, no inventar |
| ¿Por qué ese modelo? | Se midieron los dos con las mismas 25 preguntas: más aciertos y la mitad del costo |
| ¿Qué pasa si se acaba la cuota gratuita? | El asistente avisa que no está disponible (D11), y el límite de 30 preguntas por estudiante evita que uno solo la agote |
| ¿Qué datos personales ve la IA? | Solo el nombre de pila, la carrera y los resultados de las herramientas; nunca el documento, el correo ni el celular (D6) |
| ¿Y si alguien manipula el historial del chat? | El servidor guarda la conversación y solo acepta la pregunta nueva (D8) |
| ¿Por qué Cloudflare? | Costo cero para la Fundación, todo en un solo despliegue y la IA en la misma plataforma (ADR-001) |
| ¿Cómo sabes que las pruebas prueban algo? | Siempre rojo antes de verde, y 17 mutaciones del código, todas detectadas |
| ¿Qué hizo la IA y qué hiciste tú? | El agente propone e implementa; yo apruebo las specs, elijo entre opciones y cargo los secretos |
| ¿Cuánto cuesta operarlo? | Hoy, nada. Con más uso, unos USD 0,34 por cada 1.000 preguntas adicionales |
