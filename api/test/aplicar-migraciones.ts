import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Se ejecuta antes de cada archivo de pruebas. La D1 de pruebas está aislada por archivo y empieza vacía:
// aquí recibe el mismo esquema que la base real (triggers incluidos). Las migraciones ya aplicadas se saltan.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
