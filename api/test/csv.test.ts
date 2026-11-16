import { describe, expect, it } from "vitest";
import { leerCsv } from "../src/dominio/csv";

// Tarea 3.3: lector de CSV para la carga masiva (design.md D8). Unit tests de la función pura.

describe("leerCsv", () => {
  it("lee un CSV separado por punto y coma, como lo guarda Excel en español", () => {
    const hoja = leerCsv("documento;nombres\r\n1001;Ana\r\n1002;Bruno\r\n");

    expect(hoja.columnas).toEqual(["documento", "nombres"]);
    expect(hoja.filas).toEqual([
      { numero: 2, valores: ["1001", "Ana"] },
      { numero: 3, valores: ["1002", "Bruno"] },
    ]);
  });

  it("también acepta coma como separador", () => {
    const hoja = leerCsv("documento,nombres\n1001,Ana");

    expect(hoja.filas).toEqual([{ numero: 2, valores: ["1001", "Ana"] }]);
  });

  it("quita la marca UTF-8 (BOM) que agrega Excel al inicio", () => {
    const hoja = leerCsv("\uFEFFdocumento;nombres\n1001;Ana");

    expect(hoja.columnas).toEqual(["documento", "nombres"]);
  });

  it("respeta los campos entre comillas, con separadores, comillas dobles y saltos de línea adentro", () => {
    const hoja = leerCsv('documento;nombres;nota\n1001;"Ana; María";"dijo ""hola""\notra línea"\n1002;Bruno;x');

    expect(hoja.filas[0].valores).toEqual(["1001", "Ana; María", 'dijo "hola"\notra línea']);
    // El número de fila es el de la línea donde empieza: la que muestra Excel
    expect(hoja.filas[1]).toEqual({ numero: 4, valores: ["1002", "Bruno", "x"] });
  });

  it("ignora las líneas vacías y quita espacios de los nombres de columna", () => {
    const hoja = leerCsv(" Documento ; Nombres \n\n1001;Ana\n;\n\n");

    expect(hoja.columnas).toEqual(["documento", "nombres"]);
    expect(hoja.filas).toEqual([{ numero: 3, valores: ["1001", "Ana"] }]);
  });

  it("un archivo vacío no tiene columnas ni filas", () => {
    expect(leerCsv("")).toEqual({ columnas: [], filas: [] });
  });
});
