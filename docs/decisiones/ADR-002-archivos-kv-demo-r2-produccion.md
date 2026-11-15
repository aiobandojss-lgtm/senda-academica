# ADR-002: Archivos en Workers KV durante la demo y en R2 en producción

- **Estado:** aceptada
- **Fecha:** 2026-11-14
- **Decide:** Aymer Ivan (CREATIVE BY CODE)

## Contexto

El diseño original (D7 del MVP) guarda las entregas y los soportes de pago en Cloudflare R2. Al preparar la cuenta se confirmó en la documentación de Cloudflare que **R2 exige activar una suscripción con un medio de pago** (tarjeta o PayPal), aunque su plan gratuito no cobre nada por debajo de 10 GB.

Restricción del proyecto: no se registra ningún medio de pago en Cloudflare antes de la presentación del curso (viernes 20 de noviembre de 2026). Después de esa fecha sí se hará, para producción.

## Decisión

El código accede a los archivos a través de una interfaz propia `AlmacenArchivos` (`guardar`, `obtener`, `eliminar`) con dos implementaciones:

- **Workers KV** (binding `ARCHIVOS_KV`): se usa hasta que la cuenta tenga medio de pago. Está incluido en el plan gratuito sin tarjeta.
- **R2** (binding `ARCHIVOS_R2`): se usa en producción.

La variable `ALMACEN_ARCHIVOS` (`kv` o `r2`) elige la implementación. Las llaves, los permisos y las rutas de la API son las mismas en ambos casos, y los specs no cambian porque hablan de "almacenamiento", no de un servicio concreto.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Activar R2 ya con un medio de pago | Contradice la restricción de no pagar antes de la presentación |
| Guardar los archivos en D1 como BLOB | D1 limita cada fila a unos 2 MB y las entregas pueden pesar 10 MB; habría que trocearlas |
| URLs de un servicio externo (Google Drive, etc.) | Saca datos personales del proveedor único, agrega credenciales y complica los permisos |

## Consecuencias

**Positivas**
- La demo funciona sin pagar nada y la migración a R2 es un cambio de configuración más un script de copia.
- La interfaz `AlmacenArchivos` permite probar la lógica de entregas con un doble en memoria.

**Negativas y cómo se mitigan**
- **Límites de KV gratis:** 1 GB de almacenamiento, 1.000 escrituras al día y 25 MiB por archivo. Para la demo sobra; para 500 estudiantes reales no alcanza, por eso producción usa R2.
- **KV es eventualmente consistente entre ubicaciones:** cada subida usa una llave nueva (`<uuid>`) y nunca se sobrescribe, así que en la misma ubicación el archivo se lee de inmediato; en otra región puede tardar hasta un minuto. Aceptable para la demo.
- **Pruebas:** en local y en CI, Miniflare emula KV y R2 sin cuenta, así que ambas implementaciones se prueban igual.

## Plan de migración a R2 (después de la presentación)

1. Registrar el medio de pago y activar R2; crear el bucket.
2. Agregar el binding `ARCHIVOS_R2` en `wrangler.jsonc` y cambiar `ALMACEN_ARCHIVOS` a `r2`.
3. Copiar los objetos de KV a R2 con un script (mismas llaves) y verificar descargas.
4. Retirar el namespace KV.
