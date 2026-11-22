## MODIFIED Requirements

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
- **THEN** el asistente no lo explica con conocimiento propio del modelo: responde que no tiene esa información o que solo ayuda con temas de la Fundación
