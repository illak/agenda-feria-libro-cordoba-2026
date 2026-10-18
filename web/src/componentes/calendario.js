import { h } from '../dom.js';
import { etiquetaDia, etiquetaRango } from '../data/tiempo.js';

const SEMANA = [['L', 'lunes'], ['M', 'martes'], ['M', 'miércoles'], ['J', 'jueves'], ['V', 'viernes'], ['S', 'sábado'], ['D', 'domingo']];
const lunesPrimero = (fecha) => (new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7;

/**
 * Calendario de la feria para elegir un día o un rango, dentro de un <details>.
 * Primer toque: ese día. Segundo toque en otro día: rango entre ambos (y se cierra). Segundo toque en el mismo día: cierra.
 * @param dias fechas ISO de la feria, consecutivas
 * @param cantidades Map fecha -> cantidad de actividades (sin filtros), para mostrarla en cada celda
 * @param cambiar recibe { desde, hasta }
 */
export function crearCalendario({ dias, cantidades, hoy }, cambiar) {
  let ancla = null;
  const celdas = new Map();

  const panel = h('details', { class: 'calendario rounded-xl border border-borde bg-tarjeta' });
  const resumen = h('summary', { class: 'cursor-pointer min-h-11 flex items-center justify-between gap-3 px-3 font-semibold' });
  const ayuda = h('p', { class: 'text-sm text-tinta-suave', 'aria-live': 'polite' });

  const cerrar = () => {
    ancla = null;
    panel.open = false;
  };

  const elegir = (d) => {
    if (ancla === null) {
      ancla = d;
      cambiar({ desde: d, hasta: d });
      ayuda.textContent = 'Tocá otro día para elegir un rango, o el mismo para terminar.';
    } else if (ancla === d) {
      cerrar();
    } else {
      cambiar({ desde: ancla < d ? ancla : d, hasta: ancla < d ? d : ancla });
      cerrar();
    }
  };

  const primero = lunesPrimero(dias[0]);
  const huecos = Array.from({ length: primero }, () => h('span', { 'aria-hidden': 'true' }));
  const grilla = h(
    'div',
    { class: 'grid grid-cols-7 gap-1', role: 'group', 'aria-label': 'Días de la feria' },
    SEMANA.map(([letra, nombre]) => h('abbr', { class: 'text-center text-xs font-semibold text-tinta-suave no-underline', title: nombre }, letra)),
    huecos,
    dias.map((d) => {
      const e = etiquetaDia(d);
      const n = cantidades.get(d) ?? 0;
      const b = h(
        'button',
        {
          class: 'dia-cal',
          type: 'button',
          'aria-pressed': 'false',
          'aria-label': `${e.largo}, ${n} ${n === 1 ? 'actividad' : 'actividades'}`,
          onClick: () => elegir(d),
        },
        h('span', { class: 'dia-cal__numero' }, e.numero),
        h('span', { class: 'dia-cal__cantidad' }, n || '·'),
      );
      celdas.set(d, b);
      return b;
    }),
  );

  const atajos = h(
    'div',
    { class: 'flex flex-wrap gap-2' },
    h('button', { class: 'boton', type: 'button', onClick: () => { cambiar({ desde: '', hasta: '' }); cerrar(); } }, 'Todos los días'),
    hoy && celdas.has(hoy) ? h('button', { class: 'boton', type: 'button', onClick: () => { cambiar({ desde: hoy, hasta: hoy }); cerrar(); } }, 'Hoy') : null,
  );

  panel.append(
    resumen,
    h('div', { class: 'grid gap-3 p-3 pt-1' }, ayuda, grilla, atajos),
  );
  panel.addEventListener('toggle', () => {
    ancla = null;
    ayuda.textContent = panel.open ? 'Tocá un día, o dos para elegir un rango.' : '';
  });

  function sync(f) {
    resumen.replaceChildren(
      h('span', {}, 'Días: ', h('span', { class: 'font-normal' }, etiquetaRango(f.desde, f.hasta))),
      h('span', { 'aria-hidden': 'true', class: 'chevron' }, '▾'),
    );
    for (const [d, b] of celdas) {
      const extremo = f.desde && (d === f.desde || d === f.hasta);
      b.setAttribute('aria-pressed', String(Boolean(extremo)));
      b.toggleAttribute('data-en-rango', Boolean(f.desde && d > f.desde && d < f.hasta));
      if (!f.desde) b.removeAttribute('data-en-rango');
    }
  }

  return { el: panel, sync };
}
