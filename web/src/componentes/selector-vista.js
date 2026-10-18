import { h } from '../dom.js';

const VISTAS = [
  ['lista', 'Lista'],
  ['simultaneas', 'A la misma hora'],
];

/** Dos botones exclusivos para elegir cómo ver los resultados. `cambiar({ vista })`. */
export function crearSelectorVista(cambiar) {
  const botones = new Map(
    VISTAS.map(([id, texto]) => [id, h('button', { class: 'filtro grow basis-0', type: 'button', 'aria-pressed': 'false', onClick: () => cambiar({ vista: id }) }, texto)]),
  );
  const el = h('div', { class: 'flex gap-2', role: 'group', 'aria-label': 'Vista' }, [...botones.values()]);
  return {
    el,
    sync: (f) => botones.forEach((b, id) => b.setAttribute('aria-pressed', String(f.vista === id))),
  };
}
