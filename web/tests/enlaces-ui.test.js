// @vitest-environment happy-dom
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { beforeEach, describe, expect, it } from 'vitest';
import { enlacesDe, enlacesDeTarjeta, seccionEnlaces, textoConEnlaces } from '../src/componentes/enlaces.js';
import { tarjeta } from '../src/componentes/tarjeta.js';
import { tarjetaCompacta } from '../src/componentes/tarjeta-compacta.js';
import { linkificar } from '../src/data/texto.js';
import { evento, sedePorId } from './datos.js';

const form = { texto: 'Actividad con inscripción previa', url: 'https://forms.gle/abc' };
const mail = { texto: 'a@b.com', url: 'mailto:a@b.com' };
const conEnlaces = (...enlaces) => evento({ id: 'e1', titulo: 'Taller', enlaces });
const montar = (nodo) => {
  document.body.replaceChildren(nodo);
  return nodo;
};

beforeEach(() => document.body.replaceChildren());

describe('enlaces en la tarjeta de la lista', () => {
  it('muestra el enlace con su texto', () => {
    montar(tarjeta(conEnlaces(form), sedePorId, () => {}));
    const a = document.querySelector('.card__enlaces a');
    expect(a).not.toBeNull();
    expect(a.getAttribute('href')).toBe('https://forms.gle/abc');
    expect(a.textContent).toBe('Actividad con inscripción previa');
  });
  it('abre en pestaña nueva sin dar acceso a la página de origen', () => {
    montar(tarjeta(conEnlaces(form), sedePorId, () => {}));
    const a = document.querySelector('.card__enlaces a');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.getAttribute('aria-label')).toContain('pestaña nueva');
  });
  it('el enlace NO está dentro del botón que abre el detalle', () => {
    montar(tarjeta(conEnlaces(form), sedePorId, () => {}));
    expect(document.querySelectorAll('button a')).toHaveLength(0);
    expect(document.querySelector('article > .card__enlaces a')).not.toBeNull();
  });
  it('un mail abre la app de correo, sin pestaña nueva', () => {
    montar(tarjeta(conEnlaces(mail), sedePorId, () => {}));
    const a = document.querySelector('.card__enlaces a');
    expect(a.getAttribute('href')).toBe('mailto:a@b.com');
    expect(a.hasAttribute('target')).toBe(false);
    expect(a.getAttribute('aria-label')).toBe('Escribir a a@b.com');
  });
  it('sin enlaces no agrega nada', () => {
    montar(tarjeta(conEnlaces(), sedePorId, () => {}));
    expect(document.querySelector('.card__enlaces')).toBeNull();
  });
  it('un evento de datos viejos, sin el campo enlaces, no rompe', () => {
    const viejo = evento({ id: 'v' });
    delete viejo.enlaces;
    expect(() => montar(tarjeta(viejo, sedePorId, () => {}))).not.toThrow();
    expect(document.querySelector('.card__enlaces')).toBeNull();
  });
  it('descarta las URL no seguras que vengan en los datos', () => {
    const e = conEnlaces({ texto: 'Malo', url: 'javascript:alert(1)' }, form);
    expect(enlacesDe(e)).toEqual([form]);
    montar(tarjeta(e, sedePorId, () => {}));
    expect([...document.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['https://forms.gle/abc']);
  });
  it('con más enlaces de los que entran avisa que el resto está en el detalle', () => {
    const e = conEnlaces(form, mail, { texto: 'Otro', url: 'https://otro.org' });
    montar(enlacesDeTarjeta(e, { max: 2 }));
    expect(document.querySelectorAll('a')).toHaveLength(2);
    expect(document.body.textContent).toContain('+1 en el detalle');
  });
  it('el botón de abrir el detalle sigue funcionando', () => {
    let abierto = null;
    montar(tarjeta(conEnlaces(form), sedePorId, (e) => (abierto = e)));
    document.querySelector('button.card__open').click();
    expect(abierto?.id).toBe('e1');
  });
});

describe('enlaces en la tarjeta compacta (A la misma hora)', () => {
  it('también se ven, fuera del botón', () => {
    montar(tarjetaCompacta(conEnlaces(form), sedePorId, () => {}));
    expect(document.querySelector('.card__enlaces a')?.getAttribute('href')).toBe('https://forms.gle/abc');
    expect(document.querySelectorAll('button a')).toHaveLength(0);
  });
});

describe('sección de enlaces del detalle', () => {
  it('lista todos, con título en singular o plural', () => {
    montar(seccionEnlaces(conEnlaces(form)));
    expect(document.querySelector('h3').textContent).toBe('Enlace');
    montar(seccionEnlaces(conEnlaces(form, mail)));
    expect(document.querySelector('h3').textContent).toBe('Enlaces');
    expect(document.querySelectorAll('a')).toHaveLength(2);
  });
  it('sin enlaces no hay sección', () => {
    expect(seccionEnlaces(conEnlaces())).toBeNull();
  });
});

describe('texto de la descripción con enlaces', () => {
  it('las URL y los mails son <a>, el resto texto', () => {
    const p = document.createElement('p');
    p.append(...textoConEnlaces(linkificar('Inscribite en https://forms.gle/abc o escribí a a@b.com.')));
    document.body.replaceChildren(p);
    const links = [...p.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://forms.gle/abc', 'mailto:a@b.com']);
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(p.textContent).toBe('Inscribite en https://forms.gle/abc o escribí a a@b.com.');
  });
  it('el texto de los datos nunca se interpreta como HTML', () => {
    const p = document.createElement('p');
    p.append(...textoConEnlaces(linkificar('<img src=x onerror=alert(1)> https://ok.org')));
    document.body.replaceChildren(p);
    expect(p.querySelector('img')).toBeNull();
    expect(p.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
