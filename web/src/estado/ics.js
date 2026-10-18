// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
// Generación de archivos .ics (RFC 5545). Las horas van en UTC con "Z", así no hace falta un VTIMEZONE.
import { sedeDe } from '../data/cargar.js';
import { aUTC, descripcionDe, enlaceEvento, intervaloUTC, tituloCorto, ubicacion } from './datos-calendario.js';

const CRLF = '\r\n';
const MAX_OCTETOS = 75;
const codificador = new TextEncoder();

/** Escapa texto según RFC 5545: barra, punto y coma, coma y saltos de línea. */
export const escaparTexto = (t) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Parte una línea en tramos de hasta 75 octetos (UTF-8) sin cortar un carácter; los tramos siguientes empiezan con un espacio. */
export function plegar(linea) {
  const tramos = [];
  let actual = '';
  let octetos = 0;
  for (const c of linea) {
    const n = codificador.encode(c).length;
    const tope = tramos.length === 0 ? MAX_OCTETOS : MAX_OCTETOS - 1; // el espacio inicial cuenta
    if (octetos + n > tope) {
      tramos.push(actual);
      actual = '';
      octetos = 0;
    }
    actual += c;
    octetos += n;
  }
  tramos.push(actual);
  return tramos.map((t, i) => (i === 0 ? t : ` ${t}`)).join(CRLF);
}

function vevento(e, { sedePorId, urlApp, estampa, dominio }) {
  const sede = sedeDe(e, sedePorId);
  const { inicio, fin } = intervaloUTC(e);
  const lineas = [
    'BEGIN:VEVENT',
    `UID:${e.id}@${dominio}`, // estable: al volver a importar se actualiza en lugar de duplicar
    `DTSTAMP:${estampa}`,
    `DTSTART:${inicio}`,
    `DTEND:${fin}`,
    `SUMMARY:${escaparTexto(tituloCorto(e))}`,
    `LOCATION:${escaparTexto(ubicacion(sede))}`,
    `DESCRIPTION:${escaparTexto(descripcionDe(e, { urlApp }))}`,
    `URL:${enlaceEvento(urlApp, e.id)}`,
    'END:VEVENT',
  ];
  return lineas.map(plegar);
}

/**
 * @param contexto.sedePorId Map de sedes
 * @param contexto.urlApp dirección de la página, para el enlace de cada actividad
 * @param contexto.estampa fecha ISO de la actualización de los datos (meta.actualizado), para que el archivo sea reproducible
 */
export function generarICS(eventos, { sedePorId, urlApp, estampa, dominio = 'agenda-feria-libro-cordoba-2026' }) {
  const cuerpo = eventos.flatMap((e) => vevento(e, { sedePorId, urlApp, estampa: aUTC(estampa), dominio }));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agenda Feria del Libro Cordoba 2026//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...cuerpo, 'END:VCALENDAR'].join(CRLF) + CRLF;
}
