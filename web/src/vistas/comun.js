// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { h } from '../dom.js';
import { etiquetaDia } from '../data/tiempo.js';

export const folio = (fecha) => {
  const d = etiquetaDia(fecha);
  return h('h2', { class: 'font-serif text-3xl font-bold mt-6 mb-3 capitalize' }, d.semana, ' ', d.numero, h('small', { class: 'font-sans text-base font-medium text-tinta-suave ml-2' }, d.mes));
};

export const bloqueSinActividades = (aviso) =>
  h(
    'div',
    { class: 'rounded-xl border border-borde bg-tarjeta p-4', role: 'note' },
    h('p', { class: 'font-semibold' }, 'Sin actividades programadas este día'),
    aviso ? h('p', { class: 'mt-1' }, aviso) : null,
  );

export const estadoVacio = (alLimpiar) =>
  h(
    'div',
    { class: 'rounded-xl border border-borde bg-tarjeta p-4 grid gap-3 justify-items-start mt-4' },
    h('p', { class: 'font-semibold' }, 'No hay actividades que coincidan con los filtros.'),
    h('button', { class: 'boton', type: 'button', onClick: alLimpiar }, 'Limpiar filtros'),
  );

/**
 * Agrupa los resultados por día. Los días sin ninguna actividad en los datos (`diasSinActividades`, ej. el 10/11)
 * entran con valor null para mostrar su aviso; si hay filtros activos solo cuando se eligió ese único día.
 * @returns Map fecha -> eventos | null, ordenado por fecha
 */
export function agruparPorDia({ eventos, filtros, diasSinActividades, hayFiltros }) {
  const porFecha = new Map();
  for (const e of eventos) {
    if (!porFecha.has(e.fecha)) porFecha.set(e.fecha, []);
    porFecha.get(e.fecha).push(e);
  }
  const unSoloDia = Boolean(filtros.desde) && filtros.desde === filtros.hasta;
  if (!hayFiltros || unSoloDia) {
    for (const d of diasSinActividades) {
      if (!filtros.desde || (d >= filtros.desde && d <= filtros.hasta)) porFecha.set(d, null);
    }
  }
  return new Map([...porFecha].sort(([a], [b]) => (a < b ? -1 : 1)));
}
