// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { h } from '../dom.js';
import { etiquetaEnlace, urlSegura } from '../data/texto.js';
import { iconoEnlace, iconoSobre } from './iconos.js';

/** Los enlaces del evento que se pueden abrir sin riesgo. */
export const enlacesDe = (e) => (e.enlaces ?? []).filter((x) => x && urlSegura(x.url));

/** <a> con ícono y texto: un sobre para los mails, el cuadro con flecha para los sitios. */
export function enlaceEvento(enlace, { clase = 'enlace-chip' } = {}) {
  const mail = enlace.url.startsWith('mailto:');
  const etiqueta = etiquetaEnlace(enlace);
  return h(
    'a',
    {
      class: clase,
      href: enlace.url,
      // los mails abren la app de correo; el resto, una pestaña nueva (se está en el predio, con la agenda abierta)
      ...(mail ? {} : { target: '_blank', rel: 'noopener noreferrer' }),
      'aria-label': mail ? `Escribir a ${etiqueta}` : `${etiqueta} (se abre en una pestaña nueva)`,
    },
    mail ? iconoSobre() : iconoEnlace(),
    h('span', {}, etiqueta),
  );
}

/**
 * Fila de enlaces para la tarjeta. Va FUERA del botón que abre el detalle: un enlace dentro de un botón es HTML inválido
 * y no se podría tocar. Devuelve null si no hay enlaces; con más de `max` muestra el resto en el detalle.
 */
export function enlacesDeTarjeta(e, { max = 2 } = {}) {
  const todos = enlacesDe(e);
  if (!todos.length) return null;
  const visibles = todos.slice(0, max);
  const resto = todos.length - visibles.length;
  return h(
    'p',
    { class: 'card__enlaces' },
    visibles.map((x) => enlaceEvento(x)),
    resto > 0 ? h('span', { class: 'text-sm text-tinta-suave' }, `+${resto} en el detalle`) : null,
  );
}

/** Sección del detalle: todos los enlaces, uno por línea. */
export function seccionEnlaces(e) {
  const todos = enlacesDe(e);
  if (!todos.length) return null;
  return h(
    'section',
    { 'aria-labelledby': 'enlaces-titulo' },
    h('h3', { id: 'enlaces-titulo', class: 'font-semibold mb-2' }, todos.length > 1 ? 'Enlaces' : 'Enlace'),
    h('div', { class: 'grid gap-2' }, todos.map((x) => enlaceEvento(x, { clase: 'enlace-chip enlace-chip--grande' }))),
  );
}

/** Texto con las URL y los mails vueltos enlaces (para la descripción). */
export function textoConEnlaces(tramos) {
  return tramos.map((t) =>
    t.url && urlSegura(t.url)
      ? h('a', { class: 'underline', href: t.url, ...(t.url.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noopener noreferrer' }) }, t.texto)
      : t.texto,
  );
}
