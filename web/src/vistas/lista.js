import { h } from '../dom.js';
import { tarjeta } from '../componentes/tarjeta.js';
import { agruparPorDia, bloqueSinActividades, estadoVacio, folio } from './comun.js';

/** Lista de actividades agrupadas por día, en orden cronológico. */
export function renderLista(contenedor, { eventos, filtros, sedePorId, avisos, diasSinActividades, hayFiltros, alAbrir, alLimpiar }) {
  const dias = agruparPorDia({ eventos, filtros, diasSinActividades, hayFiltros });
  if (!dias.size) return contenedor.replaceChildren(estadoVacio(alLimpiar));

  const hijos = [];
  for (const [fecha, deldia] of dias) {
    hijos.push(folio(fecha), deldia ? h('ul', { class: 'grid gap-3' }, deldia.map((e) => tarjeta(e, sedePorId, alAbrir))) : bloqueSinActividades(avisos[fecha]));
  }
  contenedor.replaceChildren(...hijos);
}
