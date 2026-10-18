// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { sedeDe } from '../data/cargar.js';
import { descripcionDe, intervaloUTC, tituloCorto, ubicacion } from './datos-calendario.js';

const MAX_PROGRAMA_EN_ENLACE = 600; // el enlace viaja en la URL: se recorta el texto largo del programa

/** Enlace "agregar a Google Calendar": abre el formulario con la actividad cargada (una por vez, sin login ni backend). */
export function enlaceGoogle(e, { sedePorId, urlApp }) {
  const { inicio, fin } = intervaloUTC(e);
  const parametros = {
    action: 'TEMPLATE',
    text: tituloCorto(e),
    dates: `${inicio}/${fin}`,
    ctz: 'America/Argentina/Cordoba',
    details: descripcionDe(e, { urlApp, maxPrograma: MAX_PROGRAMA_EN_ENLACE }),
    location: ubicacion(sedeDe(e, sedePorId)),
  };
  const query = Object.entries(parametros)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `https://calendar.google.com/calendar/render?${query}`;
}
