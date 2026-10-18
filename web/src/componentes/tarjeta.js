// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { h } from '../dom.js';
import { sedeDe } from '../data/cargar.js';
import { horaLocal } from '../data/tiempo.js';
import { chipCarpa, colorDe } from './chip-carpa.js';

const ROL = { autor: 'autor/a', presenta: 'presenta', modera: 'modera', participa: '', a_cargo: 'a cargo', realizador: 'dirección' };
const INSIGNIA_TIPO = { proyeccion: 'Proyección', taller: 'Taller', espectaculo: 'Espectáculo' };

export const nombreTema = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const ICONO_LIBRO = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 14 16');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M1 1h10a2 2 0 0 1 2 2v12H3a2 2 0 0 1-2-2V1Zm2 11v1h8v-1H3Z');
  svg.append(path);
  return svg;
};

// Hasta 2 personas con su rol; el resto se resume en "+N".
export function resumenPersonas(personas) {
  if (!personas.length) return null;
  const visibles = personas.slice(0, 2).map((p) => (ROL[p.rol] ? `${p.nombre} (${ROL[p.rol]})` : p.nombre));
  const resto = personas.length - visibles.length;
  return visibles.join(', ') + (resto > 0 ? ` +${resto}` : '');
}

export function horaDeEvento(e) {
  const inicio = horaLocal(e.hora_inicio);
  if (e.hora_fin) return { inicio, fin: horaLocal(e.hora_fin), estimada: false };
  return { inicio, fin: horaLocal(e.hora_fin_estimada), estimada: Boolean(e.hora_fin_estimada) };
}

export function tarjeta(e, sedePorId, alAbrir) {
  const sede = sedeDe(e, sedePorId);
  const hora = horaDeEvento(e);
  const personas = resumenPersonas(e.personas);
  return h(
    'li',
    {},
    h(
      'article',
      { class: 'card', style: `--c:${colorDe(sede)}` },
      h(
        'button',
        { class: 'card__open', type: 'button', 'aria-haspopup': 'dialog', onClick: () => alAbrir(e) },
        h(
          'time',
          { class: 'card__hora', datetime: e.hora_inicio },
          hora.inicio,
          // la hora de fin del doc se muestra tal cual; la estimada no se muestra en la lista para no confundir
          hora.fin && !hora.estimada ? h('span', { class: 'fin' }, ` – ${hora.fin}`) : null,
        ),
        h('h3', { class: 'card__titulo' }, e.titulo),
        personas ? h('p', { class: 'card__personas' }, personas) : null,
        e.libros_presentados.length
          ? h(
              'p',
              { class: 'card__libro' },
              ICONO_LIBRO(),
              h('span', {}, e.libros_presentados.join(' · '), e.editorial ? h('small', {}, e.editorial) : null),
            )
          : null,
        h(
          'p',
          { class: 'card__meta' },
          e.publico === 'infancias' ? h('span', { class: 'tag tag--aviso' }, 'Para infancias') : null,
          INSIGNIA_TIPO[e.tipo] ? h('span', { class: 'tag tag--aviso' }, INSIGNIA_TIPO[e.tipo]) : null,
          chipCarpa(sede),
          e.ciclo ? h('span', { class: 'tag' }, e.ciclo) : null,
          e.temas.map((t) => h('span', { class: 'tag' }, nombreTema(t))),
        ),
      ),
    ),
  );
}
