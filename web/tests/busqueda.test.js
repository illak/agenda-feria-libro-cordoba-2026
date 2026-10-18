// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { describe, expect, it } from 'vitest';
import { crearBuscador, normalizar } from '../src/estado/busqueda.js';
import { eventos, eventosReales } from './datos.js';

const { ids: buscar, ranking } = crearBuscador(eventos);

describe('normalizar', () => {
  it('quita acentos, pasa a minúsculas y recorta', () => {
    expect(normalizar('  PoesÍa Ñandú  ')).toBe('poesia nandu');
  });
});

describe('búsqueda', () => {
  it('sin consulta (o de una letra) no filtra', () => {
    expect(buscar('')).toBeNull();
    expect(buscar('   ')).toBeNull();
    expect(buscar('p')).toBeNull();
  });
  it('ignora acentos y mayúsculas, en ambos sentidos', () => {
    expect([...buscar('POESIA')]).toContain('a');
    expect([...buscar('poesía')]).toContain('a');
    expect([...buscar('jose perez')]).toContain('a'); // persona con tildes en el dato
    expect([...buscar('José Pérez')]).toContain('a');
  });
  it('busca en título, descripción, personas, libros y editorial', () => {
    expect([...buscar('collage')]).toEqual(['b']); // título
    expect([...buscar('perro heroe')]).toEqual(['c']); // descripción
    expect([...buscar('perez')]).toEqual(['a']); // persona
    expect([...buscar('mortero 2')]).toContain('c'); // libro
    expect([...buscar('yammal')]).toEqual(['c']); // editorial
  });
  it('tolera errores de tipeo', () => {
    expect([...buscar('colage')]).toEqual(['b']);
  });
  it('una consulta sin coincidencias devuelve un conjunto vacío, no null', () => {
    expect(buscar('zzzzzz')).toEqual(new Set());
  });
});

describe('ranking', () => {
  it('sin consulta no devuelve nada', () => {
    expect(ranking('')).toEqual([]);
    expect(ranking('a')).toEqual([]);
  });
  it('devuelve eventos completos, con la coincidencia de título primero', () => {
    const r = ranking('mortero');
    expect(r[0]).toBe(eventos.find((e) => e.id === 'c'));
  });
  it('el título pesa más que la descripción', () => {
    const lista = [
      { ...eventos[0], id: 'desc', titulo: 'Otra cosa', descripcion: 'habla de ballenas azules' },
      { ...eventos[0], id: 'tit', titulo: 'Ballenas', descripcion: 'otra cosa' },
    ];
    expect(crearBuscador(lista).ranking('ballenas').map((e) => e.id)[0]).toBe('tit');
  });
});

describe('búsqueda sobre la programación real', () => {
  const { ids: real, ranking: rankingReal } = crearBuscador(eventosReales);
  const idDe = (fragmento) => eventosReales.find((e) => e.id.includes(fragmento)).id;

  it('encuentra la presentación de Mortero con y sin acentos', () => {
    const id = idDe('presentacion-libro-mortero-2');
    expect(real('mortero').has(id)).toBe(true);
    expect(real('Gonzáles').has(id)).toBe(true);
    expect(real('gonzales').has(id)).toBe(true);
    expect(real('yammal').has(id)).toBe(true);
  });
  it('"Reino del Revés" se encuentra escribiendo reves', () => {
    expect(real('reino del reves').has(idDe('taller-collage-reino-reves-zoe'))).toBe(true);
  });
  it('el ranking real pone la presentación de Mortero primera', () => {
    expect(rankingReal('mortero')[0].id).toContain('presentacion-libro-mortero-2');
  });
  it('no trae decenas de resultados dudosos para una palabra poco frecuente', () => {
    expect(real('mortero').size).toBeLessThanOrEqual(3);
  });
});
