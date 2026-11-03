// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
export const nombreTema = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// --- enlaces -------------------------------------------------------------------------------------

const ESQUEMAS_SEGUROS = ['http:', 'https:', 'mailto:'];

/** Solo http, https y mailto: nada de javascript: ni data: aunque vengan en los datos. */
export function urlSegura(url) {
  try {
    return ESQUEMAS_SEGUROS.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** Dominio sin "www.", para mostrar de dónde es un enlace. */
export function dominioDe(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Lo que se lee en el chip: la etiqueta del doc; si es la URL misma, solo el dominio. */
export function etiquetaEnlace({ texto, url }) {
  if (url.startsWith('mailto:')) return texto || url.slice(7);
  const t = (texto || '').trim();
  return !t || t === url || /^https?:\/\//i.test(t) ? dominioDe(url) || url : t;
}

const RE_ENLACE = /(https?:\/\/[^\s<>"]+)|([\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+)/gu;
const PUNTUACION_FINAL = /[.,;:!?)\]»”"']+$/;

/**
 * Parte un texto en tramos { texto } y { texto, url }: las URL http(s) y los mails se vuelven enlaces.
 * Los signos de puntuación al final ("...ar/.") no forman parte del enlace.
 */
export function linkificar(texto) {
  const tramos = [];
  let desde = 0;
  for (const m of texto.matchAll(RE_ENLACE)) {
    let literal = m[0];
    const sobra = literal.match(PUNTUACION_FINAL)?.[0] ?? '';
    // un ")" final solo es parte de la URL si hay un "(" que lo abre
    const cierraConAbre = sobra.startsWith(')') && literal.includes('(');
    const recorte = cierraConAbre ? '' : sobra;
    literal = recorte ? literal.slice(0, -recorte.length) : literal;
    if (m.index > desde) tramos.push({ texto: texto.slice(desde, m.index) });
    tramos.push({ texto: literal, url: m[1] ? literal : `mailto:${literal}` });
    desde = m.index + literal.length;
  }
  if (desde < texto.length) tramos.push({ texto: texto.slice(desde) });
  return tramos;
}
