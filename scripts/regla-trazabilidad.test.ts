import { describe, expect, it } from "vitest";
import { cubre, pruebasDelTexto, saltadasDelTexto } from "./regla-trazabilidad.ts";

// La regla de `npm run trazabilidad` también se prueba: un verificador que da por cubierto un escenario sin
// prueba es peor que no tener verificador. Los casos de falso positivo son los que encontró el subagente
// revisor-spec el 19 de noviembre, cuando la regla era "el nombre contiene el escenario".

describe("cubre: el nombre de la prueba declara el escenario", () => {
  it("cuenta el escenario cuando el nombre empieza con él y sigue ':'", () => {
    expect(cubre("Archivo demasiado grande: rechaza un archivo de más de 10 MB", "Archivo demasiado grande")).toBe(true);
  });

  it("ignora mayúsculas, tildes y signos", () => {
    expect(cubre("sesion vencida: responde 401", "Sesión vencida")).toBe(true);
  });

  it("una prueba de dos escenarios, separados por ' / ', cubre a los dos", () => {
    const nombre = "Entrega fuera de plazo / El docente amplía el plazo: queda tardía y deja de serlo";
    expect(cubre(nombre, "Entrega fuera de plazo")).toBe(true);
    expect(cubre(nombre, "El docente amplía el plazo")).toBe(true);
  });

  it("no cuenta un escenario que aparece en medio del nombre", () => {
    expect(cubre("un docente tampoco puede listar, cargar ni retirar documentos", "Retirar documento")).toBe(false);
    expect(cubre("falla si usó un documento prohibido, como el plan de estudios de otra carrera", "Plan de estudios de otra carrera")).toBe(false);
  });

  it("no cuenta un escenario que solo es el comienzo de otro más largo", () => {
    const nombre = "Primer ingreso con contraseña temporal: solo ve la pantalla de cambio";
    expect(cubre(nombre, "Primer ingreso")).toBe(false);
    expect(cubre(nombre, "Primer ingreso con contraseña temporal")).toBe(true);
  });

  it("no cuenta el escenario si hay palabras de más antes de los dos puntos", () => {
    expect(cubre("usuario inactivo con la contraseña correcta: no inicia sesión", "Usuario inactivo")).toBe(false);
    expect(cubre("Estudiante en mora con excepción (acuerdo de pago): ingresa", "Acuerdo de pago")).toBe(false);
  });

  it("sin dos puntos, el nombre completo debe ser el escenario", () => {
    expect(cubre("Docente sin cuotas", "Docente sin cuotas")).toBe(true);
    expect(cubre("Docente sin cuotas del semestre", "Docente sin cuotas")).toBe(false);
  });
});

describe("pruebasDelTexto: los nombres de it(), test() y test.step()", () => {
  it("extrae el nombre y la línea de cada prueba", () => {
    const texto = ['it("Uno: a", () => {});', "", "test('Dos: b', async () => {", '  await test.step(`Tres: c`, async () => {});', "});"].join("\n");
    expect(pruebasDelTexto(texto)).toEqual([
      { linea: 1, nombre: "Uno: a" },
      { linea: 3, nombre: "Dos: b" },
      { linea: 4, nombre: "Tres: c" },
    ]);
  });

  it("ignora las pruebas comentadas", () => {
    const texto = ['// it("Comentada: no cuenta", () => {});', '  /* */ it("Activa: cuenta", () => {});', ' * it("En un bloque de comentario", () => {});'].join("\n");
    expect(pruebasDelTexto(texto).map((p) => p.nombre)).toEqual(["Activa: cuenta"]);
  });

  it("ignora las pruebas saltadas con it.skip o test.skip", () => {
    expect(pruebasDelTexto('it.skip("Saltada: no cuenta", () => {});')).toEqual([]);
  });
});

describe("saltadasDelTexto: pruebas o grupos saltados", () => {
  it("encuentra .skip y .only con su línea, aunque estén en un describe", () => {
    const texto = ['describe.skip("grupo", () => {', '  it("Escenario: dentro de un grupo saltado", () => {});', "});", 'it.only("Otra", () => {});'].join("\n");
    expect(saltadasDelTexto(texto)).toEqual([1, 4]);
  });

  it("no confunde una palabra que contiene 'skip' con un salto", () => {
    expect(saltadasDelTexto('it("no se salta: skipNavigation(x)", () => {});')).toEqual([]);
  });
});
