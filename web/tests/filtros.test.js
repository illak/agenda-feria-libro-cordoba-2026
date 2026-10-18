// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { describe, expect, it } from 'vitest';
import { OTRAS_SEDES, aplicar, cantidadActivos, filtrosVacios, limpiar, opcionesDe, paresDeOpciones } from '../src/estado/filtros.js';
import { franjaDe } from '../src/data/tiempo.js';
import { eventos, eventosReales, sedePorId, sedes, sedesReales } from './datos.js';

const ids = (lista) => lista.map((e) => e.id);
const con = (cambios) => ({ ...filtrosVacios(), ...cambios });
const filtrar = (cambios, extra = {}) => ids(aplicar(eventos, con(cambios), { sedePorId, ...extra }));

describe('franjas', () => {
  it('mañana hasta las 12:59, tarde de 13 a 19:59, noche desde las 20', () => {
    expect(franjaDe('2026-10-30T00:00:00-03:00')).toBe('manana');
    expect(franjaDe('2026-10-30T12:59:00-03:00')).toBe('manana');
    expect(franjaDe('2026-10-30T13:00:00-03:00')).toBe('tarde');
    expect(franjaDe('2026-10-30T19:59:00-03:00')).toBe('tarde');
    expect(franjaDe('2026-10-30T20:00:00-03:00')).toBe('noche');
  });
});

describe('aplicar filtros', () => {
  it('sin filtros devuelve todo', () => {
    expect(filtrar({})).toEqual(['a', 'b', 'c', 'd']);
  });
  it('por día', () => {
    expect(filtrar({ desde: '2026-10-31', hasta: '2026-10-31' })).toEqual(['c', 'd']);
  });
  it('por rango de días, con los extremos incluidos', () => {
    expect(filtrar({ desde: '2026-10-30', hasta: '2026-10-31' })).toEqual(['a', 'b', 'c', 'd']);
    expect(filtrar({ desde: '2026-10-31', hasta: '2026-11-05' })).toEqual(['c', 'd']);
    expect(filtrar({ desde: '2026-11-01', hasta: '2026-11-05' })).toEqual([]);
  });
  it('conDia:false ignora los días', () => {
    expect(filtrar({ desde: '2026-10-31', hasta: '2026-10-31', tipo: 'taller' }, { conDia: false })).toEqual(['b']);
  });
  it('por carpa: varias carpas suman (OR)', () => {
    expect(filtrar({ carpas: ['roja', 'azul'] })).toEqual(['a', 'b']);
  });
  it('"otras sedes" incluye externas y eventos sin sede', () => {
    expect(filtrar({ carpas: [OTRAS_SEDES] })).toEqual(['c', 'd']);
  });
  it('por franja, también con varias', () => {
    expect(filtrar({ franjas: ['manana'] })).toEqual(['a']);
    expect(filtrar({ franjas: ['tarde', 'noche'] })).toEqual(['b', 'c', 'd']);
  });
  it('por ciclo, tema y tipo', () => {
    expect(filtrar({ ciclo: 'INFANCIAS' })).toEqual(['b']);
    expect(filtrar({ tema: 'narrativa' })).toEqual(['d']);
    expect(filtrar({ tipo: 'presentacion' })).toEqual(['c']);
  });
  it('para infancias', () => {
    expect(filtrar({ infancias: true })).toEqual(['b']);
  });
  it('los filtros de grupos distintos se combinan (AND)', () => {
    expect(filtrar({ desde: '2026-10-30', hasta: '2026-10-30', carpas: ['azul'], franjas: ['tarde'], infancias: true })).toEqual(['b']);
    expect(filtrar({ desde: '2026-10-30', hasta: '2026-10-30', carpas: ['azul'], franjas: ['manana'] })).toEqual([]);
  });
  it('idsBusqueda restringe el resultado', () => {
    expect(filtrar({}, { idsBusqueda: new Set(['c', 'zzz']) })).toEqual(['c']);
    expect(filtrar({}, { idsBusqueda: new Set() })).toEqual([]);
  });
});

describe('estado de filtros', () => {
  it('cantidadActivos no cuenta los días', () => {
    expect(cantidadActivos(con({ desde: '2026-10-30', hasta: '2026-11-02' }))).toBe(0);
    expect(cantidadActivos(con({ q: 'x', carpas: ['roja', 'azul'], infancias: true, tema: 'historia' }))).toBe(5);
  });
  it('limpiar conserva la vista', () => {
    expect(limpiar(con({ vista: 'simultaneas', q: 'x' })).vista).toBe('simultaneas');
  });
  it('limpiar conserva el rango de días', () => {
    expect(limpiar(con({ desde: '2026-10-31', hasta: '2026-11-02', q: 'x', tipo: 'taller' }))).toEqual(filtrosVacios('2026-10-31', '2026-11-02'));
  });
  it('opcionesDe lista días de la feria, carpas, ciclos y temas', () => {
    const o = opcionesDe(eventos, sedes);
    expect(o.diasFeria).toHaveLength(17);
    expect(o.diasFeria).toContain('2026-11-10'); // sin actividades, pero se puede elegir
    expect(o.carpas).toEqual(['roja', 'azul', OTRAS_SEDES]);
    expect(o.ciclos).toEqual(['INFANCIAS']);
    expect(o.temas).toEqual(['historia', 'narrativa', 'poesía']);
  });
});

describe('selectores de ciclo y tema con la programación real', () => {
  const opciones = opcionesDe(eventosReales, sedesReales);
  const mapaSedes = new Map(sedesReales.map((s) => [s.id, s]));
  const { ciclos, temas } = paresDeOpciones(opciones);

  it('los pares son [texto, texto] y no se anidan', () => {
    for (const par of [...ciclos, ...temas]) {
      expect(par).toHaveLength(2);
      expect(typeof par[0]).toBe('string');
      expect(typeof par[1]).toBe('string');
    }
  });
  it('los valores son los ciclos y temas tal como vienen en los datos', () => {
    expect(ciclos.map(([v]) => v)).toEqual(opciones.ciclos);
    expect(temas.map(([v]) => v)).toEqual(opciones.temas);
    expect(ciclos.length).toBeGreaterThan(10);
  });
  it('cada ciclo filtra exactamente sus actividades, y nunca ninguna', () => {
    for (const [valor] of ciclos) {
      const esperados = eventosReales.filter((e) => e.ciclo === valor);
      const r = aplicar(eventosReales, { ...filtrosVacios(), ciclo: valor }, { sedePorId: mapaSedes });
      expect(r.length).toBeGreaterThan(0);
      expect(r.map((e) => e.id)).toEqual(esperados.map((e) => e.id));
    }
  });
  it('cada tema filtra exactamente sus actividades, y nunca ninguna', () => {
    for (const [valor] of temas) {
      const esperados = eventosReales.filter((e) => e.temas.includes(valor));
      const r = aplicar(eventosReales, { ...filtrosVacios(), tema: valor }, { sedePorId: mapaSedes });
      expect(r.length).toBeGreaterThan(0);
      expect(r).toHaveLength(esperados.length);
    }
  });
  it('INFANCIAS reúne sus 38 actividades en todos los días', () => {
    expect(aplicar(eventosReales, { ...filtrosVacios(), ciclo: 'INFANCIAS' }, { sedePorId: mapaSedes })).toHaveLength(38);
  });
  it('las etiquetas de tema llevan mayúscula inicial', () => {
    expect(temas.find(([v]) => v === 'poesía')[1]).toBe('Poesía');
  });
});
