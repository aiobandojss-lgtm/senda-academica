# ADR-003: 100.000 iteraciones de PBKDF2 en el plan Free hasta pasar a Paid

- **Estado:** aceptada
- **Fecha:** 2026-11-15
- **Decide:** Aymer Ivan (CREATIVE BY CODE)

## Contexto

Las contraseñas se guardan con PBKDF2-SHA256 (design.md D5). El diseño fija 100.000 iteraciones, el máximo que acepta Web Crypto en Workers. Cada ingreso verifica la contraseña repitiendo ese cálculo, y el plan **Free** de Workers permite **10 ms de CPU por petición**. No habrá medio de pago en Cloudflare antes de la presentación del 20 de noviembre (ADR-002).

La documentación de Cloudflare dice que cada isolate tolera excesos **ocasionales**, pero que un Worker que supera el límite **de forma consistente** se termina con el error 1102 (*Worker exceeded resource limits*).

## Medición (tarea 1.8)

**Método:**
- Endpoint temporal en el Worker desplegado (`senda.creativebycode.workers.dev`), protegido con un secreto de un solo uso y retirado al terminar. Ejecutaba el mismo trabajo que verificar una contraseña: importar la clave y derivar 32 bytes con 16 bytes de sal.
- El CPU real de cada invocación se tomó del campo `cpuTime` de `wrangler tail`.
- Las peticiones se hicieron secuenciales desde Colombia, atendidas en el centro de datos de Miami.

| Iteraciones | Peticiones | CPU mín. | Mediana | CPU máx. | Resultado |
|---|---|---|---|---|---|
| 10.000 | 8 | 2 ms | 3 ms | 4 ms | todas `ok` |
| 25.000 | 8 | 4 ms | 11 ms | 12 ms | todas `ok` |
| 50.000 | 8 | 8 ms | 12 ms | 24 ms | todas `ok` |
| 100.000 | 38 (8, y luego 30 seguidas) | 16 ms | 20 ms | 39 ms | todas `ok`, ningún `exceededCpu` |

Con 100.000 iteraciones, cada ingreso consume entre 2 y 4 veces el límite del plan Free. Funciona gracias a la tolerancia a excesos ocasionales, que resistió incluso 30 ingresos seguidos.

## Decisión

1. **Se mantienen las 100.000 iteraciones** del diseño (D5), también durante la demo en el plan Free.
2. **Se contrata Workers Paid (USD 5/mes) después de la presentación**, antes de cargar datos reales de la Fundación. Con Paid, el límite pasa a 30 s de CPU por petición y el riesgo desaparece.

**Por qué:**
- La demo y el uso previo al pago tienen **pocos ingresos**: justo el patrón de excesos ocasionales que Cloudflare tolera.
- La medición lo respalda (38 de 38).
- Así no se debilita la seguridad de las contraseñas ni se cambia el diseño por una situación que dura menos de una semana.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Iteraciones configurables: 10.000 en Free y 100.000 en Paid, con reprocesamiento del hash al ingresar | Es el plan B. Agrega trabajo y debilita el hash para cubrir un riesgo que, con pocos ingresos y Paid inminente, es bajo |
| 25.000 iteraciones | Mediana de 11 ms: no elimina el exceso y debilita el hash igual |
| Pagar Workers Paid ahora | Contradice la restricción de no registrar un medio de pago antes de la presentación |
| Otro algoritmo (bcrypt, argon2) | No están disponibles de forma nativa en Workers, y en JavaScript puro consumirían todavía más CPU |

## Consecuencias

- **Riesgo aceptado:** si Cloudflare dejara de tolerar el exceso, un ingreso fallaría con el error 1102.
  - **Vigilancia:** en los ensayos del jueves 19 se observa `wrangler tail` o el dashboard (Metrics → Errors) mientras se ingresa con las cuentas de la demo.
  - **Plan B, unos 10 minutos:** bajar las iteraciones de los hashes nuevos a 10.000 en el código y regenerar y recargar el seed con 10.000. La verificación lee las iteraciones de cada hash (formato de D5), así que ambos conviven sin migraciones.
- **Carga masiva por CSV (tarea 3.3):** cada contraseña temporal cuesta unos 20 ms de CPU, y todas se calculan en la misma petición. En el plan Free, la demo de la carga masiva debe usar un CSV de **pocas filas** (2 o 3). Las cargas grandes son de producción, en Paid. Se tiene en cuenta al implementar la 3.3.
- **Paso a producción:** contratar Workers Paid y comprobar en el dashboard (Metrics → CPU time) que el ingreso queda por debajo de 30 ms sin errores.
