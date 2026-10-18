// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
// Lo que un evento aporta a un calendario externo (.ics y enlace de Google), calculado en un solo lugar.
import { ROL_LARGO } from '../data/roles.js';
import { finDe, finEsEstimado } from './superposicion.js';

const UNA_HORA = 3_600_000;
const MAX_TITULO = 120;

export const tituloCorto = (e) => (e.titulo.length > MAX_TITULO ? `${e.titulo.slice(0, MAX_TITULO - 1).trimEnd()}…` : e.titulo);

/** Instante en el formato de calendario, siempre en UTC (los datos están en -03:00 fijo): 20261030T220000Z. */
export function aUTC(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Inicio y fin en UTC. Si el programa no trae hora de fin se usa la estimada; si tampoco hay una
 * posterior al inicio, se asume una hora. `aproximado` avisa que el fin no viene del programa.
 */
export function intervaloUTC(e) {
  const inicio = Date.parse(e.hora_inicio);
  let fin = Date.parse(finDe(e));
  let aproximado = finEsEstimado(e);
  if (!(fin > inicio)) {
    fin = inicio + UNA_HORA;
    aproximado = true;
  }
  return { inicio: aUTC(e.hora_inicio), fin: aUTC(new Date(fin).toISOString()), aproximado };
}

export function ubicacion(sede) {
  return [sede.nombre, sede.direccion].filter(Boolean).join(', ');
}

/** Enlace que abre la actividad en la app (`urlApp` es la dirección de la página). */
export const enlaceEvento = (urlApp, id) => `${urlApp}?evento=${encodeURIComponent(id)}`;

/**
 * Texto de la descripción: personas con su rol, libro, ciclo, el texto del programa y el aviso de hora aproximada.
 * @param maxPrograma recorta el texto del programa (el enlace de Google tiene un límite de largo)
 */
export function descripcionDe(e, { urlApp, maxPrograma = Infinity }) {
  const lineas = [];
  if (e.titulo.length > MAX_TITULO) lineas.push(e.titulo, '');

  const porRol = new Map();
  for (const p of e.personas) {
    const rol = ROL_LARGO[p.rol] ?? p.rol;
    porRol.set(rol, [...(porRol.get(rol) ?? []), p.nombre]);
  }
  for (const [rol, nombres] of porRol) lineas.push(`${rol}: ${nombres.join(', ')}`);

  if (e.libros_presentados.length) {
    lineas.push(`${e.libros_presentados.length > 1 ? 'Libros presentados' : 'Libro presentado'}: ${e.libros_presentados.join(' · ')}${e.editorial ? ` (${e.editorial})` : ''}`);
  }
  if (e.ciclo) lineas.push(`Ciclo: ${e.ciclo}`);

  if (e.descripcion) {
    const t = e.descripcion.length > maxPrograma ? `${e.descripcion.slice(0, maxPrograma).trimEnd()}…` : e.descripcion;
    lineas.push('', t);
  }
  if (intervaloUTC(e).aproximado) lineas.push('', 'La hora de fin es aproximada: el programa no la informa.');
  lineas.push('', `Más información: ${enlaceEvento(urlApp, e.id)}`, 'Agenda no oficial de la Feria del Libro Córdoba 2026.');
  return lineas.join('\n');
}
