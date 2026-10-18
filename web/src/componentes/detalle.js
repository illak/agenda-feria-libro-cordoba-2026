// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { h } from '../dom.js';
import { sedeDe } from '../data/cargar.js';
import { etiquetaDia } from '../data/tiempo.js';
import { chipCarpa, colorDe } from './chip-carpa.js';
import { horaDeEvento } from './tarjeta.js';
import { nombreTema } from '../data/texto.js';
import { simultaneasCon } from '../estado/superposicion.js';
import { textoFin } from './tarjeta-compacta.js';
import { horaLocal } from '../data/tiempo.js';
import { ROL_LARGO } from '../data/roles.js';
import { enlaceGoogle } from '../estado/enlaces-calendario.js';
import { generarICS } from '../estado/ics.js';
import { descargarTexto } from './descarga.js';
import { iconoCalendarioMas, iconoDescarga } from './iconos.js';
import { finExportadoLocal, intervaloUTC } from '../estado/datos-calendario.js';

function filaHorario(e) {
  const { inicio, fin, estimada } = horaDeEvento(e);
  const dia = etiquetaDia(e.fecha).largo;
  if (!fin) return `${dia} · ${inicio}`;
  if (!estimada) return `${dia} · ${inicio} a ${fin}`;
  // la hora de fin no está en el doc: se marca como aproximada
  return [`${dia} · ${inicio} a `, h('span', { title: 'Hora de fin estimada: el programa no la informa' }, `${fin} (aprox.)`)];
}

const mapa = (sede) =>
  sede.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${sede.direccion}, Córdoba, Argentina`)}`
    : null;

/** Un único <dialog> reutilizable; devuelve abrir(evento). `eventos` es todo el programa, para listar lo que pasa al mismo tiempo. */
export function crearDetalle(sedePorId, eventos, orden, { meta = {} } = {}) {
  const dialogo = h('dialog', { class: 'detalle', 'aria-labelledby': 'detalle-titulo' });
  document.body.append(dialogo);
  // clic en el fondo (backdrop) cierra
  dialogo.addEventListener('click', (ev) => {
    if (ev.target === dialogo) dialogo.close();
  });

  // dirección de la página sin consulta ni hash: sirve de base para los enlaces a cada actividad
  const urlApp = () => new URL('.', location.href).href;

  function bloqueCalendario(e) {
    const contexto = () => ({ sedePorId, urlApp: urlApp(), estampa: meta.actualizado ?? meta.generado ?? new Date().toISOString() });
    const estado = h('p', { class: 'text-sm font-semibold', 'aria-live': 'polite' });
    const aproximado = intervaloUTC(e).aproximado;
    return h(
      'section',
      { class: 'calendario-accion', 'aria-labelledby': 'cal-titulo' },
      h('h3', { id: 'cal-titulo', class: 'calendario-accion__titulo' }, iconoCalendarioMas(), 'Agregar al calendario'),
      h(
        'div',
        { class: 'calendario-accion__botones' },
        h(
          'a',
          { class: 'boton-calendario boton-calendario--relleno', href: enlaceGoogle(e, contexto()), target: '_blank', rel: 'noopener', 'aria-label': 'Google Calendar (se abre en una pestaña nueva)' },
          iconoCalendarioMas(),
          'Google Calendar',
        ),
        h(
          'button',
          {
            class: 'boton-calendario',
            type: 'button',
            onClick: () => {
              descargarTexto(generarICS([e], contexto()), `${e.id}.ics`, 'text/calendar;charset=utf-8');
              estado.textContent = 'Archivo .ics descargado.';
              setTimeout(() => (estado.textContent = ''), 4000);
            },
          },
          iconoDescarga(),
          'Archivo .ics',
        ),
      ),
      h('p', { class: 'text-sm text-tinta-suave' }, 'El archivo .ics sirve para Apple Calendar, Outlook y otros calendarios.'),
      aproximado ? h('p', { class: 'text-sm text-tinta-suave' }, `La hora de fin es aproximada: se agrega como ${finExportadoLocal(e)}.`) : null,
      estado,
    );
  }

  function alMismoTiempo(e) {
    const otras = simultaneasCon(e, eventos, orden);
    if (!otras.length) return null;
    const aproximado = otras.some((o) => !o.hora_fin) || !e.hora_fin;
    return h(
      'details',
      { class: 'rounded-xl border border-borde p-3', open: otras.length <= 5 },
      h('summary', { class: 'cursor-pointer min-h-11 flex items-center font-semibold' }, `Al mismo tiempo (${otras.length})`),
      h(
        'ul',
        { class: 'grid gap-2 pt-1' },
        otras.map((o) => {
          const otraSede = sedeDe(o, sedePorId);
          return h(
            'li',
            {},
            h(
              'button',
              { class: 'w-full text-left grid gap-1 rounded-lg border border-borde p-2 min-h-11 cursor-pointer', type: 'button', style: `border-left: 4px solid ${colorDe(otraSede)}`, onClick: () => abrir(o) },
              h('span', { class: 'text-sm text-tinta-suave' }, `${horaLocal(o.hora_inicio)} · ${textoFin(o) || 'sin hora de fin'}`),
              h('span', { class: 'font-serif font-semibold leading-snug' }, o.titulo),
              h('span', {}, chipCarpa(otraSede)),
            ),
          );
        }),
      ),
      aproximado ? h('p', { class: 'text-sm text-tinta-suave pt-2' }, 'Cuando el programa no informa la hora de fin se estima una hora, así que la superposición es aproximada.') : null,
    );
  }

  function abrir(e) {
    const sede = sedeDe(e, sedePorId);
    const url = mapa(sede);
    dialogo.style.setProperty('--c', colorDe(sede));
    dialogo.replaceChildren(
      h(
        'div',
        { class: 'p-4 sm:p-6 grid gap-3' },
        h('p', { class: 'text-sm text-tinta-suave' }, filaHorario(e)),
        // el foco inicial va al título (no al primer botón): lee la actividad primero y no dibuja un aro sobre una acción
        h('h2', { id: 'detalle-titulo', class: 'font-serif text-2xl font-semibold leading-tight', tabindex: '-1', autofocus: true }, e.titulo),
        h(
          'p',
          { class: 'flex flex-wrap gap-2 items-center' },
          e.publico === 'infancias' ? h('span', { class: 'tag tag--aviso' }, 'Para infancias') : null,
          chipCarpa(sede),
          e.ciclo ? h('span', { class: 'tag' }, e.ciclo) : null,
          e.temas.map((t) => h('span', { class: 'tag' }, nombreTema(t))),
        ),
        sede.direccion
          ? h('p', { class: 'text-sm' }, sede.direccion, ' · ', url ? h('a', { href: url, target: '_blank', rel: 'noopener', class: 'underline' }, 'Ver en el mapa') : null)
          : null,
        bloqueCalendario(e),
        e.libros_presentados.length
          ? h(
              'section',
              {},
              h('h3', { class: 'font-semibold' }, e.libros_presentados.length > 1 ? 'Libros presentados' : 'Libro presentado'),
              h('ul', { class: 'list-disc pl-5' }, e.libros_presentados.map((l) => h('li', {}, l))),
              e.editorial ? h('p', { class: 'text-sm text-tinta-suave' }, e.editorial) : null,
            )
          : e.editorial
            ? h('p', { class: 'text-sm text-tinta-suave' }, e.editorial)
            : null,
        e.personas.length
          ? h(
              'section',
              {},
              h('h3', { class: 'font-semibold' }, 'Personas'),
              h('ul', {}, e.personas.map((p) => h('li', {}, p.nombre, ' ', h('span', { class: 'text-sm text-tinta-suave' }, `· ${ROL_LARGO[p.rol] ?? p.rol}`)))),
            )
          : null,
        e.descripcion ? h('p', { class: 'whitespace-pre-line' }, e.descripcion) : null,
        alMismoTiempo(e),
        h('div', { class: 'flex justify-end pt-2' }, h('button', { class: 'boton', type: 'button', onClick: () => dialogo.close() }, 'Cerrar')),
      ),
    );
    dialogo.scrollTop = 0;
    if (!dialogo.open) dialogo.showModal();
  }
  return abrir;
}
