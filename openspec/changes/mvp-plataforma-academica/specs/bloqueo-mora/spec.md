# Spec Delta

## Purpose

Impide que un estudiante use la plataforma cuando tiene una cuota con más de 30 días de vencida, y lo reactiva apenas se pone al día o el administrador autoriza una excepción.

## ADDED Requirements

### Requirement: Regla de bloqueo
El sistema SHALL considerar bloqueado a un estudiante cuando tiene al menos una cuota con saldo mayor que cero y han pasado más de 30 días desde su vencimiento, contados en la zona horaria de Colombia (America/Bogota).

#### Scenario: 31 días de atraso
- **WHEN** una cuota con saldo vence el 5 de octubre y hoy es 5 de noviembre
- **THEN** el estudiante está bloqueado

#### Scenario: Exactamente 30 días de atraso
- **WHEN** una cuota con saldo vence el 6 de octubre y hoy es 5 de noviembre
- **THEN** el estudiante no está bloqueado y su estado es "en riesgo"

#### Scenario: Pago parcial no desbloquea
- **WHEN** la cuota vencida hace 40 días tiene un pago parcial y aún tiene saldo
- **THEN** el estudiante sigue bloqueado

#### Scenario: Cuotas al día
- **WHEN** ninguna cuota vencida tiene saldo
- **THEN** el estudiante está "al día"

### Requirement: Estados de cartera
El sistema SHALL clasificar a cada estudiante en uno de cuatro estados de cartera: "al día" (ninguna cuota vencida con saldo), "en riesgo" (alguna cuota vencida con saldo, ninguna con más de 30 días), "bloqueado" (cumple la regla de bloqueo sin excepción vigente) o "con excepción" (cumple la regla de bloqueo pero tiene una excepción vigente). Solo el estado "bloqueado" MUST impedir el acceso.

#### Scenario: Estudiante en mora con excepción
- **WHEN** un estudiante cumple la regla de bloqueo y tiene una excepción vigente
- **THEN** su estado es "con excepción" y puede ingresar

#### Scenario: Estudiante en riesgo
- **WHEN** la única cuota vencida con saldo de un estudiante venció hace 10 días
- **THEN** su estado es "en riesgo" y puede ingresar

### Requirement: Estudiante bloqueado no puede ingresar
El sistema MUST impedir el ingreso de un estudiante bloqueado y SHALL mostrarle un mensaje que indique que su acceso está suspendido por mora y cómo comunicarse con la Fundación.

#### Scenario: Intento de ingreso bloqueado
- **WHEN** un estudiante bloqueado ingresa credenciales correctas
- **THEN** el sistema no inicia sesión y muestra el mensaje de acceso suspendido con el contacto de la Fundación

### Requirement: Verificación en cada petición
El sistema MUST verificar el bloqueo en cada petición de un estudiante con sesión abierta, para que una mora que se cumple durante la sesión cierre el acceso.

#### Scenario: Se cumple la mora con la sesión abierta
- **WHEN** un estudiante tiene sesión abierta y su cuota pasa a más de 30 días de atraso
- **THEN** su siguiente petición es rechazada con el mensaje de acceso suspendido

### Requirement: Desbloqueo inmediato al pagar
El sistema SHALL desbloquear al estudiante en cuanto ninguna de sus cuotas cumpla la regla de bloqueo, sin intervención adicional.

#### Scenario: Pago que salda la cuota
- **WHEN** el administrador registra el pago que deja en cero la única cuota en mora
- **THEN** el estudiante puede ingresar de inmediato

### Requirement: Excepciones autorizadas
El sistema SHALL permitir al administrador crear una excepción para un estudiante con motivo y fecha final; mientras esté vigente, el estudiante MUST poder ingresar aunque cumpla la regla de bloqueo.

#### Scenario: Acuerdo de pago
- **WHEN** el administrador crea una excepción hasta el 30 de noviembre con motivo "acuerdo de pago"
- **THEN** el estudiante puede ingresar hasta esa fecha inclusive

#### Scenario: Excepción vencida
- **WHEN** la fecha final de la excepción ya pasó y la mora sigue
- **THEN** el estudiante vuelve a estar bloqueado

### Requirement: El bloqueo solo aplica a estudiantes
El sistema MUST NOT bloquear a administradores ni a docentes por esta regla.

#### Scenario: Docente sin cuotas
- **WHEN** un docente inicia sesión
- **THEN** el sistema no evalúa la regla de mora
