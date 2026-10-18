// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { describe, expect, it } from 'vitest';
import { enlaceGoogle } from '../src/estado/enlaces-calendario.js';
import { eventoDeURL, idEventoDeURL } from '../src/estado/enlace.js';
import { evento, eventos, eventosReales, sedePorId } from './datos.js';

const ctx = { sedePorId, urlApp: 'https://ejemplo.test/agenda/' };
const e = evento({ id: 'abc', titulo: 'Poesía & más', hora_inicio: '2026-10-30T19:00:00-03:00', hora_fin: '2026-10-30T21:00:00-03:00', sede_id: 'biblio' });

describe('enlace de Google Calendar', () => {
  const url = new URL(enlaceGoogle(e, ctx));
  it('apunta al formulario de Google con la actividad cargada', () => {
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Poesía & más');
    expect(url.searchParams.get('dates')).toBe('20261030T220000Z/20261031T000000Z');
    expect(url.searchParams.get('ctz')).toBe('America/Argentina/Cordoba');
    expect(url.searchParams.get('location')).toBe('Biblioteca Córdoba, 27 de Abril 375');
  });
  it('el detalle lleva el enlace a la actividad', () => {
    expect(url.searchParams.get('details')).toContain('https://ejemplo.test/agenda/?evento=abc');
  });
  it('los caracteres especiales no rompen la URL', () => {
    expect(enlaceGoogle(e, ctx)).not.toMatch(/ |&más/);
  });
  it('recorta los textos largos del programa para que el enlace no se dispare', () => {
    const largo = enlaceGoogle({ ...e, descripcion: 'x'.repeat(5000) }, ctx);
    expect(largo.length).toBeLessThan(3000);
  });
  it('funciona con todas las actividades reales', () => {
    for (const ev of eventosReales) expect(() => new URL(enlaceGoogle(ev, { sedePorId: new Map(), urlApp: 'https://x.test/' }))).not.toThrow();
  });
});

describe('enlace a una actividad', () => {
  it('lee el id', () => {
    expect(idEventoDeURL('?evento=abc&dia=2026-10-30')).toBe('abc');
    expect(idEventoDeURL('')).toBe('');
  });
  it('encuentra la actividad, o undefined si ya no existe', () => {
    expect(eventoDeURL('?evento=b', eventos)?.id).toBe('b');
    expect(eventoDeURL('?evento=inexistente', eventos)).toBeUndefined();
    expect(eventoDeURL('', eventos)).toBeUndefined();
  });
});
