// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { h } from '../dom.js';
import { FRANJAS } from '../data/tiempo.js';
import { crearCalendario } from './calendario.js';
import { OTRAS_SEDES, TIPOS } from '../estado/filtros.js';
import { colorDe, glifoDe } from './chip-carpa.js';
import { nombreTema } from './tarjeta.js';

const OTRAS = { id: OTRAS_SEDES, nombre: 'Otras sedes', color: 'gris' };

const alternar = (lista, valor) => (lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);

/**
 * Arma una vez los controles (calendario, chips y selects) y devuelve sus elementos
 * más sync(filtros), que solo actualiza el estado visual: así el input no pierde el foco.
 * `cambiar(parche)` recibe un objeto parcial de filtros.
 */
export function crearControles({ dias, cantidades, hoy, carpas, ciclos, temas }, cambiar) {
  const calendario = crearCalendario({ dias, cantidades, hoy }, cambiar);
  const botonesCarpa = new Map();
  // Cada grupo de chips lleva un título visible (<legend>) con la cantidad elegida, para saber qué se está filtrando.
  const grupo = (titulo, columnas, chips) => {
    const cuenta = h('span', { class: 'font-normal text-tinta-suave' });
    const el = h(
      'fieldset',
      { class: 'grid gap-2' },
      h('legend', { class: 'text-sm font-semibold mb-2' }, titulo, ' ', cuenta),
      h('div', { class: `grid gap-2 ${columnas}` }, chips),
    );
    return { el, contar: (n) => (cuenta.textContent = n ? `· ${n} ${n === 1 ? 'elegida' : 'elegidas'}` : '· todas') };
  };

  const chipsCarpa = grupo(
    'Carpas',
    'grid-cols-2 sm:grid-cols-3',
    [...carpas, OTRAS].map((s) => {
      const b = h(
        'button',
        { class: 'filtro', type: 'button', style: `--c:${colorDe(s)}`, 'aria-pressed': 'false', onClick: () => cambiar({ carpas: (f) => alternar(f.carpas, s.id) }) },
        h('span', { 'aria-hidden': 'true' }, glifoDe(s)),
        s.nombre.replace(/^Carpa /, ''),
      );
      botonesCarpa.set(s.id, b);
      return b;
    }),
  );

  const botonesFranja = new Map();
  const chipsFranja = grupo(
    'Horario',
    'grid-cols-3',
    FRANJAS.map((fr) => {
      const b = h('button', { class: 'filtro', type: 'button', 'aria-pressed': 'false', onClick: () => cambiar({ franjas: (f) => alternar(f.franjas, fr.id) }) }, fr.nombre);
      botonesFranja.set(fr.id, b);
      return b;
    }),
  );

  const select = (id, etiqueta, valores, clave, convertir = (v) => v) => {
    const el = h(
      'select',
      { id, class: 'campo', onChange: (ev) => cambiar({ [clave]: convertir(ev.target.value) }) },
      h('option', { value: '' }, 'Todos'),
      valores.map(([v, texto]) => h('option', { value: v }, texto)),
    );
    return { el, bloque: h('div', { class: 'grid gap-1' }, h('label', { for: id, class: 'text-sm font-semibold' }, etiqueta), el) };
  };
  const sCiclo = select('f-ciclo', 'Ciclo', ciclos.map((c) => [c, c]), 'ciclo');
  const sTema = select('f-tema', 'Tema', temas.map((t) => [t, nombreTema(t)]), 'tema');
  const sTipo = select('f-tipo', 'Tipo de actividad', TIPOS, 'tipo');
  // el select entrega un texto; el filtro "infancias" es un booleano
  const sPublico = select('f-publico', 'Público', [['infancias', 'Para infancias']], 'infancias', (v) => v === 'infancias');
  const resumenMas = h('summary', { class: 'cursor-pointer min-h-11 flex items-center font-semibold' }, 'Más filtros');
  const mas = h('details', { class: 'rounded-xl border border-borde p-3' }, resumenMas, h('div', { class: 'grid gap-3 pt-2 sm:grid-cols-2' }, sCiclo.bloque, sTema.bloque, sTipo.bloque, sPublico.bloque));

  function sync(f) {
    const marcar = (b, activo) => b.setAttribute('aria-pressed', String(activo));
    calendario.sync(f);
    for (const [id, b] of botonesCarpa) marcar(b, f.carpas.includes(id));
    for (const [id, b] of botonesFranja) marcar(b, f.franjas.includes(id));
    chipsCarpa.contar(f.carpas.length);
    chipsFranja.contar(f.franjas.length);
    sCiclo.el.value = f.ciclo;
    sTema.el.value = f.tema;
    sTipo.el.value = f.tipo;
    sPublico.el.value = f.infancias ? 'infancias' : '';
    const enMas = [f.ciclo, f.tema, f.tipo].filter(Boolean).length + (f.infancias ? 1 : 0);
    resumenMas.textContent = enMas ? `Más filtros (${enMas})` : 'Más filtros';
    if (enMas) mas.open = true;
  }

  return { calendario: calendario.el, chipsCarpa: chipsCarpa.el, chipsFranja: chipsFranja.el, mas, sync };
}
