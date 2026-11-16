// Bindings que existen solo en las pruebas (los define vitest.config.ts). Este archivo solo lo ve
// tsconfig.test.json, así que el código de producción no puede depender de ellos por error.
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
