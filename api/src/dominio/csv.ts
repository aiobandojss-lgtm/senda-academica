// Lector de CSV para la carga masiva (design.md D8). Propio y sin dependencias: unas pocas reglas cubren
// lo que produce Excel (RFC 4180):
// - Separador `;` (Excel en español) o `,`: se detecta en la línea de encabezados.
// - Campos entre comillas, que pueden traer separadores, saltos de línea y comillas dobles ("" = ").
// - Saltos de línea de Windows (\r\n) y la marca UTF-8 (BOM) que Excel pone al inicio.

export type FilaCsv = {
  // Línea del archivo donde empieza la fila: la misma que muestra Excel (el encabezado es la 1)
  numero: number;
  valores: string[];
};
export type HojaCsv = { columnas: string[]; filas: FilaCsv[] };

const contar = (texto: string, caracter: string) => texto.split(caracter).length - 1;

export function leerCsv(texto: string): HojaCsv {
  const limpio = texto.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const encabezado = limpio.slice(0, limpio.indexOf("\n") === -1 ? undefined : limpio.indexOf("\n"));
  const separador = contar(encabezado, ";") > 0 && contar(encabezado, ";") >= contar(encabezado, ",") ? ";" : ",";

  const registros: FilaCsv[] = [];
  let valores: string[] = [];
  let campo = "";
  let entreComillas = false;
  let linea = 1;
  let inicio = 1;

  for (let i = 0; i < limpio.length; i++) {
    const caracter = limpio[i];
    if (entreComillas) {
      if (caracter === '"' && limpio[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (caracter === '"') {
        entreComillas = false;
      } else {
        if (caracter === "\n") linea++;
        campo += caracter;
      }
    } else if (caracter === '"' && campo === "") {
      entreComillas = true;
    } else if (caracter === separador) {
      valores.push(campo);
      campo = "";
    } else if (caracter === "\n") {
      valores.push(campo);
      registros.push({ numero: inicio, valores });
      valores = [];
      campo = "";
      linea++;
      inicio = linea;
    } else {
      campo += caracter;
    }
  }
  if (campo !== "" || valores.length > 0) registros.push({ numero: inicio, valores: [...valores, campo] });

  // Las líneas vacías (o solo con separadores) no son filas
  const utiles = registros.filter((r) => r.valores.some((v) => v.trim() !== ""));
  if (utiles.length === 0) return { columnas: [], filas: [] };
  const [titulos, ...filas] = utiles;
  return { columnas: titulos.valores.map((v) => v.trim().toLowerCase()), filas };
}
