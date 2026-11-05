// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { describe, expect, it } from 'vitest';
import { dominioDe, etiquetaEnlace, linkificar, urlSegura } from '../src/data/texto.js';
import { eventosReales } from './datos.js';

describe('urlSegura', () => {
  it('acepta http, https y mailto', () => {
    expect(urlSegura('https://forms.gle/abc')).toBe(true);
    expect(urlSegura('http://ejemplo.org')).toBe(true);
    expect(urlSegura('mailto:a@b.com')).toBe(true);
  });
  it('rechaza esquemas peligrosos y basura', () => {
    expect(urlSegura('javascript:alert(1)')).toBe(false);
    expect(urlSegura('data:text/html,<script>1</script>')).toBe(false);
    expect(urlSegura('ftp://x.org')).toBe(false);
    expect(urlSegura('no es una url')).toBe(false);
    expect(urlSegura('')).toBe(false);
  });
});

describe('etiquetaEnlace', () => {
  it('usa la etiqueta del doc', () => {
    expect(etiquetaEnlace({ texto: 'Inscripciones', url: 'https://forms.gle/x' })).toBe('Inscripciones');
  });
  it('si la etiqueta es la URL misma, muestra solo el dominio', () => {
    expect(etiquetaEnlace({ texto: 'https://www.alianzafrancesacba.org.ar/', url: 'https://www.alianzafrancesacba.org.ar/' })).toBe('alianzafrancesacba.org.ar');
  });
  it('un mail muestra la dirección', () => {
    expect(etiquetaEnlace({ texto: 'a@b.com', url: 'mailto:a@b.com' })).toBe('a@b.com');
    expect(etiquetaEnlace({ texto: '', url: 'mailto:a@b.com' })).toBe('a@b.com');
  });
  it('dominioDe', () => {
    expect(dominioDe('https://www.x.org/a?b=1')).toBe('x.org');
    expect(dominioDe('nada')).toBe('');
  });
});

describe('linkificar', () => {
  const urls = (t) => linkificar(t).filter((x) => x.url).map((x) => x.url);

  it('un texto sin enlaces queda como está', () => {
    expect(linkificar('Hola mundo')).toEqual([{ texto: 'Hola mundo' }]);
    expect(linkificar('')).toEqual([]);
  });
  it('detecta una URL y conserva el texto de alrededor', () => {
    expect(linkificar('Inscripción en https://forms.gle/abc para todos')).toEqual([
      { texto: 'Inscripción en ' },
      { texto: 'https://forms.gle/abc', url: 'https://forms.gle/abc' },
      { texto: ' para todos' },
    ]);
  });
  it('no incluye la puntuación final en la URL', () => {
    expect(urls('Sitio: https://alianzafrancesacba.org.ar/.')).toEqual(['https://alianzafrancesacba.org.ar/']);
    expect(urls('Ver https://x.org/a, o https://y.org/b;')).toEqual(['https://x.org/a', 'https://y.org/b']);
    expect(urls('(más en https://x.org/a)')).toEqual(['https://x.org/a']);
  });
  it('conserva un paréntesis que es parte de la URL', () => {
    expect(urls('https://es.wikipedia.org/wiki/Cordoba_(Argentina)')).toEqual(['https://es.wikipedia.org/wiki/Cordoba_(Argentina)']);
  });
  it('los mails se vuelven mailto:', () => {
    expect(linkificar('Reservas: reservas@museohistorico.unc.edu.ar')).toEqual([
      { texto: 'Reservas: ' },
      { texto: 'reservas@museohistorico.unc.edu.ar', url: 'mailto:reservas@museohistorico.unc.edu.ar' },
    ]);
    expect(urls('Escribir a librosmemoriavegetal@gmail.com.')).toEqual(['mailto:librosmemoriavegetal@gmail.com']);
  });
  it('varios enlaces en el mismo texto, en orden', () => {
    expect(urls('a https://uno.org y b@c.com y https://dos.org')).toEqual(['https://uno.org', 'mailto:b@c.com', 'https://dos.org']);
  });
  it('un @usuario de redes no es un mail ni un enlace', () => {
    expect(urls('Consultas en el instagram: @colectivodxd')).toEqual([]);
  });
  it('javascript: no se linkifica', () => {
    expect(urls('javascript:alert(1)')).toEqual([]);
  });
  it('los tramos, unidos, reconstruyen el texto original', () => {
    const t = 'Ver https://x.org/a, escribir a a@b.com. Gracias';
    expect(linkificar(t).map((x) => x.texto).join('')).toBe(t);
  });
  it('en la programación real: la web de la Alianza Francesa y los mails de las descripciones', () => {
    const todos = eventosReales.flatMap((e) => urls(e.descripcion));
    expect(todos).toContain('https://alianzafrancesacba.org.ar/');
    expect(todos.some((u) => u.startsWith('mailto:'))).toBe(true);
    for (const e of eventosReales) {
      expect(linkificar(e.descripcion).map((x) => x.texto).join('')).toBe(e.descripcion);
    }
  });
});

describe('enlaces de los datos publicados', () => {
  const con = eventosReales.filter((e) => e.enlaces?.length);
  it('las actividades con enlaces tienen etiqueta y URL segura', () => {
    expect(con.length).toBeGreaterThan(0); // cuántas hay depende de lo que traiga el doc ese día
    for (const e of con) for (const x of e.enlaces) {
      expect(urlSegura(x.url)).toBe(true);
      expect(etiquetaEnlace(x).length).toBeGreaterThan(0);
    }
  });
});
