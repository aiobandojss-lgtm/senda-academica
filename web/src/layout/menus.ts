import { BookOpen, GraduationCap, House, type LucideIcon, MessageCircleQuestion, Presentation, Users, Wallet } from "lucide-react";
import type { Rol } from "@/lib/api";
import { INICIO_POR_ROL } from "@/sesion/destino";

export type ItemMenu = { titulo: string; descripcion: string; ruta: string; icono: LucideIcon };

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administración",
  docente: "Docente",
  estudiante: "Estudiante",
};

// Secciones de cada rol (specs del cambio mvp-plataforma-academica). Las tareas 3.4, 4.4 y 5.5, y el
// asistente RAG, reemplazan la pantalla provisional de cada una; aquí solo se declara la navegación.
// Los permisos reales los aplica la API (D4): este menú no protege nada, solo organiza.
export const MENU_POR_ROL: Record<Rol, ItemMenu[]> = {
  admin: [
    { titulo: "Inicio", descripcion: "Resumen de la plataforma", ruta: INICIO_POR_ROL.admin, icono: House },
    { titulo: "Carreras y cursos", descripcion: "Carreras, cursos y docente asignado", ruta: "/admin/carreras", icono: GraduationCap },
    { titulo: "Estudiantes", descripcion: "Registro, carga masiva y estado de cartera", ruta: "/admin/estudiantes", icono: Users },
    { titulo: "Docentes", descripcion: "Cuentas de los docentes", ruta: "/admin/docentes", icono: Presentation },
    { titulo: "Cartera", descripcion: "Cuotas, pagos y acuerdos de pago", ruta: "/admin/cartera", icono: Wallet },
  ],
  docente: [
    { titulo: "Inicio", descripcion: "Lo pendiente por calificar", ruta: INICIO_POR_ROL.docente, icono: House },
    { titulo: "Mis cursos", descripcion: "Actividades, entregas y calificaciones", ruta: "/docente/cursos", icono: BookOpen },
  ],
  estudiante: [
    { titulo: "Inicio", descripcion: "Tus pendientes y tu estado de cuenta", ruta: INICIO_POR_ROL.estudiante, icono: House },
    { titulo: "Mis cursos", descripcion: "Actividades, entregas y notas", ruta: "/estudiante/cursos", icono: BookOpen },
    { titulo: "Estado de cuenta", descripcion: "Tus cuotas y pagos", ruta: "/estudiante/cuenta", icono: Wallet },
    { titulo: "Asistente académico", descripcion: "Pregunta por el reglamento, el calendario o tus notas", ruta: "/estudiante/asistente", icono: MessageCircleQuestion },
  ],
};
