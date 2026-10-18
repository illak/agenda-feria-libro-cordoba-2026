import { describe, expect, it } from 'vitest';
import { OTRAS_SEDES, aplicar, cantidadActivos, filtrosVacios, limpiar, opcionesDe } from '../src/estado/filtros.js';
import { franjaDe } from '../src/data/tiempo.js';
import { eventos, sedePorId, sedes } from './datos.js';

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
