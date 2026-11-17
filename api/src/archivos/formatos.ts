// Formatos permitidos para entregas y archivos de apoyo (spec "Entrega de archivos", design.md D7).
// El formato se decide por el CONTENIDO (los primeros bytes, la "firma" del formato) y además debe
// coincidir con la extensión: un ejecutable renombrado como .pdf se rechaza (práctica de OWASP para subidas).
// El tipo que declara el navegador no se usa: lo pone el cliente y se puede falsificar.

export type Formato = { extension: "pdf" | "docx" | "jpg" | "png"; mime: string };

export const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB, igual que el CHECK de entregas.tamano_bytes
export const MENSAJE_FORMATOS = "El archivo debe ser PDF, DOCX, JPG o PNG";

const FORMATOS: (Formato & { extensiones: string[]; firma: number[] })[] = [
  { extension: "pdf", extensiones: ["pdf"], mime: "application/pdf", firma: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { extension: "png", extensiones: ["png"], mime: "image/png", firma: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { extension: "jpg", extensiones: ["jpg", "jpeg"], mime: "image/jpeg", firma: [0xff, 0xd8, 0xff] },
  {
    extension: "docx",
    extensiones: ["docx"],
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    firma: [0x50, 0x4b, 0x03, 0x04], // un .docx es un archivo ZIP
  },
];

export function formatoDe(nombre: string, bytes: Uint8Array): Formato | null {
  const extension = nombre.includes(".") ? nombre.split(".").pop()!.toLowerCase() : "";
  const formato = FORMATOS.find((f) => f.extensiones.includes(extension));
  if (!formato || bytes.length < formato.firma.length) return null;
  if (!formato.firma.every((byte, i) => bytes[i] === byte)) return null;
  return { extension: formato.extension, mime: formato.mime };
}
