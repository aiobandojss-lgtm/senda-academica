import type { EstadoCuenta } from "./consultas";
import { fecha } from "./formato";

// Mensaje del estado de cartera: qué pasa y qué hacer, sin culpar (docs/identidad-visual.md, "Tono")
export function mensajeCartera(cuenta: EstadoCuenta, contacto: string, persona: "tu" | "estudiante") {
  const proxima = cuenta.cuotas.find((c) => c.estado === "pendiente");
  const vencida = cuenta.cuotas.filter((c) => c.estado === "vencida").sort((a, b) => b.diasAtraso - a.diasAtraso)[0];
  const excepcion = cuenta.excepciones.find((e) => e.vigente);
  const tu = persona === "tu";
  switch (cuenta.estadoCartera) {
    case "al_dia":
      return proxima
        ? `${tu ? "Estás al día. Tu próxima cuota vence" : "Al día. La próxima cuota vence"} el ${fecha(proxima.fechaVencimiento)}.`
        : tu
          ? "Estás al día: no tienes cuotas pendientes."
          : "Al día: no tiene cuotas pendientes.";
    case "en_riesgo": {
      const dias = vencida?.diasAtraso ?? 0;
      return tu
        ? `Tienes una cuota vencida hace ${dias} días. Si pasa de 30 días, tu acceso se suspende: comunícate con ${contacto} para ponerte al día.`
        : `Tiene una cuota vencida hace ${dias} días: a los 31 días de atraso se le suspende el acceso.`;
    }
    case "con_excepcion":
      return tu
        ? `Tienes un acuerdo vigente hasta el ${excepcion ? fecha(excepcion.hasta) : "—"}: puedes seguir ingresando mientras tanto.`
        : `Cumple la regla de bloqueo, pero tiene una excepción vigente hasta el ${excepcion ? fecha(excepcion.hasta) : "—"}.`;
    case "bloqueado":
      return tu
        ? `Tu acceso está suspendido. Comunícate con ${contacto}.`
        : `Acceso suspendido: tiene una cuota con ${vencida?.diasAtraso ?? "más de 30"} días de atraso. Al registrar el pago que la salde, ingresa de inmediato.`;
  }
}
