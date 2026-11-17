import { CircleCheck, Download, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { Confirmar } from "@/components/admin/dialogos";
import { ErrorGeneral } from "@/components/admin/piezas";
import { Campo } from "@/components/formularios/Campo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ErrorApi, type ErrorFila } from "@/lib/api";
import { type Credencial, useCambioCatalogo } from "@/lib/consultas";

// Carga masiva por CSV (tarea 3.4 sobre la API de la 3.3; spec "Carga masiva desde CSV", design.md D8 y D17).
// Las contraseñas temporales llegan una sola vez: el CSV de credenciales se arma aquí, en el navegador, y
// el servidor no lo guarda. Si se cierra sin descargarlo, no se puede recuperar.

// Marca UTF-8 (BOM) para que Excel en Windows muestre bien las tildes del archivo de credenciales
const BOM = String.fromCharCode(0xfeff);

const comillas = (valor: string) => (/[;"\n]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor);

function descargarCredenciales(credenciales: Credencial[]) {
  const filas = credenciales.map((c) => [c.documento, c.nombres, c.apellidos, c.contrasenaTemporal].map(comillas).join(";"));
  const contenido = `${BOM}documento;nombres;apellidos;contrasena_temporal\r\n${filas.join("\r\n")}\r\n`;
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  // Fecha local, no toISOString(): en Colombia, después de las 7 p. m. UTC ya va en el día siguiente
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  enlace.download = `credenciales-estudiantes-${fecha}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

type Resultado = { creados: number; credenciales: Credencial[] };

export function CargaMasiva({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  return (
    <Dialog open={abierto}>
      {/* El cierre lo controla el contenido: si hay credenciales sin descargar, primero pregunta */}
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl" showCloseButton={false}>
        {abierto && <ContenidoCarga alCerrar={alCerrar} />}
      </DialogContent>
    </Dialog>
  );
}

function ContenidoCarga({ alCerrar }: { alCerrar: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [erroresFilas, setErroresFilas] = useState<ErrorFila[]>([]);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [descargado, setDescargado] = useState(false);
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);

  const cargar = useCambioCatalogo(async (elegido: File) =>
    api.postTexto<Resultado>("/estudiantes/carga", await elegido.text(), "text/csv; charset=utf-8"),
  );

  const elegir = (evento: ChangeEvent<HTMLInputElement>) => {
    setArchivo(evento.target.files?.[0] ?? null);
    setErroresFilas([]);
    setErrorGeneral(null);
  };

  const enviar = () => {
    if (!archivo) return;
    setErroresFilas([]);
    setErrorGeneral(null);
    cargar.mutate(archivo, {
      onSuccess: setResultado,
      onError: (error) => {
        if (error instanceof ErrorApi && error.errores?.length) setErroresFilas(error.errores);
        setErrorGeneral(error.message);
      },
    });
  };

  const descargar = () => {
    if (!resultado) return;
    descargarCredenciales(resultado.credenciales);
    setDescargado(true);
  };

  const intentarCerrar = () => (resultado && !descargado ? setConfirmandoCierre(true) : alCerrar());

  if (resultado) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Se crearon {resultado.creados === 1 ? "1 estudiante" : `${resultado.creados} estudiantes`}</DialogTitle>
          <DialogDescription>Quedaron inscritos en los cursos de su semestre y deben cambiar la contraseña al ingresar.</DialogDescription>
        </DialogHeader>
        <Alert className={descargado ? "border-exito/30 bg-exito-suave text-exito" : "border-alerta/40 bg-alerta-suave text-alerta"}>
          {descargado ? <CircleCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
          <AlertTitle>{descargado ? "Archivo de credenciales descargado" : "Descarga ahora las credenciales"}</AlertTitle>
          <AlertDescription className={descargado ? "text-exito" : "text-alerta"}>
            {descargado
              ? "Guárdalo en un lugar seguro y entrégale a cada estudiante solo su contraseña."
              : "Las contraseñas temporales se muestran solo esta vez. Si cierras sin descargarlas, tendrás que restablecerlas una por una."}
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button variant="outline" onClick={intentarCerrar}>
            Cerrar
          </Button>
          <Button onClick={descargar}>
            <Download data-icon="inline-start" aria-hidden="true" />
            Descargar credenciales (CSV)
          </Button>
        </DialogFooter>
        <Confirmar
          abierto={confirmandoCierre}
          alCambiar={setConfirmandoCierre}
          titulo="¿Cerrar sin descargar las credenciales?"
          descripcion="Las contraseñas temporales no se pueden volver a ver. Tendrás que restablecerlas una por una."
          accion="Cerrar sin descargar"
          peligro
          pendiente={false}
          alConfirmar={alCerrar}
        />
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Cargar estudiantes desde un CSV</DialogTitle>
        <DialogDescription>
          Se revisa todo el archivo antes de guardar: si una fila tiene errores, no se guarda ninguna. Máximo 300 estudiantes por archivo.
        </DialogDescription>
      </DialogHeader>

      <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
        <li>
          <span className="block">Descarga la plantilla y ábrela en Excel. Llena una fila por estudiante, desde la fila 2.</span>
          <Button variant="outline" className="mt-2" asChild>
            {/* Enlace normal: el navegador envía la cookie de sesión y la API entrega el archivo */}
            <a href="/api/estudiantes/plantilla.csv" download>
              <FileSpreadsheet data-icon="inline-start" aria-hidden="true" />
              Descargar plantilla
            </a>
          </Button>
        </li>
        <li>
          Usa el código de la carrera (por ejemplo TL-PSW), el semestre como número, la cohorte como 2026-2 y la fecha como
          2026-08-03.
        </li>
        <li>Guárdala como CSV (separado por punto y coma o por comas) y elígela aquí.</li>
      </ol>

      <Campo id="archivo" etiqueta="Archivo CSV">
        {(control) => <Input {...control} type="file" accept=".csv,text/csv" onChange={elegir} className="h-auto py-2" />}
      </Campo>

      {erroresFilas.length > 0 && (
        <div className="space-y-2">
          <ErrorGeneral mensaje={errorGeneral} />
          <div className="max-h-64 overflow-y-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Fila</TableHead>
                  <TableHead className="w-36">Columna</TableHead>
                  <TableHead>Qué corregir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {erroresFilas.map((e, i) => (
                  <TableRow key={`${e.fila}-${e.campo ?? ""}-${i}`}>
                    <TableCell className="tabular-nums">{e.fila}</TableCell>
                    <TableCell>{e.campo ?? "—"}</TableCell>
                    <TableCell className="whitespace-normal">{e.mensaje}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {erroresFilas.length === 0 && <ErrorGeneral mensaje={errorGeneral} />}

      <DialogFooter>
        <Button variant="outline" onClick={intentarCerrar} disabled={cargar.isPending}>
          Cancelar
        </Button>
        <Button onClick={enviar} disabled={!archivo || cargar.isPending}>
          {cargar.isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Upload data-icon="inline-start" aria-hidden="true" />}
          {cargar.isPending ? "Revisando el archivo…" : "Cargar estudiantes"}
        </Button>
      </DialogFooter>
    </>
  );
}
