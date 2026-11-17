import { useEffect, useState } from "react";

// Devuelve el valor solo cuando deja de cambiar durante `ms`: la búsqueda espera a que la persona termine
// de escribir en vez de pedirle a la API una lista por cada tecla
export function useRetardado<T>(valor: T, ms = 300): T {
  const [retardado, setRetardado] = useState(valor);
  useEffect(() => {
    const espera = setTimeout(() => setRetardado(valor), ms);
    return () => clearTimeout(espera);
  }, [valor, ms]);
  return retardado;
}
