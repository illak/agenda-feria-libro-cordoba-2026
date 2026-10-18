import { h } from '../dom.js';

// Glifo por color de carpa: refuerzo no cromático (roja, naranja y magenta se confunden).
const GLIFOS = { naranja: '●', roja: '▲', azul: '■', magenta: '◆', turquesa: '★', gris: '○' };

export const colorDe = (sede) => `var(--color-carpa-${sede.color in GLIFOS ? sede.color : 'gris'})`;
export const glifoDe = (sede) => GLIFOS[sede.color] ?? GLIFOS.gris;

export function chipCarpa(sede) {
  return h('span', { class: 'chip-carpa', style: `--c:${colorDe(sede)}` }, h('span', { 'aria-hidden': 'true' }, glifoDe(sede)), sede.nombre);
}
