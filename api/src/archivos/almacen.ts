// Almacén de archivos (design.md D7, ADR-002). El código de la API solo conoce esta interfaz; la variable
// ALMACEN_ARCHIVOS elige la implementación: Workers KV mientras la cuenta no tenga medio de pago, y R2 en
// producción. Las dos pasan las mismas pruebas de contrato (api/test/archivos.test.ts).
// Nunca hay URLs públicas: los archivos se descargan solo por la API, que valida los permisos.

export type ArchivoGuardado = { cuerpo: ReadableStream; tipo: string; tamano: number };

export interface AlmacenArchivos {
  guardar(llave: string, datos: ArrayBuffer, tipo: string): Promise<void>;
  obtener(llave: string): Promise<ArchivoGuardado | null>;
  // Eliminar una llave que no existe no es un error
  eliminar(llave: string): Promise<void>;
}

type MetadatosKV = { tipo: string; tamano: number };

export class AlmacenKV implements AlmacenArchivos {
  constructor(private readonly kv: KVNamespace) {}

  async guardar(llave: string, datos: ArrayBuffer, tipo: string) {
    await this.kv.put(llave, datos, { metadata: { tipo, tamano: datos.byteLength } satisfies MetadatosKV });
  }

  async obtener(llave: string) {
    const { value, metadata } = await this.kv.getWithMetadata<MetadatosKV>(llave, "stream");
    if (!value || !metadata) return null;
    return { cuerpo: value, tipo: metadata.tipo, tamano: metadata.tamano };
  }

  async eliminar(llave: string) {
    await this.kv.delete(llave);
  }
}

export class AlmacenR2 implements AlmacenArchivos {
  constructor(private readonly r2: R2Bucket) {}

  async guardar(llave: string, datos: ArrayBuffer, tipo: string) {
    await this.r2.put(llave, datos, { httpMetadata: { contentType: tipo } });
  }

  async obtener(llave: string) {
    const objeto = await this.r2.get(llave);
    if (!objeto) return null;
    return { cuerpo: objeto.body, tipo: objeto.httpMetadata?.contentType ?? "application/octet-stream", tamano: objeto.size };
  }

  async eliminar(llave: string) {
    await this.r2.delete(llave);
  }
}

// R2 no está declarado en wrangler.jsonc hasta pasar a producción (ADR-002): por eso es opcional aquí
type EnvArchivos = Env & { ARCHIVOS_R2?: R2Bucket };

export function almacenDe(env: EnvArchivos): AlmacenArchivos {
  if (env.ALMACEN_ARCHIVOS === "kv") return new AlmacenKV(env.ARCHIVOS_KV);
  if (env.ALMACEN_ARCHIVOS === "r2") {
    if (!env.ARCHIVOS_R2) throw new Error("ALMACEN_ARCHIVOS es r2, pero el binding ARCHIVOS_R2 no está configurado en wrangler.jsonc");
    return new AlmacenR2(env.ARCHIVOS_R2);
  }
  throw new Error(`ALMACEN_ARCHIVOS debe ser "kv" o "r2", no "${env.ALMACEN_ARCHIVOS}"`);
}
