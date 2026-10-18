import { h } from '../dom.js';
import { fechaHoraLegible } from '../data/tiempo.js';

export const PDF_OFICIAL = 'https://docs.google.com/document/d/1eTt9sjmE19IPcjuIwICoAJgEjKzm0vXU/export?format=pdf';
export const PROGRAMACION_OFICIAL = 'https://feriadellibro.cordoba.gob.ar/programacion/';

export function pie(meta) {
  const cuando = meta.actualizado ?? meta.generado;
  return h(
    'footer',
    { class: 'mt-10 border-t border-borde pt-4 pb-10 text-sm text-tinta-suave grid gap-2' },
    h('p', {}, cuando ? `Última actualización: ${fechaHoraLegible(cuando)}` : 'Última actualización: sin dato.'),
    h(
      'p',
      {},
      h('a', { class: 'underline', href: PDF_OFICIAL, target: '_blank', rel: 'noopener' }, 'Programación oficial en PDF'),
      ' · La grilla está sujeta a cambios.',
    ),
    h(
      'p',
      {},
      'Proyecto open source y ',
      h('strong', {}, 'no oficial'),
      ', sin vínculo con la organización de la feria. Datos: Feria del Libro Córdoba (Municipalidad de Córdoba), tomados de ',
      h('a', { class: 'underline', href: PROGRAMACION_OFICIAL, target: '_blank', rel: 'noopener' }, 'su programación'),
      '.',
    ),
  );
}
