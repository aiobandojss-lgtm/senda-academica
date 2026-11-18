# Spec Delta

## Purpose

Da a cada estudiante un asistente que responde sus dudas académicas y administrativas con los documentos oficiales de la Fundación y con sus propios datos, citando la fuente y sin inventar información.

## ADDED Requirements

### Requirement: Disponible solo para estudiantes con acceso
El sistema SHALL ofrecer el asistente a estudiantes con sesión válida y MUST aplicar las mismas reglas de autenticación y bloqueo por mora que el resto de la plataforma.

#### Scenario: Estudiante al día abre el asistente
- **WHEN** un estudiante al día abre el asistente
- **THEN** puede escribir preguntas y recibir respuestas

#### Scenario: Petición sin sesión
- **WHEN** se llama al asistente sin sesión válida
- **THEN** el sistema responde no autenticado

### Requirement: Respuestas basadas en documentos oficiales
Para preguntas sobre normas, fechas o programas, el asistente SHALL responder solo con información de los fragmentos recuperados de la base de conocimiento aplicables al estudiante (generales o de su carrera).

#### Scenario: Pregunta sobre la nota mínima
- **WHEN** el estudiante pregunta cuál es la nota mínima para aprobar
- **THEN** el asistente responde con la nota que dice el reglamento y cita el reglamento

#### Scenario: Plan de estudios de otra carrera
- **WHEN** un estudiante pregunta por un documento que solo aplica a otra carrera
- **THEN** el asistente no usa ese documento en su respuesta

### Requirement: Citas de las fuentes
Cada respuesta basada en documentos MUST indicar el título del documento y de la sección usados; la interfaz SHALL mostrar esas fuentes junto a la respuesta.

#### Scenario: Respuesta con fuente
- **WHEN** el asistente responde una pregunta sobre entregas tardías
- **THEN** la respuesta muestra "Reglamento estudiantil – Entregas de talleres" como fuente

### Requirement: Reconocer cuando no sabe
Si no recupera información suficiente para responder, el asistente MUST decir que no tiene esa información y remitir al contacto de la Fundación, y MUST NOT inventar datos, fechas, valores ni normas.

#### Scenario: Pregunta sin respuesta en los documentos
- **WHEN** el estudiante pregunta algo que no está en ningún documento, como el horario de la cafetería
- **THEN** el asistente responde que no tiene esa información e indica el contacto de la Fundación

### Requirement: Datos propios del estudiante
El asistente SHALL poder consultar, solo del estudiante que pregunta, sus actividades pendientes, sus notas y su estado de cuenta, obtenidos de la base de datos en el momento de la pregunta, y MUST NOT entregar datos de otros estudiantes.

#### Scenario: ¿Cuánto debo?
- **WHEN** el estudiante pregunta cuánto debe
- **THEN** el asistente responde con el total y las cuotas pendientes de su estado de cuenta actual

#### Scenario: ¿Qué tengo pendiente?
- **WHEN** el estudiante pregunta qué actividades tiene pendientes
- **THEN** el asistente lista las actividades publicadas de sus cursos sin entrega, con su fecha límite

#### Scenario: Pregunta por otro estudiante
- **WHEN** el estudiante pide las notas o la deuda de otra persona
- **THEN** el asistente se niega e indica que solo puede consultar sus propios datos

### Requirement: Solo temas de la Fundación
El asistente MUST NOT responder preguntas ajenas a la vida académica y administrativa del estudiante en la Fundación, ni hacer las actividades por el estudiante.

#### Scenario: Pregunta ajena
- **WHEN** el estudiante pide una receta de cocina
- **THEN** el asistente responde que solo ayuda con temas de la Fundación

#### Scenario: Pedir que resuelva el taller
- **WHEN** el estudiante pide que el asistente le resuelva un taller
- **THEN** el asistente se niega a resolverlo y puede explicarle qué dice el reglamento sobre entregas

#### Scenario: Pedir que explique un tema de un curso
- **WHEN** el estudiante pide que le explique un tema de un curso que no está en los documentos de la Fundación, como "¿qué es un arreglo?"
- **THEN** el asistente responde que no tiene esa información y no lo explica con conocimiento propio del modelo

### Requirement: Privacidad de los datos enviados al modelo
El sistema MUST NOT enviar al modelo de lenguaje el número de documento, el correo ni el celular del estudiante, ni datos de otros estudiantes. La pantalla del asistente SHALL recordar al estudiante que no escriba datos personales en sus preguntas, porque lo que escribe sí se envía al modelo.

#### Scenario: Revisión de lo enviado al modelo
- **WHEN** se inspecciona el contenido enviado al modelo en una conversación
- **THEN** no aparece el documento, el correo ni el celular del estudiante

#### Scenario: Aviso de no escribir datos personales
- **WHEN** el estudiante abre el asistente
- **THEN** la pantalla le recuerda no escribir datos personales como su número de documento o su celular

### Requirement: Historial guardado en el servidor
El sistema SHALL guardar en el servidor los mensajes de cada conversación y SHALL usar como contexto solo los últimos turnos guardados del propio estudiante; MUST NOT aceptar como historial turnos enviados por el cliente.

#### Scenario: Pregunta de seguimiento
- **WHEN** el estudiante pregunta cuánto debe y luego pregunta "¿y cuándo vence la próxima?"
- **THEN** el asistente entiende la segunda pregunta usando los turnos anteriores guardados

#### Scenario: Turnos inventados por el cliente
- **WHEN** una petición incluye un supuesto mensaje previo del asistente que nunca se guardó
- **THEN** el sistema lo ignora y usa solo el historial guardado en el servidor

### Requirement: Límite diario de preguntas
El sistema SHALL permitir a cada estudiante un máximo de 30 preguntas por día, contado en la zona horaria de Colombia, y MUST NOT consultar el modelo cuando se alcanza el límite.

#### Scenario: Límite alcanzado
- **WHEN** un estudiante que ya hizo 30 preguntas hoy hace otra
- **THEN** el sistema no consulta el modelo e indica que podrá preguntar de nuevo mañana

### Requirement: Servicio de IA no disponible
Si el modelo de lenguaje o la búsqueda de documentos fallan, por ejemplo porque se agotó la cuota del día, el sistema SHALL indicar al estudiante que el asistente no está disponible por ahora y que lo intente más tarde. El sistema MUST NOT inventar ni completar una respuesta, y MUST NOT contar esa pregunta para el límite diario.

#### Scenario: El modelo no responde
- **WHEN** el estudiante hace una pregunta y el servicio de IA falla
- **THEN** el asistente indica que no está disponible por ahora y que lo intente más tarde, sin dar una respuesta

#### Scenario: La pregunta fallida no cuenta para el límite
- **WHEN** una pregunta no obtuvo respuesta porque el servicio de IA falló
- **THEN** esa pregunta no cuenta para las 30 preguntas del día del estudiante

### Requirement: Retención limitada de las conversaciones
El sistema MUST eliminar los mensajes del asistente con más de 30 días de antigüedad y SHALL permitir al estudiante borrar su historial cuando quiera.

#### Scenario: Mensajes antiguos
- **WHEN** un mensaje cumple más de 30 días
- **THEN** el sistema lo elimina en la siguiente depuración diaria

#### Scenario: El estudiante borra su historial
- **WHEN** el estudiante elige borrar su conversación
- **THEN** sus mensajes se eliminan y el asistente empieza una conversación nueva
