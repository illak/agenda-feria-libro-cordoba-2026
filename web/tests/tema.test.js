// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { describe, expect, it } from 'vitest';
import { guardarTema, leerTema, siguienteTema, temaEfectivo } from '../src/estado/tema.js';

const memoria = () => {
  const datos = new Map();
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v) };
};
const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };

describe('tema', () => {
  it('sin elección sigue al sistema', () => {
    expect(temaEfectivo(null, true)).toBe('oscuro');
    expect(temaEfectivo(null, false)).toBe('claro');
  });
  it('la elección gana sobre el sistema', () => {
    expect(temaEfectivo('claro', true)).toBe('claro');
    expect(temaEfectivo('oscuro', false)).toBe('oscuro');
  });
  it('un valor guardado inválido se ignora', () => {
    expect(temaEfectivo('violeta', true)).toBe('oscuro');
  });
  it('alterna entre claro y oscuro', () => {
    expect(siguienteTema('claro')).toBe('oscuro');
    expect(siguienteTema('oscuro')).toBe('claro');
  });
  it('guarda y lee la elección', () => {
    const s = memoria();
    expect(leerTema(s)).toBeNull();
    expect(guardarTema('oscuro', s)).toBe(true);
    expect(leerTema(s)).toBe('oscuro');
  });
  it('si localStorage falla no rompe', () => {
    expect(leerTema(roto)).toBeNull();
    expect(guardarTema('claro', roto)).toBe(false);
  });
});
