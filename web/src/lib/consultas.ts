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

// ---- Docente y estudiante (tarea 4.4) ----

export type EstadoEntrega = "sin_entregar" | "entregada" | "tardia" | "calificada";
export type Entrega = {
  id: number | null;
  estado: EstadoEntrega;
  tardia: boolean;
  entregadoEn: string | null;
  nombreArchivo: string | null;
  nota: number | null;
  comentario: string | null;
};

type ActividadBase = {
  id: number;
  cursoId: number;
  tipo: "taller" | "evaluacion";
  titulo: string;
  instrucciones: string;
  // UTC (D9); la interfaz la muestra en hora de Colombia
  fechaLimite: string;
  publicada: boolean;
  apoyo: { formato: string } | null;
};
export type ActividadDocente = ActividadBase & { entregas: number; calificadas: number; inscritos: number };
export type ActividadEstudiante = ActividadBase & { entrega: Entrega };
export type Pendientes = {
  pendientes: (ActividadBase & { curso: { id: number; nombre: string } })[];
  publicadas: number;
  entregadas: number;
};

export type CursoDocente = {
  id: number;
  nombre: string;
  semestre: number;
  carrera: { id: number; codigo: string; nombre: string };
  inscritos: number;
  porCalificar: number;
};
export type CursoEstudiante = {
  id: number;
  nombre: string;
  semestre: number;
  carrera: { id: number; codigo: string; nombre: string };
  docente: { nombres: string; apellidos: string } | null;
  actual: boolean;
};
export type FilaSeguimiento = { estudiante: { id: number; nombres: string; apellidos: string }; entrega: Entrega };

// Misma ruta (/api/cursos), distinta proyección según el rol de la sesión (D18)
export const useCursosDocente = () => useQuery({ queryKey: ["cursos", "docente"], queryFn: () => api.get<CursoDocente[]>("/cursos") });
export const useCursosEstudiante = () =>
  useQuery({ queryKey: ["cursos", "estudiante"], queryFn: () => api.get<CursoEstudiante[]>("/cursos") });

export const useActividadesDocente = (cursoId: number) =>
  useQuery({ queryKey: ["actividades", "curso", cursoId], queryFn: () => api.get<ActividadDocente[]>(`/cursos/${cursoId}/actividades`) });
export const useActividadesEstudiante = (cursoId: number) =>
  useQuery({ queryKey: ["actividades", "curso", cursoId], queryFn: () => api.get<ActividadEstudiante[]>(`/cursos/${cursoId}/actividades`) });

export const useActividadDocente = (id: number) =>
  useQuery({ queryKey: ["actividades", id], queryFn: () => api.get<ActividadDocente>(`/actividades/${id}`) });
export const useActividadEstudiante = (id: number) =>
  useQuery({ queryKey: ["actividades", id], queryFn: () => api.get<ActividadEstudiante>(`/actividades/${id}`) });

export const useSeguimiento = (actividadId: number) =>
  useQuery({ queryKey: ["actividades", actividadId, "entregas"], queryFn: () => api.get<FilaSeguimiento[]>(`/actividades/${actividadId}/entregas`) });

export const usePendientes = () => useQuery({ queryKey: ["actividades", "pendientes"], queryFn: () => api.get<Pendientes>("/actividades/pendientes") });

// Cambios académicos (actividades, entregas, notas): los conteos se cruzan entre cursos, actividades y
// pendientes, así que se recargan todas las consultas activas
export function useCambio<Entrada, Salida>(enviar: (entrada: Entrada) => Promise<Salida>) {
  const cliente = useQueryClient();
  return useMutation({ mutationFn: enviar, onSuccess: () => cliente.invalidateQueries() });
}
