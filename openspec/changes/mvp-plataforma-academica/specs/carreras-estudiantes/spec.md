# Spec Delta

## Purpose

Mantiene el catálogo de carreras y cursos de la Fundación y el registro de sus estudiantes y docentes, para saber en todo momento quién estudia qué y quién enseña cada curso.

## ADDED Requirements

### Requirement: Catálogo de carreras
El sistema SHALL permitir al administrador crear, editar y desactivar carreras con código único, nombre, descripción y duración en semestres. Una carrera con estudiantes MUST NOT poder eliminarse, solo desactivarse.

#### Scenario: Crear carrera
- **WHEN** el administrador crea una carrera con un código que no existe
- **THEN** la carrera queda disponible para asignar estudiantes y cursos

#### Scenario: Código repetido
- **WHEN** el administrador crea una carrera con un código ya usado
- **THEN** el sistema rechaza la operación e indica que el código existe

#### Scenario: Desactivar carrera con estudiantes
- **WHEN** el administrador desactiva una carrera que tiene estudiantes
- **THEN** la carrera deja de aparecer para nuevas asignaciones y sus estudiantes conservan su información

### Requirement: Cursos por carrera
El sistema SHALL permitir al administrador crear cursos dentro de una carrera activa, con nombre, semestre y un docente activo asignado. El semestre del curso MUST estar entre 1 y la duración en semestres de su carrera.

#### Scenario: Asignar docente a un curso
- **WHEN** el administrador asigna un docente a un curso
- **THEN** el curso aparece en la lista de cursos de ese docente

#### Scenario: Semestre fuera de la carrera
- **WHEN** el administrador crea un curso de sexto semestre en una carrera de cuatro semestres
- **THEN** el sistema rechaza el curso e indica los semestres válidos de esa carrera

#### Scenario: Carrera desactivada
- **WHEN** el administrador crea un curso en una carrera desactivada
- **THEN** el sistema rechaza el curso e indica que la carrera no está activa

#### Scenario: Docente desactivado
- **WHEN** el administrador asigna a un curso un docente desactivado
- **THEN** el sistema rechaza la asignación e indica que el docente no está activo

### Requirement: Edición de cursos
El sistema SHALL permitir al administrador editar el nombre, el docente y el estado (activo o inactivo) de un curso. La carrera y el semestre de un curso MUST NOT cambiar después de crearlo, para que las inscripciones automáticas no queden incoherentes.

#### Scenario: Cambiar el semestre de un curso
- **WHEN** el administrador intenta cambiar la carrera o el semestre de un curso ya creado
- **THEN** el sistema no lo permite; para corregirlo, el administrador desactiva el curso y crea otro

### Requirement: Registro de estudiantes
El sistema SHALL registrar cada estudiante con tipo y número de documento, nombres, apellidos, correo, celular opcional, carrera, semestre actual y fecha de ingreso. El número de documento MUST ser único entre todos los usuarios.

#### Scenario: Registrar estudiante nuevo
- **WHEN** el administrador registra un estudiante con un documento no registrado
- **THEN** el estudiante queda creado con usuario igual a su documento y una contraseña temporal aleatoria que se muestra una sola vez al administrador

#### Scenario: Documento duplicado
- **WHEN** el administrador registra un estudiante con un documento ya existente
- **THEN** el sistema rechaza el registro e indica el documento repetido

### Requirement: Inscripción automática en los cursos
El sistema SHALL mantener a cada estudiante activo inscrito en los cursos activos de su carrera correspondientes a su semestre actual: al registrarlo, al cambiar su semestre actual, al crear un curso nuevo y al reactivar un curso. Al cambiar de semestre, el sistema MUST conservar las inscripciones anteriores para no perder el historial de entregas y notas.

#### Scenario: Estudiante de primer semestre
- **WHEN** se registra un estudiante en primer semestre de una carrera
- **THEN** el estudiante ve todos los cursos de primer semestre de esa carrera

#### Scenario: Curso creado después de registrar a los estudiantes
- **WHEN** el administrador crea un curso de primer semestre en una carrera que ya tiene estudiantes activos de primer semestre
- **THEN** esos estudiantes quedan inscritos en el curso nuevo

#### Scenario: Cambio de semestre
- **WHEN** el administrador cambia el semestre actual de un estudiante de 1 a 2
- **THEN** el estudiante queda inscrito en los cursos de segundo semestre y conserva sus entregas y notas de primer semestre

#### Scenario: Curso reactivado
- **WHEN** el administrador reactiva un curso de primer semestre y la carrera tiene estudiantes activos de primer semestre que no estaban inscritos
- **THEN** esos estudiantes quedan inscritos y los que ya estaban inscritos conservan su inscripción

### Requirement: Consulta y búsqueda de estudiantes
El sistema SHALL permitir al administrador listar estudiantes, buscarlos por nombre o documento y filtrarlos por carrera y por estado de cartera (al día, en riesgo, bloqueado o con excepción).

#### Scenario: Buscar por documento
- **WHEN** el administrador busca un número de documento
- **THEN** el sistema muestra el estudiante con ese documento

#### Scenario: Filtrar bloqueados
- **WHEN** el administrador filtra por estado "bloqueado"
- **THEN** el sistema muestra solo estudiantes con acceso bloqueado por mora

#### Scenario: Filtrar con excepción
- **WHEN** el administrador filtra por estado "con excepción"
- **THEN** el sistema muestra solo estudiantes que cumplen la regla de bloqueo pero tienen una excepción vigente

### Requirement: Carga masiva desde CSV
El sistema SHALL permitir cargar estudiantes desde un archivo CSV con una plantilla descargable, validar todas las filas antes de guardar y SHALL NOT guardar ninguna fila si alguna tiene errores. Cada estudiante creado SHALL recibir una contraseña temporal aleatoria; el sistema SHALL entregar al administrador, una sola vez, un archivo con el documento y la contraseña temporal de cada estudiante creado, y MUST NOT guardar esas contraseñas en texto plano.

#### Scenario: Archivo válido
- **WHEN** el administrador carga un CSV en el que todas las filas son válidas
- **THEN** el sistema crea todos los estudiantes, muestra cuántos se crearon y ofrece descargar el archivo de credenciales iniciales

#### Scenario: Archivo de credenciales no recuperable
- **WHEN** el administrador cierra la pantalla de resultados sin descargar el archivo de credenciales
- **THEN** el sistema no puede volver a mostrar esas contraseñas y el administrador debe restablecerlas una por una

#### Scenario: Archivo con errores
- **WHEN** el CSV tiene filas con documento repetido, carrera inexistente o correo inválido
- **THEN** el sistema no guarda nada y muestra cada error con su número de fila

### Requirement: Registro de docentes
El sistema SHALL permitir al administrador registrar docentes con documento, nombres, apellidos y correo, con las mismas reglas de documento único y contraseña temporal.

#### Scenario: Registrar docente
- **WHEN** el administrador registra un docente nuevo
- **THEN** el docente puede iniciar sesión y ser asignado a cursos

### Requirement: Desactivar y reactivar usuarios
El sistema SHALL permitir al administrador desactivar y reactivar estudiantes y docentes. Un usuario desactivado MUST NOT poder ingresar y sus sesiones abiertas MUST quedar invalidadas; su información, entregas, notas y pagos MUST conservarse. Los cursos de un docente desactivado SHALL conservarlo como docente asignado hasta que el administrador asigne otro.

#### Scenario: Docente desactivado con cursos
- **WHEN** el administrador desactiva a un docente que tiene cursos asignados
- **THEN** el docente no puede ingresar, sus cursos conservan las actividades y calificaciones, y el administrador puede asignarles otro docente

#### Scenario: Estudiante retirado
- **WHEN** el administrador desactiva a un estudiante que se retiró
- **THEN** el estudiante no puede ingresar y su historial académico y de pagos sigue disponible para el administrador

#### Scenario: Reactivar estudiante
- **WHEN** el administrador reactiva a un estudiante desactivado
- **THEN** el estudiante puede volver a ingresar con su contraseña

#### Scenario: Estudiante desactivado fuera de las inscripciones automáticas
- **WHEN** el administrador crea un curso en la carrera y el semestre de un estudiante desactivado
- **THEN** el estudiante desactivado no queda inscrito en el curso nuevo
