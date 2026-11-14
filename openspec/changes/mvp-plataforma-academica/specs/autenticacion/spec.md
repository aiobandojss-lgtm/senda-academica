# Spec Delta

## Purpose

Permite que administradores, docentes y estudiantes entren a la plataforma con su propio usuario y contraseña, y que cada rol vea y haga solo lo que le corresponde.

## ADDED Requirements

### Requirement: Inicio de sesión con documento y contraseña
El sistema SHALL autenticar a cada usuario con su número de documento como usuario y una contraseña personal, y SHALL rechazar credenciales inválidas con un mensaje genérico que no revele si el documento existe.

#### Scenario: Credenciales correctas
- **WHEN** un usuario activo ingresa su documento y su contraseña correcta
- **THEN** el sistema inicia la sesión y lo lleva a la pantalla de inicio de su rol

#### Scenario: Contraseña incorrecta
- **WHEN** un usuario ingresa un documento existente con una contraseña incorrecta
- **THEN** el sistema muestra "Documento o contraseña incorrectos" y no inicia sesión

#### Scenario: Documento inexistente
- **WHEN** alguien ingresa un documento que no está registrado
- **THEN** el sistema muestra el mismo mensaje "Documento o contraseña incorrectos"

#### Scenario: Usuario inactivo
- **WHEN** un usuario marcado como inactivo ingresa credenciales correctas
- **THEN** el sistema no inicia sesión y le indica que su cuenta está inactiva

### Requirement: Almacenamiento seguro de contraseñas
El sistema MUST guardar las contraseñas solo como hash con sal y MUST NOT guardarlas ni registrarlas en texto plano.

#### Scenario: Revisión de la base de datos
- **WHEN** se consulta la tabla de usuarios
- **THEN** ninguna columna contiene la contraseña en texto plano

### Requirement: Cambio de contraseña en el primer ingreso
El sistema SHALL obligar a cambiar la contraseña inicial antes de usar la plataforma cuando el usuario fue creado con una contraseña temporal. La nueva contraseña MUST tener al menos 8 caracteres.

#### Scenario: Primer ingreso con contraseña temporal
- **WHEN** un usuario con contraseña temporal inicia sesión
- **THEN** el sistema le muestra solo la pantalla de cambio de contraseña hasta que la cambie

#### Scenario: Contraseña nueva muy corta
- **WHEN** el usuario intenta poner una contraseña de menos de 8 caracteres
- **THEN** el sistema rechaza el cambio e indica el mínimo

### Requirement: Restablecimiento por el administrador
El sistema SHALL permitir al administrador asignar una contraseña temporal a cualquier usuario, lo que obliga a cambiarla en el siguiente ingreso.

#### Scenario: Estudiante olvidó su contraseña
- **WHEN** el administrador restablece la contraseña de un estudiante
- **THEN** el sistema genera una contraseña temporal, la muestra una sola vez al administrador y marca al usuario para cambiarla

### Requirement: Cierre y expiración de sesión
El sistema SHALL permitir cerrar sesión y SHALL expirar las sesiones inactivas después de 8 horas.

#### Scenario: Cerrar sesión
- **WHEN** el usuario pulsa "Cerrar sesión"
- **THEN** la sesión deja de ser válida y vuelve a la pantalla de ingreso

#### Scenario: Sesión vencida
- **WHEN** un usuario hace una petición con una sesión de más de 8 horas
- **THEN** el sistema responde como no autenticado y pide ingresar de nuevo

### Requirement: Permisos por rol
El sistema MUST aplicar los permisos en el servidor: el administrador gestiona todo; el docente gestiona actividades y calificaciones solo de sus cursos; el estudiante ve solo sus cursos, sus entregas y su estado de cuenta.

#### Scenario: Estudiante intenta ver datos de otro
- **WHEN** un estudiante pide el estado de cuenta o las entregas de otro estudiante
- **THEN** el sistema responde acceso denegado

#### Scenario: Docente intenta calificar un curso ajeno
- **WHEN** un docente intenta calificar una entrega de un curso que no tiene asignado
- **THEN** el sistema responde acceso denegado

#### Scenario: Petición sin sesión
- **WHEN** se llama a cualquier operación protegida sin sesión válida
- **THEN** el sistema responde no autenticado
