import { h } from '../dom.js';
import { etiquetaDia, horaLocal } from '../data/tiempo.js';
import { chipCarpa } from './chip-carpa.js';

/**
 * Campo de búsqueda con sugerencias a medida que se escribe (patrón combobox + listbox).
 * @param sugerir (q) => { total, items: [{ evento, sede }] }; items vacío y total 0 = sin coincidencias
 * @param alEscribir (q) => void   actualiza el filtro de la lista
 * @param alElegir (evento) => void   se tocó una sugerencia
 */
export function crearCampoBusqueda({ sugerir, alEscribir, alElegir }) {
  let items = [];
  let activo = -1;

  const input = h('input', {
    id: 'busqueda',
    type: 'search',
    class: 'campo',
    placeholder: 'Buscar título, autor/a, libro o editorial',
    autocomplete: 'off',
    role: 'combobox',
    'aria-label': 'Buscar actividades',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': 'sugerencias',
  });
  const lista = h('ul', { id: 'sugerencias', role: 'listbox', 'aria-label': 'Coincidencias', class: 'sugerencias' });
  const estado = h('p', { class: 'sugerencias__estado', 'aria-live': 'polite' });
  const panel = h('div', { class: 'sugerencias-panel', hidden: true }, estado, lista);
  const raiz = h('div', { class: 'relative' }, input, panel);

  const abierto = () => !panel.hidden;
  function cerrar() {
    panel.hidden = true;
    activo = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  function marcar(i) {
    activo = i;
    [...lista.children].forEach((li, n) => li.setAttribute('aria-selected', String(n === i)));
    if (i >= 0) {
      input.setAttribute('aria-activedescendant', lista.children[i].id);
      lista.children[i].scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }
  function elegir(i) {
    const s = items[i];
    if (!s) return;
    cerrar();
    alElegir(s.evento);
  }

  function mostrar() {
    const r = sugerir(input.value);
    items = r.items;
    lista.replaceChildren(
      ...items.map(({ evento, sede }, i) => {
        const dia = etiquetaDia(evento.fecha);
        return h(
          'li',
          {
            id: `sug-${i}`,
            role: 'option',
            'aria-selected': 'false',
            class: 'sugerencia',
            // pointerdown (no click) y sin perder el foco del input
            onPointerdown: (ev) => { ev.preventDefault(); elegir(i); },
          },
          h('span', { class: 'sugerencia__titulo' }, evento.titulo),
          h('span', { class: 'sugerencia__meta' }, `${dia.semanaCorta} ${dia.numero} · ${horaLocal(evento.hora_inicio)} · `, chipCarpa(sede)),
        );
      }),
    );
    const hay = items.length > 0;
    estado.textContent = !input.value.trim() || input.value.trim().length < 2 ? '' : hay ? (r.total > items.length ? `${r.total} coincidencias, las ${items.length} más relevantes` : `${r.total} ${r.total === 1 ? 'coincidencia' : 'coincidencias'}`) : 'Sin coincidencias';
    const visible = input.value.trim().length >= 2;
    panel.hidden = !visible;
    input.setAttribute('aria-expanded', String(visible && hay));
    activo = -1;
  }

  input.addEventListener('input', () => {
    alEscribir(input.value);
    mostrar();
  });
  input.addEventListener('focus', () => input.value.trim().length >= 2 && mostrar());
  input.addEventListener('blur', cerrar);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown' && items.length) {
      ev.preventDefault();
      if (!abierto()) mostrar();
      marcar((activo + 1) % items.length);
    } else if (ev.key === 'ArrowUp' && items.length) {
      ev.preventDefault();
      marcar(activo <= 0 ? items.length - 1 : activo - 1);
    } else if (ev.key === 'Enter') {
      if (abierto() && activo >= 0) {
        ev.preventDefault();
        elegir(activo);
      } else cerrar(); // sin sugerencia elegida: queda el filtro de la lista
    } else if (ev.key === 'Escape' && abierto()) {
      ev.preventDefault();
      cerrar();
    }
  });

  return {
    el: raiz,
    sync(q) {
      if (document.activeElement !== input) input.value = q;
    },
  };
}
