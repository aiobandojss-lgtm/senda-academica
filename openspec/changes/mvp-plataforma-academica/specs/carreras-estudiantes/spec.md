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
El sistema SHALL permitir al administrador crear cursos dentro de una carrera, con nombre, semestre y un docente asignado.

#### Scenario: Asignar docente a un curso
- **WHEN** el administrador asigna un docente a un curso
- **THEN** el curso aparece en la lista de cursos de ese docente

### Requirement: Registro de estudiantes
El sistema SHALL registrar cada estudiante con tipo y número de documento, nombres, apellidos, correo, celular opcional, carrera y fecha de ingreso. El número de documento MUST ser único entre todos los usuarios.

#### Scenario: Registrar estudiante nuevo
- **WHEN** el administrador registra un estudiante con un documento no registrado
- **THEN** el estudiante queda creado con usuario igual a su documento y una contraseña temporal

#### Scenario: Documento duplicado
- **WHEN** el administrador registra un estudiante con un documento ya existente
- **THEN** el sistema rechaza el registro e indica el documento repetido

### Requirement: Inscripción automática en los cursos
El sistema SHALL inscribir a cada estudiante en los cursos de su carrera correspondientes a su semestre actual.

#### Scenario: Estudiante de primer semestre
- **WHEN** se registra un estudiante en primer semestre de una carrera
- **THEN** el estudiante ve todos los cursos de primer semestre de esa carrera

### Requirement: Consulta y búsqueda de estudiantes
El sistema SHALL permitir al administrador listar estudiantes, buscarlos por nombre o documento y filtrarlos por carrera y por estado de cartera (al día, en riesgo, bloqueado).

#### Scenario: Buscar por documento
- **WHEN** el administrador busca un número de documento
- **THEN** el sistema muestra el estudiante con ese documento

#### Scenario: Filtrar bloqueados
- **WHEN** el administrador filtra por estado "bloqueado"
- **THEN** el sistema muestra solo estudiantes con acceso bloqueado por mora

### Requirement: Carga masiva desde CSV
El sistema SHALL permitir cargar estudiantes desde un archivo CSV con una plantilla descargable, validar todas las filas antes de guardar y SHALL NOT guardar ninguna fila si alguna tiene errores.

#### Scenario: Archivo válido
- **WHEN** el administrador carga un CSV en el que todas las filas son válidas
- **THEN** el sistema crea todos los estudiantes y muestra cuántos se crearon

#### Scenario: Archivo con errores
- **WHEN** el CSV tiene filas con documento repetido, carrera inexistente o correo inválido
- **THEN** el sistema no guarda nada y muestra cada error con su número de fila

### Requirement: Registro de docentes
El sistema SHALL permitir al administrador registrar docentes con documento, nombres, apellidos y correo, con las mismas reglas de documento único y contraseña temporal.

#### Scenario: Registrar docente
- **WHEN** el administrador registra un docente nuevo
- **THEN** el docente puede iniciar sesión y ser asignado a cursos
