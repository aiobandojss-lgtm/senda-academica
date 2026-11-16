import * as React from "react"

const MOBILE_BREAKPOINT = 768
const CONSULTA = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

// Senda: reescrito con useSyncExternalStore, la forma de React para suscribirse a algo externo
// (aquí, el ancho de la ventana). El original de shadcn llamaba a setState dentro de un efecto,
// lo que provoca un render de más y no pasa la regla react-hooks/set-state-in-effect.
function suscribir(alCambiar: () => void) {
  const mql = window.matchMedia(CONSULTA)
  mql.addEventListener("change", alCambiar)
  return () => mql.removeEventListener("change", alCambiar)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CONSULTA).matches,
    () => false
  )
}
