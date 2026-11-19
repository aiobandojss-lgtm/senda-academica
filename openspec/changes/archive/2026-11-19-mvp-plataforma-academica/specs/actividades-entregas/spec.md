# Spec Delta

## Purpose

Permite que los docentes publiquen talleres y evaluaciones, que los estudiantes entreguen sus trabajos en línea y que los docentes los califiquen, dejando la nota en el registro del estudiante.

## ADDED Requirements

### Requirement: Publicación de actividades
El sistema SHALL permitir al docente crear en sus cursos actividades de tipo taller o evaluación, con título, instrucciones, fecha límite y archivo de apoyo opcional. Solo las actividades publicadas MUST ser visibles para los estudiantes.

#### Scenario: Publicar taller
- **WHEN** el docente crea un taller y lo publica
- **THEN** los estudiantes del curso lo ven con su fecha límite

#### Scenario: Borrador no visible
- **WHEN** el docente guarda una actividad sin publicarla
- **THEN** ningún estudiante la ve

#### Scenario: Archivo de apoyo
- **WHEN** el docente adjunta a una actividad publicada un archivo de apoyo
- **THEN** los estudiantes del curso lo pueden descargar

### Requirement: Edición de actividades
El sistema SHALL permitir al docente editar el tipo, el título, las instrucciones, la fecha límite y el archivo de apoyo de sus actividades, y devolver a borrador una actividad publicada solo mientras no tenga entregas. La fecha límite SHALL escribirse y mostrarse en hora de Colombia (America/Bogota) y guardarse en UTC.

#### Scenario: Volver a borrador sin entregas
- **WHEN** el docente devuelve a borrador una actividad publicada que nadie ha entregado
- **THEN** la actividad deja de ser visible para los estudiantes

#### Scenario: Volver a borrador con entregas
- **WHEN** el docente intenta devolver a borrador una actividad que ya tiene entregas
- **THEN** el sistema lo rechaza e indica que ya hay entregas

#### Scenario: Fecha límite en hora de Colombia
- **WHEN** el docente fija la fecha límite a las 11:59 p. m. del 23 de noviembre
- **THEN** la actividad vence a las 11:59 p. m. del 23 de noviembre en Colombia (4:59 a. m. del 24 en UTC)

### Requirement: Entrega de archivos
El sistema SHALL permitir al estudiante subir un archivo por actividad en formato PDF, DOCX, JPG o PNG de hasta 10 MB. El sistema MUST verificar el formato por el contenido del archivo (sus primeros bytes) y no solo por su extensión.

#### Scenario: Entrega válida
- **WHEN** el estudiante sube un PDF de 2 MB a una actividad publicada
- **THEN** el sistema guarda la entrega con fecha y hora y la muestra como entregada

#### Scenario: Archivo demasiado grande
- **WHEN** el estudiante sube un archivo de más de 10 MB
- **THEN** el sistema rechaza el archivo e indica el límite

#### Scenario: Formato no permitido
- **WHEN** el estudiante sube un archivo con otro formato
- **THEN** el sistema rechaza el archivo e indica los formatos permitidos

#### Scenario: Archivo renombrado
- **WHEN** el estudiante sube un archivo cuyo contenido no corresponde a su extensión, por ejemplo un ejecutable renombrado como .pdf
- **THEN** el sistema rechaza el archivo e indica los formatos permitidos

### Requirement: Reemplazo de la entrega
El sistema SHALL permitir al estudiante reemplazar su entrega mientras no haya sido calificada, y MUST NOT permitirlo después de calificada. Al reemplazarla, el sistema MUST eliminar el archivo anterior del almacenamiento.

#### Scenario: Reemplazar antes de la nota
- **WHEN** el estudiante sube un archivo nuevo a una actividad aún sin calificar
- **THEN** el nuevo archivo reemplaza al anterior, el archivo anterior se elimina del almacenamiento y se actualiza la fecha de entrega

#### Scenario: Intentar reemplazar después de la nota
- **WHEN** el estudiante intenta subir un archivo a una actividad ya calificada
- **THEN** el sistema rechaza el cambio

### Requirement: Entregas tardías
El sistema SHALL aceptar entregas después de la fecha límite y SHALL marcarlas como tardías comparando la fecha de entrega con la fecha límite vigente de la actividad, de modo que un cambio de la fecha límite se refleje en la marca.

#### Scenario: Entrega fuera de plazo
- **WHEN** el estudiante entrega después de la fecha límite
- **THEN** la entrega queda guardada con la marca "tardía", visible para el docente

#### Scenario: El docente amplía el plazo
- **WHEN** el docente amplía la fecha límite de una actividad hasta una fecha posterior a una entrega marcada como tardía
- **THEN** esa entrega deja de aparecer como tardía

### Requirement: Seguimiento de entregas por el docente
El sistema SHALL mostrar al docente, por actividad, la lista de estudiantes del curso (nombres y apellidos) con su estado: sin entregar, entregada, tardía o calificada, y permitirle descargar cada archivo.

#### Scenario: Revisar quién entregó
- **WHEN** el docente abre una actividad
- **THEN** ve a todos los estudiantes del curso con el estado de su entrega

### Requirement: Calificación
El sistema SHALL permitir al docente registrar una nota entre 0.0 y 5.0, con un decimal, y un comentario opcional por entrega, y corregirlos después; el estudiante MUST ver su nota y comentario. Corregir la nota no habilita reemplazar la entrega.

#### Scenario: Calificar entrega
- **WHEN** el docente registra nota 4.2 y un comentario
- **THEN** el estudiante ve la nota 4.2 y el comentario en esa actividad

#### Scenario: Nota fuera de rango
- **WHEN** el docente registra una nota de 5.5
- **THEN** el sistema rechaza la nota e indica el rango 0.0 a 5.0

#### Scenario: Corregir una nota
- **WHEN** el docente cambia una nota de 4.2 a 4.5 porque se equivocó al digitarla
- **THEN** el estudiante ve la nota 4.5 y su entrega sigue sin poder reemplazarse

### Requirement: Acceso privado a los archivos
Los archivos entregados MUST ser accesibles solo para su autor, el docente del curso y el administrador. El archivo de apoyo de una actividad MUST ser accesible solo para el docente del curso, el administrador y, si la actividad está publicada, los estudiantes inscritos en el curso.

#### Scenario: Estudiante intenta descargar la entrega de otro
- **WHEN** un estudiante pide el archivo de la entrega de otro estudiante
- **THEN** el sistema responde acceso denegado

#### Scenario: Estudiante de otro curso pide un archivo de apoyo
- **WHEN** un estudiante que no está inscrito en el curso pide el archivo de apoyo de una de sus actividades
- **THEN** el sistema responde acceso denegado
