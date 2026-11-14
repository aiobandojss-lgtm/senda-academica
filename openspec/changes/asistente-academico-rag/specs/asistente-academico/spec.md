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
- **THEN** la respuesta muestra "Reglamento estudiantil – Entregas" como fuente

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

### Requirement: Privacidad de los datos enviados al modelo
El sistema MUST NOT enviar al modelo de lenguaje el número de documento, el correo ni el celular del estudiante, ni datos de otros estudiantes.

#### Scenario: Revisión de lo enviado al modelo
- **WHEN** se inspecciona el contenido enviado al modelo en una conversación
- **THEN** no aparece el documento, el correo ni el celular del estudiante
