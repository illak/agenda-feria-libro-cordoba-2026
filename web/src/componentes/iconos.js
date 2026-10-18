// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
// Íconos en SVG, decorativos (aria-hidden) y del color del texto (currentColor). Sin logos ni marcas de terceros.
const NS = 'http://www.w3.org/2000/svg';

function svg({ viewBox, relleno = false, tamano = 20 }, ...elementos) {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', viewBox);
  el.setAttribute('width', String(tamano));
  el.setAttribute('height', String(tamano));
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('focusable', 'false');
  if (relleno) el.setAttribute('fill', 'currentColor');
  else {
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '2');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
  }
  for (const [tag, atributos] of elementos) {
    const hijo = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(atributos)) hijo.setAttribute(k, v);
    el.append(hijo);
  }
  return el;
}

/** Calendario con un "+": agregar una actividad al calendario. */
export const iconoCalendarioMas = () =>
  svg(
    { viewBox: '0 0 24 24' },
    ['rect', { x: 3, y: 5, width: 18, height: 16, rx: 2 }],
    ['path', { d: 'M3 10h18M8 3v4M16 3v4M12 13.5v5M9.5 16h5' }],
  );

/** Flecha hacia abajo sobre una bandeja: descargar un archivo. */
export const iconoDescarga = () =>
  svg({ viewBox: '0 0 24 24' }, ['path', { d: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M4 19h16' }]);

/** Libro presentado. */
export const iconoLibro = () =>
  svg({ viewBox: '0 0 14 16', relleno: true, tamano: 16 }, ['path', { d: 'M1 1h10a2 2 0 0 1 2 2v12H3a2 2 0 0 1-2-2V1Zm2 11v1h8v-1H3Z' }]);
