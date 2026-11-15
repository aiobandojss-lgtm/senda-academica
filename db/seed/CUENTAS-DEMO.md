# Cuentas de demostración

Datos ficticios generados con fecha de referencia **2026-11-20**. Contraseña de todas las cuentas: `Demo2026*`

| Documento (usuario) | Rol | Nombre | Para qué sirve en la demo |
|---|---|---|---|
| 9900000001 | Administrador | Administración Fundación | Registrar pagos, excepciones y ver cartera |
| 9900000103 | Docente | Liliana Caicedo Riascos | Docente de Técnico Laboral en Programación de Software (cursos de los estudiantes demo) |
| 9900001001 | Estudiante (al día) | Paola Andrea Zapata Arango | Flujo principal de la demo (entrega y nota) |
| 9900001002 | Estudiante (bloqueado) | Manuela Riascos Rojas | Bloqueado: dos cuotas sin pagar |
| 9900001003 | Estudiante (en riesgo) | Angie Paola Muñoz González | Última cuota vencida hace menos de 30 días: puede entrar |
| 9900001004 | Estudiante (con excepción) | Natalia Velásquez Quintero | En mora pero con excepción vigente: puede entrar |
| 9900001005 | Estudiante (bloqueado) | Luisa Fernanda Riascos Hurtado | Bloqueado: abonó parte de la cuota vencida |
| 9900001006 | Estudiante (al día, primer ingreso) | Jhon Fredy Torres Vargas | Primer ingreso: debe cambiar la contraseña temporal y aceptar el aviso de privacidad |

Resumen de los 60 estudiantes en la fecha de referencia: 45 al día, 5 en riesgo, 9 bloqueados, 1 con excepción vigente.

Todas las cuentas ya aceptaron la versión `2026-11` del aviso de privacidad, excepto la de primer ingreso (la variable `AVISO_PRIVACIDAD_VERSION` del Worker debe tener ese mismo valor). La cuenta de primer ingreso usa `Demo2026*` como contraseña temporal: después de cambiarla, regenera y recarga el seed para repetir la demo.

Para la demo en vivo, el estudiante al día tiene pendiente el "Taller 3" de Lógica de programación, con fecha límite 2026-11-23.
