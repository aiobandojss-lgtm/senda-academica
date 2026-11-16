import { type ComponentType, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const raiz = document.getElementById("root");
if (!raiz) throw new Error("No se encontró el elemento #root en index.html");

// La guía de identidad visual (/guia) solo existe en desarrollo: en el build de producción
// import.meta.env.DEV vale false y Vite elimina esta rama, con la guía y sus datos de ejemplo
async function pantallaInicial(): Promise<ComponentType> {
  if (import.meta.env.DEV && window.location.pathname === "/guia") {
    return (await import("./guia/GuiaIdentidad")).default;
  }
  return App;
}

void pantallaInicial().then((Pantalla) => {
  createRoot(raiz).render(
    <StrictMode>
      <Pantalla />
    </StrictMode>,
  );
});
