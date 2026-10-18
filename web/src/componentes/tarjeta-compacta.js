// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { h } from '../dom.js';
import { sedeDe } from '../data/cargar.js';
import { horaLocal } from '../data/tiempo.js';
import { finDe, finEsEstimado } from '../estado/superposicion.js';
import { chipCarpa, colorDe } from './chip-carpa.js';
import { resumenPersonas } from './tarjeta.js';

const INSIGNIA_TIPO = { proyeccion: 'Proyección', taller: 'Taller', espectaculo: 'Espectáculo' };

/** "hasta 18:00", o "hasta ~18:00 (aprox.)" si el doc no trae la hora de fin. */
export function textoFin(e) {
  const fin = horaLocal(finDe(e));
  if (!fin || fin === horaLocal(e.hora_inicio)) return '';
  return finEsEstimado(e) ? `hasta ~${fin} (aprox.)` : `hasta ${fin}`;
}

/**
 * Tarjeta para comparar actividades que pasan a la vez: la carpa va primero.
 * @param conInicio true para las que "siguen en curso": agrega desde cuándo empezaron.
 */
export function tarjetaCompacta(e, sedePorId, alAbrir, { conInicio = false } = {}) {
  const sede = sedeDe(e, sedePorId);
  const personas = resumenPersonas(e.personas);
  const horario = [conInicio ? `desde ${horaLocal(e.hora_inicio)}` : '', textoFin(e)].filter(Boolean).join(' · ');
  return h(
    'li',
    {},
    h(
      'article',
      { class: 'card card--compacta', style: `--c:${colorDe(sede)}` },
      h(
        'button',
        { class: 'card__open', type: 'button', 'aria-haspopup': 'dialog', onClick: () => alAbrir(e) },
        h('p', { class: 'card__meta' }, chipCarpa(sede)),
        h('h4', { class: 'card__titulo' }, e.titulo),
        personas ? h('p', { class: 'card__personas card__una-linea' }, personas) : null,
        h(
          'p',
          { class: 'card__meta' },
          e.publico === 'infancias' ? h('span', { class: 'tag tag--aviso' }, 'Para infancias') : null,
          INSIGNIA_TIPO[e.tipo] ? h('span', { class: 'tag tag--aviso' }, INSIGNIA_TIPO[e.tipo]) : null,
          horario ? h('span', { class: 'text-sm text-tinta-suave' }, horario) : null,
        ),
      ),
    ),
  );
}
