# Despliegue y credenciales del CI

## Cómo se despliega

Todo push a `main` ejecuta `.github/workflows/ci.yml`:

1. **Calidad** (también en cada pull request): `npm ci`, lint, tipos del Worker al día con `wrangler.jsonc`, typecheck, pruebas y build.
2. **Despliegue** (solo en push a `main` y si la calidad pasó):
   - Migraciones pendientes en la D1 remota.
   - `npm run deploy` (build y `wrangler deploy`).
   - `curl` a `/api/salud` en la URL pública.

URL de la demo: <https://senda.creativebycode.workers.dev>. Cada despliegue queda registrado en GitHub, en el entorno **demo** (*Environments*).

No se despliega a mano: si `main` está en verde, la URL tiene lo último.

## Credenciales de GitHub Actions

| Nombre | Qué es | Dónde se ve |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Token de **cuenta** de Cloudflare `senda-github-actions` | Cloudflare → Manage Account → Account API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Identificador de la cuenta. No da acceso, pero se guarda cifrado para no escribirlo en el workflow | Dashboard → Workers & Pages → Account details |

Se crean con `gh secret set <NOMBRE>`: el valor se pega en la terminal y nunca pasa por el chat ni por el repo. `gh secret list` muestra solo los nombres.

### Token `senda-github-actions`

- **Creado:** 2026-11-15.
- **Vence:** **2027-02-13** (90 días).
- **Permisos:**
  - La plantilla oficial "Edit Cloudflare Workers": Workers Scripts, KV, R2, Tail, Observability, CI, Containers, Agents, Pages y Account Settings (lectura).
  - Más **D1 Write**, para las migraciones.
- **Quitado:** la política de zonas (Workers Routes), porque no hay dominios propios.
- **Por qué no se recortó más:** la cuenta solo contiene Senda y no tiene medio de pago, y quitar permisos a ciegas arriesgaba un primer despliegue fallido. Para producción se creará un token aparte con lo mínimo (ver abajo).

### Rotación (antes del 2027-02-13)

Síntoma si se olvida: el job "Migraciones y despliegue" falla con un error de autenticación (`Authentication error [code: 10000]` o similar) y la URL se queda con la versión anterior.

1. Cloudflare → Account API Tokens → `senda-github-actions` → **Roll**. Genera un valor nuevo y el anterior deja de servir. Otra opción es crear uno nuevo con los mismos permisos y borrar el viejo.
2. En la terminal, dentro del repo: `gh secret set CLOUDFLARE_API_TOKEN` y pegar el valor nuevo.
3. Volver a ejecutar el último workflow (*Re-run jobs* en GitHub Actions) y confirmar que queda en verde.
4. Actualizar la fecha de vencimiento en este documento.

## Secretos del Worker

| Nombre | Para qué | Dónde vive |
|---|---|---|
| `JWT_SECRET` | Firma las sesiones (design.md D4). Mínimo 32 caracteres | Cloudflare (`wrangler secret put`) y, en local, `.dev.vars` (plantilla en `.dev.vars.example`). Cada entorno tiene su propia clave |

- `wrangler.jsonc` declara los nombres en `secrets.required`, nunca los valores. Si falta uno en Cloudflare, `wrangler deploy` falla en el CI con *"The following required secrets have not been set"* y la URL conserva la versión anterior.
- Para cargarlo o cambiarlo sin que el valor aparezca en pantalla ni quede en un archivo:

  ```
  node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put JWT_SECRET
  ```

- Al cambiarlo se **cierran todas las sesiones abiertas**: los tokens firmados con la clave anterior dejan de validar. Es útil como medida de emergencia si se sospecha que la clave se filtró. Las sesiones de un solo usuario se cierran con `sesion_version` (D4).
- `wrangler secret list` muestra solo los nombres.

## Producción (después de la presentación)

- Entorno `production` en `wrangler.jsonc` con su propia D1, su almacenamiento de archivos (R2) y su `JWT_SECRET`.
- Token propio recortado al mínimo: Workers Scripts, D1 y Account Settings (lectura). Agregar R2 cuando aplique y Workers Routes solo para la zona del dominio de la Fundación.
- Las credenciales del Worker (`JWT_SECRET`) van con `wrangler secret put`, nunca en `wrangler.jsonc`.
