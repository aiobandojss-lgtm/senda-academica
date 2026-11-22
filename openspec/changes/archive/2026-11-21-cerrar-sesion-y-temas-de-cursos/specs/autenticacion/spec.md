## MODIFIED Requirements

### Requirement: Cierre y expiración de sesión
El sistema SHALL permitir cerrar sesión y SHALL expirar cada sesión 8 horas después del ingreso.

#### Scenario: Cerrar sesión
- **WHEN** el usuario pulsa "Cerrar sesión"
- **THEN** la sesión deja de ser válida en el servidor, aunque alguien hubiera copiado la cookie antes, y vuelve a la pantalla de ingreso

#### Scenario: Sesión vencida
- **WHEN** un usuario hace una petición con una sesión iniciada hace más de 8 horas
- **THEN** el sistema responde como no autenticado y pide ingresar de nuevo

### Requirement: Invalidación de sesiones abiertas
El sistema MUST invalidar las sesiones abiertas de un usuario cuando el administrador restablece su contraseña o lo desactiva, y cuando el usuario cierra sesión; y las demás sesiones del usuario cuando él cambia su contraseña. Una sesión que ya no es válida MUST NOT poder invalidar las sesiones vigentes.

#### Scenario: Usuario desactivado con sesión abierta
- **WHEN** el administrador desactiva a un usuario que tiene una sesión abierta
- **THEN** la siguiente petición de esa sesión responde no autenticado

#### Scenario: Restablecimiento con sesión abierta
- **WHEN** el administrador restablece la contraseña de un usuario que tiene una sesión abierta
- **THEN** la siguiente petición de esa sesión responde no autenticado

#### Scenario: Cambio de contraseña desde otro equipo
- **WHEN** un usuario con sesiones abiertas en dos equipos cambia su contraseña en uno de ellos
- **THEN** la sesión del otro equipo responde no autenticado en su siguiente petición

#### Scenario: Cierre de sesión desde otro equipo
- **WHEN** un usuario con sesiones abiertas en dos equipos cierra sesión en uno de ellos
- **THEN** la sesión del otro equipo responde no autenticado en su siguiente petición

#### Scenario: Cierre con una sesión que ya no es válida
- **WHEN** alguien pide cerrar sesión con una sesión que ya fue invalidada (por ejemplo, una copia de antes de un cambio de contraseña)
- **THEN** el sistema responde como un cierre normal y las sesiones vigentes del usuario siguen funcionando
