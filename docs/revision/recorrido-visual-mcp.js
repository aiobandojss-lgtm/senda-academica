/* global document, getComputedStyle, location, window */
// Revisión visual de todas las pantallas (tarea 6.2) con el MCP de Playwright: capturas en 375 y 1280 px de cada
// pantalla y mediciones contra docs/identidad-visual.md (desplazamiento horizontal, errores en la consola,
// tipografías, botones sin nombre, campos sin etiqueta, objetivos táctiles de menos de 24 px y texto en terracota).
// Resultado de la corrida del 2026-11-19: docs/revision/2026-11-19-revision-visual.md.
//
// Cómo correrla, desde Claude Code con npm run dev arriba y el seed local recién cargado:
//   herramienta browser_run_code_unsafe del MCP de Playwright, con filename: docs/revision/recorrido-visual-mcp.js
// No cambia datos: solo entra con las cuentas de db/seed/CUENTAS-DEMO.md (datos ficticios) y navega.
// CARPETA es la ruta absoluta donde quedan las capturas (dentro de .playwright-mcp/, que no se versiona): ajústala a
// tu equipo. El archivo es solo la función que recibe "page", por eso no tiene import ni export.
async (page) => {
  const BASE = "http://[::1]:5173";
  const CARPETA = "C:/TMP_ESTUDIO/AI AGENTIC ENGINEER/Proyecto_Final/proyecto/.playwright-mcp/revision-6-2";
  const CONTRASENA = "Demo2026*";
  const contexto = page.context();
  await page.emulateMedia({ reducedMotion: "reduce" });

  let pantallaActual = "";
  const errores = [];
  page.on("console", (m) => {
    if (m.type() === "error") errores.push({ pantalla: pantallaActual, texto: m.text().slice(0, 160) });
  });
  page.on("pageerror", (e) => errores.push({ pantalla: pantallaActual, texto: `pageerror: ${e.message.slice(0, 160)}` }));

  async function esperar() {
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.locator("h1").first().waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);
  }

  async function ingresar(documento) {
    await contexto.clearCookies();
    await page.goto(`${BASE}/ingresar`);
    await page.getByLabel("Número de documento").fill(documento);
    await page.getByLabel("Contraseña", { exact: true }).fill(CONTRASENA);
    await page.getByRole("button", { name: "Ingresar" }).click();
  }

  const medir = () =>
    page.evaluate(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      };
      const nombre = (el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
      const interactivos = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=checkbox], [role=combobox], [role=tab]")].filter(visible);
      const pequenos = interactivos
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width < 24 || r.height < 24;
        })
        .map((el) => `${nombre(el)} (${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)})`);
      const sinNombre = interactivos
        .filter((el) => ["BUTTON", "A"].includes(el.tagName))
        .filter((el) => !(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.textContent.trim() || el.getAttribute("title"))).length;
      const camposSinEtiqueta = interactivos
        .filter((el) => ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName))
        .filter((el) => !(el.labels?.length || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")))
        .map(nombre);
      // La terracota es solo decorativa (3,7:1): ningún texto debe usarla
      const sonda = document.createElement("span");
      sonda.style.color = "var(--terracota)";
      document.body.append(sonda);
      const terracota = getComputedStyle(sonda).color;
      sonda.remove();
      const textoTerracota = [...document.querySelectorAll("body *")]
        .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && getComputedStyle(el).color === terracota)
        .map(nombre);
      const h1 = [...document.querySelectorAll("h1")].map((h) => h.textContent.trim());
      return {
        url: location.pathname,
        titulo: document.title,
        desborde: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        h1,
        fuenteTitulo: h1.length ? getComputedStyle(document.querySelector("h1")).fontFamily.split(",")[0] : null,
        fuenteTexto: getComputedStyle(document.body).fontFamily.split(",")[0],
        pequenos,
        sinNombre,
        camposSinEtiqueta,
        textoTerracota,
      };
    });

  async function capturar(clave, ancho) {
    pantallaActual = `${clave}-${ancho}`;
    await esperar();
    await page.screenshot({ path: `${CARPETA}/${clave}-${ancho}.png`, fullPage: true });
    return { pantalla: clave, ancho, ...(await medir()) };
  }

  const PANTALLAS = {
    estudiante: [
      ["estudiante-inicio", "/estudiante"],
      ["estudiante-cursos", "/estudiante/cursos"],
      ["estudiante-curso", "/estudiante/cursos/7"],
      ["estudiante-actividad-pendiente", "/estudiante/actividades/27"],
      ["estudiante-actividad-calificada", "/estudiante/actividades/25"],
      ["estudiante-cuenta", "/estudiante/cuenta"],
      ["estudiante-asistente", "/estudiante/asistente"],
      ["estudiante-cambiar-contrasena", "/cuenta/contrasena"],
      ["no-existe", "/estudiante/no-existe"],
    ],
    docente: [
      ["docente-inicio", "/docente"],
      ["docente-cursos", "/docente/cursos"],
      ["docente-curso", "/docente/cursos/7"],
      ["docente-actividad", "/docente/actividades/26"],
    ],
    admin: [
      ["admin-inicio", "/admin"],
      ["admin-carreras", "/admin/carreras"],
      ["admin-carrera", "/admin/carreras/3"],
      ["admin-estudiantes", "/admin/estudiantes"],
      ["admin-cuenta-al-dia", "/admin/estudiantes/100/cuenta"],
      ["admin-cuenta-bloqueada", "/admin/estudiantes/101/cuenta"],
      ["admin-docentes", "/admin/docentes"],
      ["admin-cartera", "/admin/cartera"],
    ],
  };
  const CUENTAS = { estudiante: "9900001001", docente: "9900000103", admin: "9900000001" };

  const resultados = [];
  for (const [ancho, alto] of [[375, 812], [1280, 800]]) {
    await page.setViewportSize({ width: ancho, height: alto });

    await contexto.clearCookies();
    await page.goto(`${BASE}/ingresar`);
    resultados.push(await capturar("ingresar", ancho));

    // Estudiante en mora: el ingreso muestra el aviso de acceso suspendido
    await ingresar("9900001002");
    await page.getByRole("alert").first().waitFor({ timeout: 8000 }).catch(() => {});
    resultados.push(await capturar("ingresar-bloqueado", ancho));

    // Primer ingreso: la compuerta de cambio de contraseña
    await ingresar("9900001006");
    await page.waitForURL(/primer-ingreso/, { timeout: 8000 }).catch(() => {});
    resultados.push(await capturar("primer-ingreso-contrasena", ancho));

    for (const [rol, pantallas] of Object.entries(PANTALLAS)) {
      await ingresar(CUENTAS[rol]);
      await page.waitForURL((u) => !u.pathname.startsWith("/ingresar"), { timeout: 15000 });
      for (const [clave, ruta] of pantallas) {
        await page.goto(`${BASE}${ruta}`);
        resultados.push(await capturar(clave, ancho));
      }
    }
  }
  await contexto.clearCookies();
  return { devicePixelRatio: await page.evaluate(() => window.devicePixelRatio), errores, resultados };
}
