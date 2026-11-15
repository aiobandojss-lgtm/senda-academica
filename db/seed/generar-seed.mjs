#!/usr/bin/env node
// Genera datos FICTICIOS pero realistas para Senda, la plataforma académica de la Fundación.
// Uso:  node db/seed/generar-seed.mjs [--fecha-referencia 2026-11-21] [--estudiantes 60] [--aviso-version 2026-11]
// Salida: db/seed/seed.sql, db/seed/placeholder.pdf y db/seed/CUENTAS-DEMO.md
//
// - Es determinista: con los mismos parámetros produce exactamente los mismos datos.
// - Las cuotas se calculan respecto a la fecha de referencia (el día de la demo), para que
//   los perfiles de cartera (al día, en riesgo, bloqueado, con excepción) se vean igual ese día.
// - Documentos con prefijo 99 y celulares vacíos: no corresponden a personas reales.
// - Todas las cuentas usan la contraseña de demostración "Demo2026*".
// - --aviso-version debe coincidir con la variable AVISO_PRIVACIDAD_VERSION del Worker.

import { pbkdf2Sync } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- Parámetros ----------
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), [])
);
const FECHA_REF = args['fecha-referencia'] ?? '2026-11-21';
const N_ESTUDIANTES = Number(args['estudiantes'] ?? 60);
const PASSWORD_DEMO = 'Demo2026*';
const AVISO_VERSION = args['aviso-version'] ?? '2026-11';
const DIR = dirname(fileURLToPath(import.meta.url));
if (!/^\d{4}-\d{2}-\d{2}$/.test(FECHA_REF)) throw new Error('--fecha-referencia debe ser YYYY-MM-DD');
if (N_ESTUDIANTES < 10) throw new Error('--estudiantes debe ser al menos 10');

// ---------- Utilidades ----------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(2026);
const entre = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const fecha = (s) => new Date(`${s}T00:00:00Z`);
const iso = (d) => d.toISOString().slice(0, 10);
const sumarDias = (s, n) => { const d = fecha(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const sumarMeses = (s, n) => { const d = fecha(s); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };
const diasEntre = (a, b) => Math.round((fecha(b) - fecha(a)) / 86400000);
// Fecha límite a las 23:59 de Colombia (UTC-5) expresada en UTC.
const limiteBogota = (s) => `${sumarDias(s, 1)}T04:59:00Z`;
const horaBogota = (s, h, m) => { const hh = h + 5; return hh >= 24 ? `${sumarDias(s, 1)}T${String(hh - 24).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z` : `${s}T${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`; };

function hashPassword(password) {
  const sal = Buffer.from(Array.from({ length: 16 }, () => entre(0, 255)));
  const hash = pbkdf2Sync(password, sal, 100000, 32, 'sha256');
  return `pbkdf2_sha256$100000$${sal.toString('base64')}$${hash.toString('base64')}`;
}

function quitarTildes(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }

// Regla de bloqueo (misma que la spec bloqueo-mora), para verificar los perfiles generados.
function estadoMora(cuotas, excepciones, hoy) {
  const vencidas = cuotas.filter((c) => c.saldo > 0 && c.vence < hoy);
  const maxAtraso = vencidas.reduce((m, c) => Math.max(m, diasEntre(c.vence, hoy)), 0);
  const excepcion = excepciones.some((e) => e.hasta >= hoy);
  if (maxAtraso > 30) return excepcion ? 'con_excepcion' : 'bloqueado';
  if (maxAtraso > 0) return 'en_riesgo';
  return 'al_dia';
}

// ---------- Catálogos ficticios ----------
const NOMBRES_M = ['Juan Camilo', 'Andrés Felipe', 'Santiago', 'Sebastián', 'Carlos Andrés', 'Jhon Fredy', 'Daniel', 'Brayan Stiven', 'Luis Miguel', 'Julián David', 'Kevin', 'Cristian Camilo', 'Diego Alejandro', 'Jorge Iván', 'Mateo', 'Esteban', 'Óscar Eduardo', 'Wilmer', 'Duván', 'Yeison'];
const NOMBRES_F = ['María Fernanda', 'Valentina', 'Daniela', 'Laura Sofía', 'Ana María', 'Luisa Fernanda', 'Paola Andrea', 'Yuliana', 'Natalia', 'Sara', 'Leidy Johana', 'Carolina', 'Angie Paola', 'Manuela', 'Isabella', 'Diana Marcela', 'Yesica', 'Lina Marcela', 'Katherine', 'Mariana'];
const APELLIDOS = ['Gómez', 'Rodríguez', 'Martínez', 'López', 'González', 'Hernández', 'García', 'Ramírez', 'Sánchez', 'Torres', 'Rojas', 'Díaz', 'Moreno', 'Muñoz', 'Vargas', 'Castro', 'Ospina', 'Valencia', 'Cardona', 'Mosquera', 'Quintero', 'Restrepo', 'Arango', 'Zapata', 'Ortiz', 'Caicedo', 'Bermúdez', 'Patiño', 'Riascos', 'Londoño', 'Giraldo', 'Mejía', 'Escobar', 'Velásquez', 'Hurtado', 'Sinisterra'];

const CARRERAS = [
  { codigo: 'TL-AADM', nombre: 'Técnico Laboral en Auxiliar Administrativo', descripcion: 'Forma auxiliares para apoyar procesos administrativos, gestión documental y atención al cliente.',
    cursos: [
      { nombre: 'Gestión documental', temas: ['Clasificación y archivo de documentos', 'Tablas de retención documental', 'Organización de un archivo de gestión', 'Normas de archivo en Colombia'] },
      { nombre: 'Herramientas ofimáticas', temas: ['Elaboración de cartas comerciales', 'Tablas y gráficos en hoja de cálculo', 'Presentación institucional', 'Combinación de correspondencia'] },
      { nombre: 'Atención y servicio al cliente', temas: ['Protocolo de atención telefónica', 'Manejo de peticiones, quejas y reclamos', 'Caso de cliente insatisfecho', 'Ciclo del servicio'] },
    ] },
  { codigo: 'TL-ACF', nombre: 'Técnico Laboral en Auxiliar Contable y Financiero', descripcion: 'Forma auxiliares en registro contable, facturación y apoyo a procesos financieros de pequeñas empresas.',
    cursos: [
      { nombre: 'Fundamentos de contabilidad', temas: ['Ecuación contable y cuentas', 'Registro de transacciones en el libro diario', 'Balance de prueba', 'Ciclo contable completo'] },
      { nombre: 'Legislación tributaria básica', temas: ['IVA y retención en la fuente', 'Facturación electrónica: conceptos', 'Calendario tributario', 'Obligaciones de un comerciante'] },
      { nombre: 'Hoja de cálculo para finanzas', temas: ['Fórmulas y referencias', 'Conciliación bancaria en hoja de cálculo', 'Flujo de caja mensual', 'Tablas dinámicas'] },
    ] },
  { codigo: 'TL-PSW', nombre: 'Técnico Laboral en Programación de Software', descripcion: 'Forma programadores junior en lógica de programación, bases de datos y desarrollo web.',
    cursos: [
      { nombre: 'Lógica de programación', temas: ['Algoritmos y diagramas de flujo', 'Condicionales y ciclos', 'Funciones y arreglos', 'Resolución de problemas'] },
      { nombre: 'Bases de datos', temas: ['Modelo entidad-relación', 'Consultas SQL básicas', 'Normalización', 'Diseño de una base de datos'] },
      { nombre: 'Desarrollo web básico', temas: ['Estructura de una página en HTML', 'Estilos con CSS', 'Formulario con validación en JavaScript', 'Sitio web responsivo'] },
    ] },
  { codigo: 'TL-API', nombre: 'Técnico Laboral en Atención Integral a la Primera Infancia', descripcion: 'Forma agentes educativos para el cuidado, la educación inicial y el desarrollo de niños de 0 a 5 años.',
    cursos: [
      { nombre: 'Desarrollo infantil', temas: ['Etapas del desarrollo de 0 a 5 años', 'Hitos del desarrollo motor', 'Observación de un niño', 'Desarrollo socioafectivo'] },
      { nombre: 'Pedagogía y juego', temas: ['El juego como estrategia pedagógica', 'Planeación de una experiencia pedagógica', 'Material didáctico reciclado', 'Ambientes de aprendizaje'] },
      { nombre: 'Nutrición y salud infantil', temas: ['Minuta para un centro infantil', 'Lavado de manos y prevención', 'Lectura de la curva de crecimiento', 'Primeros auxilios pediátricos'] },
    ] },
  { codigo: 'TL-SST', nombre: 'Técnico Laboral en Seguridad y Salud en el Trabajo', descripcion: 'Forma auxiliares para apoyar el sistema de gestión de seguridad y salud en el trabajo de las empresas.',
    cursos: [
      { nombre: 'Fundamentos de SST', temas: ['Conceptos básicos de SST', 'Roles en el SG-SST', 'Política de SST de una empresa', 'Ciclo PHVA en SST'] },
      { nombre: 'Identificación de peligros', temas: ['Matriz de peligros', 'Inspección de un puesto de trabajo', 'Valoración de riesgos', 'Plan de emergencias'] },
      { nombre: 'Normatividad en SST', temas: ['Decreto 1072 de 2015: generalidades', 'Resolución 0312 de 2019: estándares mínimos', 'Reporte de accidentes de trabajo', 'Comité paritario (COPASST)'] },
    ] },
];

const DOCENTES = [
  ['Claudia Patricia', 'Mejía Arango'], ['Hernán Darío', 'Valencia Ortiz'], ['Liliana', 'Caicedo Riascos'],
  ['Mónica Andrea', 'Restrepo Gil'], ['Fabio Alberto', 'Quintero Salazar'],
];
const COMENTARIOS_ALTOS = ['Excelente trabajo, muy completo.', 'Muy buen análisis, sigue así.', 'Trabajo claro y bien presentado.'];
const COMENTARIOS_MEDIOS = ['Buen trabajo; revisa la redacción de las conclusiones.', 'Cumple con lo pedido; faltó profundizar en el segundo punto.', 'Bien en general; cuida la ortografía.'];
const COMENTARIOS_BAJOS = ['Faltan puntos del taller; revisa las instrucciones.', 'El trabajo está incompleto; podemos revisarlo en clase.'];

// ---------- Generación ----------
const sql = [];
const add = (s) => sql.push(s);
const ADMIN_ID = 1;
const fechasCuotas = (() => {
  const r = fecha(FECHA_REF);
  const inicio = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() - 3, 5));
  return Array.from({ length: 6 }, (_, i) => sumarMeses(iso(inicio), i));
})();
const fechaMatricula = sumarDias(fechasCuotas[0], -11);
const fechaIngreso = sumarDias(fechasCuotas[0], -4);
const anioIng = Number(fechaIngreso.slice(0, 4));
const cohorte = `${anioIng}-${Number(fechaIngreso.slice(5, 7)) >= 7 ? 2 : 1}`;

add('-- ============================================================');
add('-- DATOS FICTICIOS DE DEMOSTRACIÓN. No corresponden a personas reales.');
add(`-- Generado por db/seed/generar-seed.mjs con fecha de referencia ${FECHA_REF}.`);
add('-- Contraseña de todas las cuentas: Demo2026*');
add('-- ============================================================');
add('DELETE FROM excepciones_mora;'); add('DELETE FROM pagos;'); add('DELETE FROM cuotas;'); add('DELETE FROM entregas;');
add('DELETE FROM actividades;'); add('DELETE FROM inscripciones;'); add('DELETE FROM cursos;'); add('DELETE FROM estudiantes;');
add('DELETE FROM intentos_fallidos;'); add('DELETE FROM usuarios;'); add('DELETE FROM carreras;');
add('');

// Usuarios: administrador y docentes
const usuarios = [];
usuarios.push({ id: ADMIN_ID, rol: 'admin', documento: '9900000001', nombres: 'Administración', apellidos: 'Fundación', correo: 'admin@demo.test' });
DOCENTES.forEach(([n, a], i) => usuarios.push({ id: 2 + i, rol: 'docente', documento: `99000001${String(i + 1).padStart(2, '0')}`, nombres: n, apellidos: a,
  correo: `${quitarTildes(n.split(' ')[0]).toLowerCase()}.${quitarTildes(a.split(' ')[0]).toLowerCase()}@demo.test` }));

// Carreras y cursos
const cursos = [];
CARRERAS.forEach((c, i) => {
  c.id = i + 1;
  add(`INSERT INTO carreras (id, codigo, nombre, descripcion, duracion_semestres, activa) VALUES (${c.id}, ${q(c.codigo)}, ${q(c.nombre)}, ${q(c.descripcion)}, 3, 1);`);
});

// Estudiantes con perfiles de cartera
const PERFILES_DEMO = [
  { perfil: 'al_dia', nota: 'Flujo principal de la demo (entrega y nota)' },
  { perfil: 'en_mora', nota: 'Bloqueado: dos cuotas sin pagar' },
  { perfil: 'en_riesgo', nota: 'Última cuota vencida hace menos de 30 días: puede entrar' },
  { perfil: 'excepcion', nota: 'En mora pero con excepción vigente: puede entrar' },
  { perfil: 'mora_parcial', nota: 'Bloqueado: abonó parte de la cuota vencida' },
  { perfil: 'al_dia', primerIngreso: true, nota: 'Primer ingreso: debe cambiar la contraseña temporal y aceptar el aviso de privacidad' },
];
const usados = new Set();
const estudiantes = [];
for (let i = 0; i < N_ESTUDIANTES; i++) {
  let nombres, apellidos, clave;
  do {
    nombres = rnd() < 0.55 ? elegir(NOMBRES_F) : elegir(NOMBRES_M);
    const a1 = elegir(APELLIDOS); let a2 = elegir(APELLIDOS); while (a2 === a1) a2 = elegir(APELLIDOS);
    apellidos = `${a1} ${a2}`; clave = `${nombres}|${apellidos}`;
  } while (usados.has(clave));
  usados.add(clave);
  const demo = i < PERFILES_DEMO.length;
  const carrera = demo ? CARRERAS[2] : CARRERAS[(i - PERFILES_DEMO.length) % CARRERAS.length];
  const r = rnd();
  const perfil = demo ? PERFILES_DEMO[i].perfil : r < 0.75 ? 'al_dia' : r < 0.87 ? 'en_riesgo' : r < 0.97 ? 'en_mora' : 'mora_parcial';
  const id = 100 + i;
  const base = `${quitarTildes(nombres.split(' ')[0]).toLowerCase()}.${quitarTildes(apellidos.split(' ')[0]).toLowerCase()}`;
  estudiantes.push({ id, nombres, apellidos, carrera, perfil, demo: demo ? PERFILES_DEMO[i].nota : null,
    primerIngreso: demo && PERFILES_DEMO[i].primerIngreso === true,
    documento: `99000${String(1001 + i).padStart(5, '0')}`, correo: `${base}${i + 1}@demo.test` });
}

// Las cuentas normales ya cambiaron su contraseña y aceptaron el aviso de privacidad (D16);
// la cuenta de primer ingreso no, para poder mostrar ese flujo en la demo.
const avisoAceptadoEn = `${fechaIngreso}T13:00:00Z`;
for (const u of [...usuarios, ...estudiantes.map((e) => ({ ...e, rol: 'estudiante' }))]) {
  const primerIngreso = u.primerIngreso === true;
  add(`INSERT INTO usuarios (id, rol, tipo_documento, documento, nombres, apellidos, correo, celular, password_hash, debe_cambiar_password, aviso_version_aceptada, aviso_aceptado_en, activo) VALUES (${u.id}, ${q(u.rol)}, 'CC', ${q(u.documento)}, ${q(u.nombres)}, ${q(u.apellidos)}, ${q(u.correo)}, NULL, ${q(hashPassword(PASSWORD_DEMO))}, ${primerIngreso ? 1 : 0}, ${primerIngreso ? 'NULL' : q(AVISO_VERSION)}, ${primerIngreso ? 'NULL' : q(avisoAceptadoEn)}, 1);`);
}
for (const e of estudiantes) {
  add(`INSERT INTO estudiantes (usuario_id, carrera_id, semestre_actual, cohorte, fecha_ingreso) VALUES (${e.id}, ${e.carrera.id}, 1, ${q(cohorte)}, ${q(fechaIngreso)});`);
}

let cursoId = 1;
CARRERAS.forEach((c, i) => c.cursos.forEach((cu) => {
  cu.id = cursoId++; cu.carrera = c; cu.docenteId = 2 + i;
  cursos.push(cu);
  add(`INSERT INTO cursos (id, carrera_id, nombre, semestre, docente_id, activo) VALUES (${cu.id}, ${c.id}, ${q(cu.nombre)}, 1, ${cu.docenteId}, 1);`);
}));
for (const e of estudiantes) for (const cu of e.carrera.cursos) add(`INSERT INTO inscripciones (curso_id, estudiante_id) VALUES (${cu.id}, ${e.id});`);

// Actividades: T1 (vencido), T2 (vencido), T3 (abierto, para la demo en vivo), evaluación (futura); un borrador.
let actId = 1;
const actividades = [];
for (const cu of cursos) {
  const plan = [
    { tipo: 'taller', titulo: `Taller 1: ${cu.temas[0]}`, dias: -25 },
    { tipo: 'taller', titulo: `Taller 2: ${cu.temas[1]}`, dias: -7 },
    { tipo: 'taller', titulo: `Taller 3: ${cu.temas[2]}`, dias: 3 },
    { tipo: 'evaluacion', titulo: `Evaluación parcial: ${cu.temas[3]}`, dias: 10 },
  ];
  for (const [k, p] of plan.entries()) {
    const a = { id: actId++, curso: cu, orden: k + 1, ...p, limite: limiteBogota(sumarDias(FECHA_REF, p.dias)) };
    actividades.push(a);
    const instr = p.tipo === 'taller'
      ? `Desarrolla el taller sobre "${p.titulo.split(': ')[1]}" siguiendo la guía vista en clase. Entrega un documento en PDF con portada, desarrollo de cada punto y conclusiones.`
      : `Evaluación individual sobre "${p.titulo.split(': ')[1]}". Responde las preguntas de la guía y entrega tus respuestas en PDF.`;
    add(`INSERT INTO actividades (id, curso_id, tipo, titulo, instrucciones, fecha_limite, archivo_apoyo_key, publicada) VALUES (${a.id}, ${cu.id}, ${q(p.tipo)}, ${q(p.titulo)}, ${q(instr)}, ${q(a.limite)}, NULL, 1);`);
  }
}
const cursoDemo = CARRERAS[2].cursos[0];
add(`INSERT INTO actividades (id, curso_id, tipo, titulo, instrucciones, fecha_limite, archivo_apoyo_key, publicada) VALUES (${actId}, ${cursoDemo.id}, 'taller', 'Taller 4: Proyecto integrador (borrador)', 'Borrador del docente: aún no visible para estudiantes.', ${q(limiteBogota(sumarDias(FECHA_REF, 20)))}, NULL, 0);`);

// Entregas
let entId = 1;
const docentePorCurso = (cu) => cu.docenteId;
function nota() { const r = rnd(); const n = r < 0.08 ? entre(15, 29) : r < 0.35 ? entre(30, 37) : r < 0.8 ? entre(38, 45) : entre(46, 50); return n / 10; }
for (const a of actividades) {
  const inscritos = estudiantes.filter((e) => e.carrera.id === a.curso.carrera.id);
  for (const e of inscritos) {
    const esDemoPrincipal = e.documento === estudiantes[0].documento;
    let entrega = false, calificar = false;
    if (a.orden === 1) { entrega = rnd() < 0.9 || esDemoPrincipal; calificar = true; }
    else if (a.orden === 2) { entrega = rnd() < 0.72 || esDemoPrincipal; calificar = rnd() < 0.55 || esDemoPrincipal; }
    else if (a.orden === 3) { entrega = !esDemoPrincipal && rnd() < 0.3; calificar = false; }
    if (!entrega) continue;
    const limiteDia = sumarDias(FECHA_REF, a.dias);
    const tardia = a.orden <= 2 && rnd() < 0.1 && !esDemoPrincipal;
    const diaEntrega = tardia ? sumarDias(limiteDia, entre(1, 3)) : sumarDias(limiteDia, -entre(0, 4));
    const entregadoEn = horaBogota(diaEntrega, entre(7, 22), entre(0, 59));
    const apellido = quitarTildes(e.apellidos.split(' ')[0]).toLowerCase();
    let n = null, com = null, calEn = null, calPor = null;
    if (calificar) {
      n = nota(); com = n >= 4.5 ? elegir(COMENTARIOS_ALTOS) : n >= 3.5 ? elegir(COMENTARIOS_MEDIOS) : n < 3 ? elegir(COMENTARIOS_BAJOS) : null;
      calEn = horaBogota(sumarDias(limiteDia, entre(2, 5)), entre(8, 20), entre(0, 59)); calPor = docentePorCurso(a.curso);
    }
    // "Tardía" no se guarda (D20): se deduce de entregado_en > fecha_limite.
    add(`INSERT INTO entregas (id, actividad_id, estudiante_id, archivo_key, nombre_archivo, tipo_mime, tamano_bytes, entregado_en, nota, comentario, calificado_en, calificado_por) VALUES (${entId++}, ${a.id}, ${e.id}, 'seed/placeholder.pdf', ${q(`taller${a.orden}_${apellido}.pdf`)}, 'application/pdf', ${entre(150000, 2500000)}, ${q(entregadoEn)}, ${n === null ? 'NULL' : n.toFixed(1)}, ${q(com)}, ${q(calEn)}, ${q(calPor)});`);
  }
}

// Cuotas, pagos y excepciones
let cuotaId = 1, pagoId = 1, excId = 1;
const resumen = { al_dia: 0, en_riesgo: 0, bloqueado: 0, con_excepcion: 0 };
const MEDIOS = ['transferencia', 'transferencia', 'consignacion', 'efectivo'];
for (const e of estudiantes) {
  const cuotas = [
    { concepto: `Matrícula ${cohorte}`, valor: 200000, vence: fechaMatricula },
    ...fechasCuotas.map((f, i) => ({ concepto: `Mensualidad ${i + 1}/6`, valor: 180000, vence: f })),
  ].map((c) => ({ ...c, id: cuotaId++, saldo: c.valor }));
  const vencidas = cuotas.filter((c) => c.vence < FECHA_REF);
  const ultima = vencidas.at(-1), penultima = vencidas.at(-2);
  const sinPagar = new Set(); const parcial = new Set();
  if (e.perfil === 'en_riesgo') sinPagar.add(ultima.id);
  if (e.perfil === 'en_mora' || e.perfil === 'excepcion') { sinPagar.add(ultima.id); sinPagar.add(penultima.id); }
  if (e.perfil === 'mora_parcial') { sinPagar.add(ultima.id); parcial.add(penultima.id); }

  for (const c of cuotas) add(`INSERT INTO cuotas (id, estudiante_id, concepto, valor, fecha_vencimiento) VALUES (${c.id}, ${e.id}, ${q(c.concepto)}, ${c.valor}, ${q(c.vence)});`);
  const pagar = (c, valor, dia) => {
    add(`INSERT INTO pagos (id, cuota_id, valor, fecha_pago, medio, soporte_key, registrado_por, registrado_en, anulado) VALUES (${pagoId++}, ${c.id}, ${valor}, ${q(dia)}, ${q(elegir(MEDIOS))}, NULL, ${ADMIN_ID}, ${q(horaBogota(dia, entre(8, 17), entre(0, 59)))}, 0);`);
    c.saldo -= valor;
  };
  for (const c of vencidas) {
    if (sinPagar.has(c.id)) continue;
    const dia = sumarDias(c.vence, -entre(0, 6));
    if (parcial.has(c.id)) { pagar(c, 100000, sumarDias(c.vence, entre(3, 10))); continue; }
    if (rnd() < 0.12) { pagar(c, 100000, dia); pagar(c, c.valor - 100000, sumarDias(dia, entre(5, 12))); }
    else pagar(c, c.valor, dia);
  }
  // Ejemplo de pago anulado en la cuenta principal de la demo
  if (e === estudiantes[0]) {
    const c = vencidas.at(-1);
    add(`INSERT INTO pagos (id, cuota_id, valor, fecha_pago, medio, soporte_key, registrado_por, registrado_en, anulado, motivo_anulacion, anulado_por, anulado_en) VALUES (${pagoId++}, ${c.id}, 18000, ${q(sumarDias(c.vence, -2))}, 'transferencia', NULL, ${ADMIN_ID}, ${q(horaBogota(sumarDias(c.vence, -2), 9, 40))}, 1, 'Valor digitado errado (era 180.000)', ${ADMIN_ID}, ${q(horaBogota(sumarDias(c.vence, -2), 10, 15))});`);
  }
  const excepciones = [];
  if (e.perfil === 'excepcion') {
    const hasta = sumarDias(FECHA_REF, 9);
    excepciones.push({ hasta });
    add(`INSERT INTO excepciones_mora (id, estudiante_id, motivo, hasta, creado_por) VALUES (${excId++}, ${e.id}, ${q(`Acuerdo de pago: se pone al día a más tardar el ${hasta}`)}, ${q(hasta)}, ${ADMIN_ID});`);
  }
  e.estado = estadoMora(cuotas, excepciones, FECHA_REF);
  const esperado = { al_dia: 'al_dia', en_riesgo: 'en_riesgo', en_mora: 'bloqueado', mora_parcial: 'bloqueado', excepcion: 'con_excepcion' }[e.perfil];
  if (e.estado !== esperado) console.warn(`AVISO: ${e.documento} quedó "${e.estado}" y se esperaba "${esperado}" (revisa la fecha de referencia).`);
  resumen[e.estado]++;
}

// ---------- Salidas ----------
mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, 'seed.sql'), sql.join('\n') + '\n', 'utf8');

function pdfMinimo(lineas) {
  const texto = lineas.map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 72 ${740 - i * 22} Td (${l.replace(/[()\\]/g, '\\$&')}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(texto, 'latin1')} >>\nstream\n${texto}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
writeFileSync(join(DIR, 'placeholder.pdf'), pdfMinimo(['Entrega de demostracion', 'Archivo ficticio generado para la demo de la plataforma.', 'Las entregas reales reemplazan este archivo.']));

const fila = (u, rol, extra = '') => `| ${u.documento} | ${rol} | ${u.nombres} ${u.apellidos} | ${extra} |`;
const md = [
  '# Cuentas de demostración',
  '',
  `Datos ficticios generados con fecha de referencia **${FECHA_REF}**. Contraseña de todas las cuentas: \`${PASSWORD_DEMO}\``,
  '',
  '| Documento (usuario) | Rol | Nombre | Para qué sirve en la demo |',
  '|---|---|---|---|',
  fila(usuarios[0], 'Administrador', 'Registrar pagos, excepciones y ver cartera'),
  fila(usuarios[3], 'Docente', `Docente de ${CARRERAS[2].nombre} (cursos de los estudiantes demo)`),
  ...estudiantes.slice(0, PERFILES_DEMO.length).map((e) => fila(e, `Estudiante (${{ al_dia: 'al día', en_riesgo: 'en riesgo', bloqueado: 'bloqueado', con_excepcion: 'con excepción' }[e.estado]}${e.primerIngreso ? ', primer ingreso' : ''})`, e.demo)),
  '',
  `Resumen de los ${N_ESTUDIANTES} estudiantes en la fecha de referencia: ${resumen.al_dia} al día, ${resumen.en_riesgo} en riesgo, ${resumen.bloqueado} bloqueados, ${resumen.con_excepcion} con excepción vigente.`,
  '',
  `Todas las cuentas ya aceptaron la versión \`${AVISO_VERSION}\` del aviso de privacidad, excepto la de primer ingreso (la variable \`AVISO_PRIVACIDAD_VERSION\` del Worker debe tener ese mismo valor). La cuenta de primer ingreso usa \`${PASSWORD_DEMO}\` como contraseña temporal: después de cambiarla, regenera y recarga el seed para repetir la demo.`,
  '',
  `Para la demo en vivo, el estudiante al día tiene pendiente el "Taller 3" de ${cursoDemo.nombre}, con fecha límite ${sumarDias(FECHA_REF, 3)}.`,
  '',
].join('\n');
writeFileSync(join(DIR, 'CUENTAS-DEMO.md'), md, 'utf8');

console.log(`seed.sql generado: ${sql.length} líneas, ${usuarios.length + estudiantes.length} usuarios, ${entId - 1} entregas, ${cuotaId - 1} cuotas, ${pagoId - 1} pagos.`);
console.log(`Estados en ${FECHA_REF}:`, resumen);
