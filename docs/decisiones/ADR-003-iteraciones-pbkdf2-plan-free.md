# ADR-003: Iteraciones de PBKDF2 según el plan de Workers

- **Estado:** propuesta (pendiente de aprobación)
- **Fecha:** 2026-11-15
- **Decide:** Aymer Ivan (CREATIVE BY CODE)

## Contexto

Las contraseñas se guardan con PBKDF2-SHA256 (design.md D5). El diseño fija 100.000 iteraciones, el máximo que acepta Web Crypto en Workers. Cada ingreso verifica la contraseña repitiendo ese cálculo, y el plan **Free** de Workers permite **10 ms de CPU por petición**. No habrá medio de pago en Cloudflare antes de la presentación del 20 de noviembre (ADR-002), así que hasta entonces Senda corre en el plan Free.

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

**Lectura:**
- Con 100.000 iteraciones, **cada** ingreso consume entre 2 y 4 veces el límite contratado. Hoy funciona solo por la tolerancia de la plataforma, que no está garantizada.
- Solo 10.000 iteraciones queda siempre dentro del límite.

## Decisión (propuesta)

1. **El número de iteraciones pasa a ser configurable** con la variable `PBKDF2_ITERACIONES` de `wrangler.jsonc`.
   - Mientras Senda esté en el plan Free (demo con datos ficticios): **10.000**.
   - Al pasar a **Workers Paid** (USD 5/mes, después de la presentación): **100.000**.
2. **Reprocesar el hash al ingresar:** si el hash guardado tiene menos iteraciones que las configuradas, tras verificar una contraseña correcta se recalcula y se guarda con las iteraciones actuales. Así cada usuario se migra solo en su siguiente ingreso. El formato `pbkdf2_sha256$<iteraciones>$<sal>$<hash>` ya guarda el número de iteraciones (D5).
3. **Condición de seguridad:** ningún dato personal real entra a Senda mientras se use 10.000 iteraciones. La Fundación carga sus datos reales solo después de pasar a Paid con 100.000.
4. **El seed se genera con 10.000 iteraciones** (parámetro del generador) mientras se use el plan Free.

Era el plan de contingencia que ya preveía design.md (riesgo "Sin medio de pago antes de la presentación"). La medición confirma que hay que activarlo.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Mantener 100.000 en el plan Free | Las 38 pruebas pasaron, pero dependen de una tolerancia no garantizada. Un error 1102 en el ingreso durante la presentación sería el peor escenario posible, y la carga masiva por CSV (60 contraseñas en una sola petición, unos 1,2 s de CPU) fallaría casi seguro. |
| 25.000 iteraciones | Mediana de 11 ms: ya está por encima del límite la mitad de las veces |
| Pagar Workers Paid ahora | Contradice la restricción de no registrar un medio de pago antes de la presentación |
| Otro algoritmo (bcrypt, argon2) | No están disponibles de forma nativa en Workers, y en JavaScript puro consumirían todavía más CPU |

## Consecuencias

- **Seguridad durante la demo:** 10.000 iteraciones hace 10 veces más barato un ataque de fuerza bruta **fuera de línea**, es decir, si alguien robara la base. Es aceptable porque la base de la demo solo tiene datos ficticios, el ingreso en línea está limitado a 5 intentos cada 15 minutos (D14) y la condición 3 impide que entren datos reales.
- **Carga masiva por CSV (tarea 3.3):** incluso con 10.000 iteraciones, cada contraseña temporal cuesta unos 3 ms. En el plan Free, un CSV solo cabe en el límite si tiene muy pocas filas. La demo usará un archivo pequeño, y las cargas grandes son de producción (Paid, con hasta 30 s de CPU por petición). Se tendrá en cuenta al implementar la 3.3.
- **Cambios en el plan** (se aplican con `/openspec-update-change` si se aprueba):
  - design.md D5: iteraciones configurables y reprocesamiento al ingresar.
  - wrangler.jsonc: la variable `PBKDF2_ITERACIONES`.
  - Generador del seed: parámetro de iteraciones.
  - Tareas 2.1 y 2.2: pruebas del reprocesamiento.
- **Paso a producción:** contratar Workers Paid, cambiar `PBKDF2_ITERACIONES` a 100.000 y comprobar en el dashboard (Metrics, CPU time) que el ingreso queda por debajo de 30 ms sin errores.
