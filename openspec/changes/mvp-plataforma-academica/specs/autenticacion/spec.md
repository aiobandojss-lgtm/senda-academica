# Spec Delta

## Purpose

Permite que administradores, docentes y estudiantes entren a la plataforma con su propio usuario y contraseña, que cada rol vea y haga solo lo que le corresponde, y que el acceso se proteja contra intentos de adivinar contraseñas y contra sesiones que deberían haberse cerrado.

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

### Requirement: Límite de intentos de ingreso
El sistema MUST rechazar los intentos de ingreso de un documento durante 15 minutos después de 5 intentos fallidos con ese documento en los últimos 15 minutos, aunque la contraseña del siguiente intento sea correcta, y MUST NOT revelar con ese mensaje si el documento existe. Un ingreso exitoso SHALL reiniciar el conteo.

#### Scenario: Sexto intento después de cinco fallos
- **WHEN** alguien falla 5 veces seguidas la contraseña de un documento y lo intenta una sexta vez con la contraseña correcta antes de 15 minutos
- **THEN** el sistema no inicia sesión y muestra "Demasiados intentos. Intenta de nuevo en 15 minutos"

#### Scenario: Documento inexistente con muchos intentos
- **WHEN** alguien falla 5 veces con un documento que no está registrado
- **THEN** el sistema responde con el mismo mensaje de demasiados intentos que para un documento existente

#### Scenario: Ingreso exitoso reinicia el conteo
- **WHEN** un usuario falla 3 veces y luego ingresa con su contraseña correcta
- **THEN** el sistema inicia la sesión y el conteo de intentos fallidos de ese documento vuelve a cero

### Requirement: Almacenamiento seguro de contraseñas
El sistema MUST guardar las contraseñas solo como hash con sal y MUST NOT guardarlas ni registrarlas en texto plano, tampoco las contraseñas temporales.

#### Scenario: Revisión de la base de datos
- **WHEN** se consulta la tabla de usuarios
- **THEN** ninguna columna contiene la contraseña en texto plano

### Requirement: Cambio de contraseña en el primer ingreso
El sistema SHALL obligar a cambiar la contraseña inicial antes de usar la plataforma cuando el usuario fue creado o restablecido con una contraseña temporal, y MUST rechazar en el servidor cualquier otra operación mientras no la cambie. La nueva contraseña MUST tener al menos 8 caracteres y MUST NOT ser igual al número de documento.

#### Scenario: Primer ingreso con contraseña temporal
- **WHEN** un usuario con contraseña temporal inicia sesión
- **THEN** el sistema le muestra solo la pantalla de cambio de contraseña hasta que la cambie

#### Scenario: Llamada directa a la API con contraseña temporal
- **WHEN** un usuario que aún no cambió su contraseña temporal llama a otra operación protegida
- **THEN** el sistema responde que debe cambiar la contraseña y no ejecuta la operación

#### Scenario: Contraseña nueva muy corta
- **WHEN** el usuario intenta poner una contraseña de menos de 8 caracteres
- **THEN** el sistema rechaza el cambio e indica el mínimo

#### Scenario: Contraseña igual al documento
- **WHEN** el usuario intenta poner como contraseña su número de documento
- **THEN** el sistema rechaza el cambio e indica que no puede ser igual al documento

### Requirement: Cambio voluntario de contraseña
El sistema SHALL permitir a cualquier usuario con sesión cambiar su contraseña indicando la contraseña actual, con las mismas reglas de longitud y de diferencia con el documento.

#### Scenario: Cambio con la contraseña actual correcta
- **WHEN** un usuario indica su contraseña actual correcta y una nueva válida
- **THEN** el sistema guarda la nueva contraseña y la sesión actual sigue abierta

#### Scenario: Contraseña actual incorrecta
- **WHEN** un usuario indica una contraseña actual incorrecta
- **THEN** el sistema rechaza el cambio

### Requirement: Restablecimiento por el administrador
El sistema SHALL permitir al administrador asignar una contraseña temporal a cualquier usuario, lo que obliga a cambiarla en el siguiente ingreso.

#### Scenario: Estudiante olvidó su contraseña
- **WHEN** el administrador restablece la contraseña de un estudiante
- **THEN** el sistema genera una contraseña temporal aleatoria, la muestra una sola vez al administrador y marca al usuario para cambiarla

### Requirement: Cierre y expiración de sesión
El sistema SHALL permitir cerrar sesión y SHALL expirar cada sesión 8 horas después del ingreso.

#### Scenario: Cerrar sesión
- **WHEN** el usuario pulsa "Cerrar sesión"
- **THEN** la sesión deja de ser válida y vuelve a la pantalla de ingreso

#### Scenario: Sesión vencida
- **WHEN** un usuario hace una petición con una sesión iniciada hace más de 8 horas
- **THEN** el sistema responde como no autenticado y pide ingresar de nuevo

### Requirement: Invalidación de sesiones abiertas
El sistema MUST invalidar las sesiones abiertas de un usuario cuando el administrador restablece su contraseña o lo desactiva, y las demás sesiones del usuario cuando él cambia su contraseña.

#### Scenario: Usuario desactivado con sesión abierta
- **WHEN** el administrador desactiva a un usuario que tiene una sesión abierta
- **THEN** la siguiente petición de esa sesión responde no autenticado

#### Scenario: Restablecimiento con sesión abierta
- **WHEN** el administrador restablece la contraseña de un usuario que tiene una sesión abierta
- **THEN** la siguiente petición de esa sesión responde no autenticado

#### Scenario: Cambio de contraseña desde otro equipo
- **WHEN** un usuario con sesiones abiertas en dos equipos cambia su contraseña en uno de ellos
- **THEN** la sesión del otro equipo responde no autenticado en su siguiente petición

### Requirement: Aceptación del aviso de privacidad
En cumplimiento de la Ley 1581 de 2012, el sistema MUST exigir que cada usuario acepte la versión vigente del aviso de privacidad antes de usar la plataforma, SHALL guardar la versión aceptada y la fecha de aceptación, y MUST rechazar en el servidor cualquier otra operación mientras no la acepte.

#### Scenario: Primer ingreso
- **WHEN** un usuario que nunca ha aceptado el aviso inicia sesión
- **THEN** el sistema le muestra el aviso de privacidad y solo le deja continuar si lo acepta

#### Scenario: No acepta el aviso
- **WHEN** el usuario no acepta el aviso e intenta usar otra operación
- **THEN** el sistema responde que debe aceptar el aviso de privacidad

#### Scenario: Nueva versión del aviso
- **WHEN** la Fundación publica una nueva versión del aviso y un usuario que aceptó la anterior inicia sesión
- **THEN** el sistema le pide aceptar la nueva versión

### Requirement: Permisos por rol
El sistema MUST aplicar los permisos en el servidor: el administrador gestiona todo; el docente gestiona actividades y calificaciones solo de sus cursos; el estudiante ve solo sus cursos, sus entregas y su estado de cuenta. El docente MUST NOT recibir el documento, el correo ni el celular de sus estudiantes.

#### Scenario: Estudiante intenta ver datos de otro
- **WHEN** un estudiante pide el estado de cuenta o las entregas de otro estudiante
- **THEN** el sistema responde acceso denegado

#### Scenario: Docente intenta calificar un curso ajeno
- **WHEN** un docente intenta calificar una entrega de un curso que no tiene asignado
- **THEN** el sistema responde acceso denegado

#### Scenario: Docente consulta sus estudiantes
- **WHEN** un docente consulta la lista de estudiantes de su curso
- **THEN** recibe nombres, apellidos y estado de entregas, sin documento, correo ni celular

#### Scenario: Petición sin sesión
- **WHEN** se llama a cualquier operación protegida sin sesión válida
- **THEN** el sistema responde no autenticado
