# Guion de la presentación – lunes 23 de noviembre de 2026

**Versión 2** (domingo 22). **Las diapositivas están en [diapositivas.html](diapositivas.html) y el texto para leer en [guion.html](guion.html)**: se abren con doble clic (en el mismo navegador, para que se sincronicen), las diapositivas en la pantalla compartida y el guion en la otra pantalla. Este documento queda como referencia: los tiempos, la preparación, el plan B y las preguntas esperadas.

- **Formato:** unos 10 minutos de demo en vivo, más preguntas ([rúbrica](../rubrica.md)).
- **Hilo conductor:** contar la metodología del curso **usando el producto como evidencia**. La rúbrica pide tres momentos: el problema, la demo del flujo principal y una decisión técnica de la que estés orgulloso.
- **Decisión técnica elegida por Aymer:** las guardas contra la alucinación del asistente.
- **URL:** <https://senda.creativebycode.workers.dev> · **Cuentas:** [CUENTAS-DEMO.md](../../db/seed/CUENTAS-DEMO.md), con la contraseña `Demo2026*` para todas.

## Resumen de tiempos

| Minuto | Bloque | Criterios |
|---|---|---|
| 0:00 – 0:50 | 1. El problema y qué es Senda | – |
| 0:50 – 4:50 | 2. Demo en vivo del flujo principal, con la identidad visual | 1, 2, 3, 6 |
| 4:50 – 6:50 | 3. La decisión técnica: un asistente que no inventa | 3, 6 |
| 6:50 – 9:20 | 4. Cómo se construyó: **ruta de evidencias en vivo** (VS Code, terminal y GitHub) | 4, 5, 6 |
| 9:20 – 10:00 | 5. Cierre | bonus |

Ajuste del 22 de noviembre: la rúbrica pide "~10 minutos de demo en vivo" y "los tests y el pipeline listos para mostrarse en verde". Por eso el bloque 4 muestra los archivos reales en lugar de diapositivas. El texto exacto de cada paso está en `guion.html`.

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
   - La única falla de gpt-oss era segura: se negó a responder la semana de parciales, que sí estaba en el calendario.
   - **Diagnosticada con evidencia el 21 de noviembre:** el fragmento correcto quedó primero, con 0,549, a una milésima del umbral. No se bajó el umbral, porque eso aflojaría la guarda en todas las preguntas. Se escribió el calendario con las palabras del estudiante, "semana de parciales". Resultado: **25 de 25 (100 %)**, con las 9 negativas intactas. El modelo no es determinista: otra corrida del mismo día dio 24 de 25. Todas superan el 90 % y ninguna falla inventa.

**Qué muestras:** el `design.md` del RAG en D5, la prueba con el error real ("sin herramientas y con una 'cita' inventada sin raya: se reemplaza", en `api/test/agente.test.ts`) y la tabla de resultados de la evaluación (D7).

**Frase de cierre del bloque:** "Preferimos un asistente que diga 'no sé' a uno que invente una nota."

## 4. Cómo se construyó: ruta de evidencias en vivo (2 minutos y medio)

Se muestran los archivos reales, en este orden. El texto para leer está en `guion.html` (pasos 12 a 15).

| # | Qué muestras | Dónde | Criterio |
|---|---|---|---|
| 1 | Un cambio de OpenSpec completo: propuesta, specs, diseño y tareas | VS Code → `openspec/changes/archive/2026-11-21-cerrar-sesion-y-temas-de-cursos/` | 6 |
| 2 | Una regla escrita como escenario | `openspec/specs/bloqueo-mora/spec.md`, escenario "31 días de atraso" | 4, 6 |
| 3 | Su prueba, con el mismo nombre | `api/test/mora.test.ts`, línea 11 | 4 |
| 4 | Que ningún escenario quede sin prueba | Terminal de VS Code: `npm run trazabilidad` → "130 de 130" | 4 |
| 5 | El robot que repite la demo | `e2e/demo.spec.ts` (Playwright) | 4 |
| 6 | El pipeline en verde y la prueba de fuego | GitHub → Actions → última ejecución; pull request #1 en rojo | 5 |
| 7 | El agente con reglas | `CLAUDE.md` y la carpeta `.claude/` (skills, hooks y agents) | 6 |

**Más allá de lo pedido** (bonus, si preguntan): la evaluación medida del asistente, la revisión visual automatizada, el subagente revisor y los hooks, y una prueba E2E del asistente sin gastar cuota.

## 5. Cierre (40 segundos)

- "Senda funciona hoy, publicado y probado, en el plan gratuito. Lo que sigue: mostrarle las specs a la rectora de la Fundación, que puede cambiar reglas y alcances. Después, producción con sus datos reales, y avisos de cartera por WhatsApp con n8n."
- "Lo que me llevo: con un agente, la diferencia la hace la disciplina. Spec primero, pruebas que fallan por la razón correcta y medir antes de decidir."

## Preparación antes de empezar

- **Presentación virtual con dos pantallas** (decisión del 21 de noviembre):
  - **Pantalla 1, la que se comparte en la videollamada** (compartir la pantalla completa, no una ventana): la proyección en pantalla completa (tecla `F`) y las ventanas de la demo.
  - **Pantalla 2, solo para ti:** el guion (doble clic en `docs/presentacion/guion.html`). Ahí avanzas con `→`, y la proyección cambia sola.
  - Abre `diapositivas.html` y `guion.html` con doble clic: los dos quedan en tu navegador predeterminado y así se sincronizan. No hace falta terminal ni internet.
- **Navegadores separados:** cada sesión vive en una cookie, así que cada persona va en su propio navegador o perfil. **Cerrar sesión cierra a esa persona en todos los equipos** (desde el 19 de noviembre): si en un ensayo la cierras en otro lado, vuelve a ingresar antes de la demo.
  - **Microsoft Edge, ventana angosta (unos 450 px):** Paola, en la pantalla de ingreso. Con menos de 768 px de ancho, Senda muestra la versión de celular, la misma que probaste en tu iPhone. Di en voz alta que es la misma web responsiva.
  - **Chrome, perfil 1:** Liliana, la docente (`9900000103`), con la sesión ya abierta.
  - **Chrome, perfil 2:** administración (`9900000001`), con la sesión ya abierta.
  - **Ventana de incógnito:** Manuela (`9900001002`), en la pantalla de ingreso.
- **El PDF de Paola:** copia `db/seed/placeholder.pdf` al Escritorio con el nombre `taller3-paola.pdf`.
- **VS Code, abierto en el repo, con estas pestañas ya abiertas y en este orden** (para la ruta de evidencias):
  - `openspec/changes/archive/2026-11-21-cerrar-sesion-y-temas-de-cursos/proposal.md`, con la carpeta desplegada en el explorador;
  - `openspec/specs/bloqueo-mora/spec.md`, en el escenario "31 días de atraso";
  - `api/test/mora.test.ts`, en la línea 11;
  - `e2e/demo.spec.ts`;
  - `CLAUDE.md`, con la carpeta `.claude/` desplegada;
  - la terminal integrada lista con `npm run trazabilidad` escrito, sin ejecutar.
  - Sube el tamaño de la letra de VS Code (`Ctrl` + `+`): en la videollamada se ve más pequeño.
- **Navegador:** GitHub → Actions con la última ejecución en verde, y otra pestaña con el pull request #1, "Prueba de fuego".
- **El proyecto también en local** (la rúbrica lo pide como respaldo): `npm run dev` en otra terminal. Si la URL pública fallara, la demo sigue en `http://localhost:5173`. Gasta cuota de Workers AI solo si se usa el asistente.
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
| ¿Cómo sabes que el asistente no inventa? | Por las 3 capas y la evaluación: 25 de 25 en la última corrida. Cuando falla, se niega; nunca inventa. La falla de "semana de parciales" se corrigió en el documento, sin aflojar el umbral |
| ¿El 100 % es estable? | No, y no lo digo así: el modelo no es determinista. Con gpt-oss, las corridas completas del 19 y el 21 dieron 96 %, 96 % y 100 %. Lo estable es que siempre supera el umbral de 90 % y que sus fallas son negativas, no inventos |
| ¿No es sobreajuste copiar al documento la frase de la pregunta? | Es el vocabulario con el que preguntan los estudiantes; mover el umbral sí habría cambiado la regla para todas las preguntas. Y se probó con otra forma de preguntar: "¿Cuándo son los exámenes parciales?" |
| ¿Por qué ese modelo? | Se midieron los dos con las mismas 25 preguntas: más aciertos y la mitad del costo |
| ¿Qué pasa si se acaba la cuota gratuita? | El asistente avisa que no está disponible (D11), y el límite de 30 preguntas por estudiante evita que uno solo la agote |
| ¿Qué datos personales ve la IA? | Solo el nombre de pila, la carrera y los resultados de las herramientas; nunca el documento, el correo ni el celular (D6) |
| ¿Y si alguien manipula el historial del chat? | El servidor guarda la conversación y solo acepta la pregunta nueva (D8) |
| ¿Por qué Cloudflare? | Costo cero para la Fundación, todo en un solo despliegue y la IA en la misma plataforma (ADR-001) |
| ¿Cómo sabes que las pruebas prueban algo? | Siempre rojo antes de verde, y 17 mutaciones del código, todas detectadas |
| ¿Qué hizo la IA y qué hiciste tú? | El agente propone e implementa; yo apruebo las specs, elijo entre opciones y cargo los secretos |
| ¿Cuánto cuesta operarlo? | Hoy, nada. Con más uso, unos USD 0,34 por cada 1.000 preguntas adicionales |
