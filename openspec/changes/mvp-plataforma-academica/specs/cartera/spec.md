# Spec Delta

## Purpose

Lleva el control de lo que cada estudiante debe y ha pagado a la Fundación, con un plan de cuotas, el registro de pagos y un estado de cuenta que sirve de base al bloqueo por mora.

## ADDED Requirements

### Requirement: Plan de cuotas
El sistema SHALL permitir al administrador generar el plan de cuotas de un estudiante indicando concepto, valor por cuota en pesos colombianos, número de cuotas y fecha del primer vencimiento, con vencimientos mensuales el mismo día.

#### Scenario: Generar seis cuotas
- **WHEN** el administrador genera 6 cuotas de 180.000 desde el 5 de agosto
- **THEN** el estudiante queda con 6 cuotas que vencen el día 5 de agosto a enero

### Requirement: Cuotas individuales
El sistema SHALL permitir al administrador agregar una cuota individual (por ejemplo, la matrícula) y editar el valor o la fecha, o eliminar, una cuota que no tenga pagos registrados. Una cuota con pagos registrados, incluidos los anulados, MUST NOT poder editarse ni eliminarse, para conservar el historial.

#### Scenario: Editar cuota con pagos
- **WHEN** el administrador intenta cambiar el valor de una cuota que ya tiene pagos
- **THEN** el sistema rechaza el cambio

#### Scenario: Eliminar cuota creada por error
- **WHEN** el administrador elimina una cuota que no tiene pagos registrados
- **THEN** la cuota desaparece del plan del estudiante y deja de contar para su saldo

#### Scenario: Eliminar cuota con pagos
- **WHEN** el administrador intenta eliminar una cuota que tiene un pago, aunque esté anulado
- **THEN** el sistema rechaza la eliminación

### Requirement: Registro de pagos
El sistema SHALL permitir al administrador registrar pagos totales o parciales a una cuota, con fecha, valor, medio de pago (efectivo, transferencia o consignación) y soporte opcional. El valor MUST ser mayor que cero y MUST NOT superar el saldo de la cuota.

#### Scenario: Pago total
- **WHEN** el administrador registra un pago igual al saldo de la cuota
- **THEN** la cuota queda pagada con saldo cero

#### Scenario: Pago parcial
- **WHEN** el administrador registra 100.000 a una cuota de 180.000
- **THEN** la cuota queda con saldo 80.000

#### Scenario: Pago mayor al saldo
- **WHEN** el administrador registra un pago mayor al saldo
- **THEN** el sistema rechaza el pago e indica el saldo actual

### Requirement: Anulación de pagos
El sistema SHALL permitir al administrador anular un pago registrado por error indicando un motivo; el pago anulado MUST conservarse en el historial y MUST NOT contar para el saldo. Un pago registrado MUST NOT poder modificarse ni volver a activarse: la única corrección permitida es anularlo y registrar uno nuevo.

#### Scenario: Anular pago
- **WHEN** el administrador anula un pago con el motivo "valor errado"
- **THEN** el saldo de la cuota vuelve a incluir ese valor y el pago aparece como anulado

#### Scenario: Intentar modificar un pago
- **WHEN** se intenta cambiar el valor o la fecha de un pago ya registrado
- **THEN** el sistema rechaza el cambio

### Requirement: Estado de cuenta
El sistema SHALL mostrar a cada estudiante y al administrador el estado de cuenta: cada cuota con vencimiento, valor, pagado, saldo y estado (pagada, pendiente o vencida con días de atraso), más el total adeudado.

#### Scenario: Estudiante consulta su estado
- **WHEN** un estudiante abre su estado de cuenta
- **THEN** ve sus cuotas con saldo y estado y el total que debe

### Requirement: Resumen de cartera
El sistema SHALL mostrar al administrador el total recaudado del mes, el total vencido y el listado de estudiantes con cuotas vencidas ordenado por días de atraso.

#### Scenario: Ver estudiantes en mora
- **WHEN** el administrador abre el resumen de cartera
- **THEN** ve primero a los estudiantes con más días de atraso
