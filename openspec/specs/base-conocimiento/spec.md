# base-conocimiento Specification

## Purpose

Mantiene los documentos oficiales de la Fundación que el asistente puede usar como fuente, de forma que lo que responde siempre provenga de un texto aprobado y actualizado.

## Requirements

### Requirement: Carga de documentos
El sistema SHALL permitir al administrador cargar un documento en formato Markdown o texto plano con título, tipo (reglamento, calendario, plan de estudios, preguntas frecuentes u otro) y, opcionalmente, la carrera a la que aplica.

#### Scenario: Cargar reglamento
- **WHEN** el administrador carga el reglamento estudiantil como documento general
- **THEN** el documento queda registrado y disponible para el asistente de todas las carreras

#### Scenario: Documento de una carrera
- **WHEN** el administrador carga el plan de estudios asociado a una carrera
- **THEN** el asistente solo usa ese documento para estudiantes de esa carrera

### Requirement: Indexación en fragmentos
El sistema SHALL dividir cada documento en fragmentos que respeten sus títulos y secciones e indexarlos para búsqueda semántica, guardando para cada fragmento el título del documento y de la sección de donde proviene.

#### Scenario: Documento indexado
- **WHEN** termina la carga de un documento
- **THEN** el administrador ve el número de fragmentos indexados

### Requirement: Actualización y retiro
El sistema SHALL permitir reemplazar el contenido de un documento o retirarlo; al hacerlo, MUST eliminar sus fragmentos anteriores del índice para que el asistente no use información desactualizada.

#### Scenario: Reemplazar calendario
- **WHEN** el administrador reemplaza el calendario académico
- **THEN** el asistente responde con las fechas nuevas y nunca con las anteriores

#### Scenario: Retirar documento
- **WHEN** el administrador retira un documento
- **THEN** ninguna respuesta posterior lo cita como fuente

### Requirement: Solo administradores gestionan la base
El sistema MUST permitir cargar, reemplazar y retirar documentos solo al administrador.

#### Scenario: Estudiante intenta cargar un documento
- **WHEN** un estudiante llama a la operación de carga
- **THEN** el sistema responde acceso denegado
