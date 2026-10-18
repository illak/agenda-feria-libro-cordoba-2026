import { h } from '../dom.js';
import { horaLocal } from '../data/tiempo.js';
import { momentos } from '../estado/superposicion.js';
import { tarjetaCompacta } from '../componentes/tarjeta-compacta.js';
import { agruparPorDia, bloqueSinActividades, estadoVacio, folio } from './comun.js';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function bloqueMomento(m, { sedePorId, alAbrir }) {
  const n = m.empiezan.length;
  const hora = horaLocal(m.inicio);
  return h(
    'section',
    { class: `momento${n === 1 ? ' momento--sola' : ''}`, 'aria-label': `${hora}: ${plural(n, 'actividad empieza', 'actividades empiezan')}` },
    h('header', { class: 'momento__cab' }, h('time', { datetime: m.inicio }, hora), h('span', {}, n > 1 ? `${n} empiezan a la vez` : '1 actividad')),
    h('ul', { class: 'momento__lista' }, m.empiezan.map((e) => tarjetaCompacta(e, sedePorId, alAbrir))),
    m.siguen.length
      ? h(
          'details',
          { class: 'momento__siguen' },
          h('summary', {}, m.siguen.length === 1 ? '1 sigue en curso' : `${m.siguen.length} siguen en curso`),
          h('ul', { class: 'momento__lista' }, m.siguen.map((e) => tarjetaCompacta(e, sedePorId, alAbrir, { conInicio: true }))),
        )
      : null,
  );
}

/** Actividades agrupadas por hora de inicio, para decidir a cuál ir cuando varias pasan a la vez. */
export function renderSimultaneas(contenedor, { eventos, filtros, sedePorId, orden, avisos, diasSinActividades, hayFiltros, alAbrir, alLimpiar }) {
  const dias = agruparPorDia({ eventos, filtros, diasSinActividades, hayFiltros });
  if (!dias.size) return contenedor.replaceChildren(estadoVacio(alLimpiar));

  const hijos = [];
  for (const [fecha, deldia] of dias) {
    hijos.push(folio(fecha));
    if (!deldia) hijos.push(bloqueSinActividades(avisos[fecha]));
    else hijos.push(h('div', { class: 'grid gap-4' }, momentos(deldia, orden).map((m) => bloqueMomento(m, { sedePorId, alAbrir }))));
  }
  contenedor.replaceChildren(...hijos);
}
