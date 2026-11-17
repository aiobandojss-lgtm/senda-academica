import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ErrorApi } from "./api";

// Datos de la administración (tarea 3.4) con TanStack Query. Tres ideas:
// - useQuery({ queryKey, queryFn }): pide los datos y los guarda en caché bajo esa llave. Dos pantallas
//   con la misma llave comparten una sola petición.
// - useMutation: envía un cambio y expone su estado (isPending, error).
// - Invalidar: después de un cambio, las llaves afectadas se marcan como viejas y sus listas se recargan.

// ---- Tipos que devuelve la API (proyecciones del administrador, api/src/rutas/*.ts) ----

export type EstadoCartera = "al_dia" | "en_riesgo" | "bloqueado" | "con_excepcion";
export type TipoDocumento = "CC" | "TI" | "CE" | "PPT" | "PA";

export type Carrera = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  duracionSemestres: number;
  activa: boolean;
  estudiantesActivos: number;
  cursosActivos: number;
};

export type Curso = {
  id: number;
  nombre: string;
  semestre: number;
  activo: boolean;
  carrera: { id: number; codigo: string; nombre: string };
  docente: { id: number; nombres: string; apellidos: string; activo: boolean } | null;
  inscritos: number;
};

type Persona = {
  id: number;
  tipoDocumento: TipoDocumento;
  documento: string;
  nombres: string;
  apellidos: string;
  correo: string;
  celular: string | null;
  activo: boolean;
};
export type Docente = Persona & { cursosActivos: number };
export type Estudiante = Persona & {
  carrera: { id: number; codigo: string; nombre: string };
  semestreActual: number;
  cohorte: string;
  fechaIngreso: string;
  estadoCartera: EstadoCartera;
};

export type Credencial = { documento: string; nombres: string; apellidos: string; contrasenaTemporal: string };
export type FiltrosEstudiantes = { q?: string; carrera?: number; estado?: EstadoCartera };

// ---- Cliente y llaves ----

export const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      // Un 4xx no se arregla reintentando (permiso, validación); un error de red sí, una vez
      retry: (intentos, error) => !(error instanceof ErrorApi && error.estado >= 400 && error.estado < 500) && intentos < 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export const LLAVES = {
  carreras: ["carreras"] as const,
  cursos: (carrera?: number) => ["cursos", carrera ?? "todas"] as const,
  docentes: ["docentes"] as const,
  estudiantes: (filtros: FiltrosEstudiantes) => ["estudiantes", filtros] as const,
};

// Los contadores se cruzan (inscritos de un curso, cursos de un docente, estudiantes de una carrera):
// tras cualquier cambio del catálogo se recarga todo lo del catálogo. A esta escala es barato y evita
// listas con números viejos.
const PREFIJOS_CATALOGO = [["carreras"], ["cursos"], ["docentes"], ["estudiantes"]];

// ---- Consultas ----

export const useCarreras = () => useQuery({ queryKey: LLAVES.carreras, queryFn: () => api.get<Carrera[]>("/carreras") });

export const useCursos = (carrera?: number) =>
  useQuery({
    queryKey: LLAVES.cursos(carrera),
    queryFn: () => api.get<Curso[]>(carrera ? `/cursos?carrera=${carrera}` : "/cursos"),
  });

export const useDocentes = () => useQuery({ queryKey: LLAVES.docentes, queryFn: () => api.get<Docente[]>("/docentes") });

export function useEstudiantes(filtros: FiltrosEstudiantes) {
  const parametros = new URLSearchParams();
  if (filtros.q) parametros.set("q", filtros.q);
  if (filtros.carrera) parametros.set("carrera", String(filtros.carrera));
  if (filtros.estado) parametros.set("estado", filtros.estado);
  return useQuery({
    queryKey: LLAVES.estudiantes(filtros),
    queryFn: () => api.get<Estudiante[]>(`/estudiantes?${parametros}`),
    // Mientras llega la nueva búsqueda se sigue mostrando la anterior, sin parpadeo
    placeholderData: (anterior) => anterior,
  });
}

// ---- Cambios ----

// Envuelve cualquier cambio del catálogo: al terminar bien, invalida las listas
export function useCambioCatalogo<Entrada, Salida>(enviar: (entrada: Entrada) => Promise<Salida>) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: enviar,
    onSuccess: () => Promise.all(PREFIJOS_CATALOGO.map((queryKey) => cliente.invalidateQueries({ queryKey }))),
  });
}
