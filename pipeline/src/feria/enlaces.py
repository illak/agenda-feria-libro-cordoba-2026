# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Illak Zapata
"""Hipervínculos del Google Doc.

El export a texto pierde las URL de las palabras enlazadas ("Inscripciones AQUÍ"); el export a HTML las conserva.
Se recorre el HTML con los mismos encabezados de día y líneas de hora que el parser, y cada enlace se asocia al
bloque (día + posición) donde está. `parsear` los usa solo si el día tiene la misma cantidad de bloques en ambos.
"""
import re
from html.parser import HTMLParser
from urllib.parse import parse_qs, urlparse

from .modelos import Enlace
from .parser import RE_DIA, RE_HORA, fecha_de, norm_linea

ESQUEMAS = {"http", "https", "mailto"}
# anclas que no dicen nada solas: la etiqueta sale del resto de la línea ("Actividad con inscripción previa AQUÍ")
ANCLAS_GENERICAS = {"aquí", "aqui", "acá", "aca", "link", "enlace", "este enlace", "este link", "clic aquí", "click aquí", "haciendo clic aquí"}
BLOQUES = {"p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "div", "tr", "br"}
IGNORADOS = {"style", "script", "head", "title"}


def desenvolver(url: str) -> str:
    """Google envuelve los enlaces del export en google.com/url?q=<real>."""
    if "google.com/url" in url:
        q = parse_qs(urlparse(url).query).get("q")
        if q:
            return q[0]
    return url


def url_valida(url: str) -> bool:
    return urlparse(url).scheme.lower() in ESQUEMAS


def etiqueta(ancla: str, linea: str) -> str:
    """Texto legible del enlace: el ancla, salvo que sea genérica ("AQUÍ"); ahí, el resto de la línea."""
    if ancla.lower().strip(" .:") in ANCLAS_GENERICAS:
        resto = re.sub(re.escape(ancla), "", linea, count=1).strip(" -–—:.,")
        if resto:
            return resto
    return ancla


class _Lineas(HTMLParser):
    """Líneas del documento (texto normalizado) con los enlaces de cada una: [(texto, [(ancla, url)])]."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lineas: list[tuple[str, list[tuple[str, str]]]] = []
        self._buf: list[str] = []
        self._enlaces: list[tuple[str, str]] = []
        self._href: str | None = None
        self._ancla: list[str] = []
        self._ignorar = 0

    def _cerrar(self):
        texto = norm_linea("".join(self._buf))
        if texto:
            self.lineas.append((texto, self._enlaces))
        self._buf, self._enlaces = [], []

    def handle_starttag(self, tag, attrs):
        if tag in IGNORADOS:
            self._ignorar += 1
        elif tag in BLOQUES:
            self._cerrar()
        elif tag == "a" and (href := dict(attrs).get("href")):
            self._href, self._ancla = desenvolver(href), []

    def handle_endtag(self, tag):
        if tag in IGNORADOS:
            self._ignorar = max(0, self._ignorar - 1)
        elif tag == "a" and self._href is not None:
            self._enlaces.append((norm_linea("".join(self._ancla)), self._href))
            self._href = None
        elif tag in BLOQUES:
            self._cerrar()

    def handle_data(self, data):
        if self._ignorar:
            return
        self._buf.append(data)
        if self._href is not None:
            self._ancla.append(data)

    def close(self):
        super().close()
        self._cerrar()


def extraer(html: str) -> dict[str, dict]:
    """fecha ISO -> {"bloques": cantidad de líneas de hora, "por_bloque": {posición: [(Enlace, línea)]}}."""
    p = _Lineas()
    p.feed(html)
    p.close()
    dias: dict[str, dict] = {}
    actual = None
    orden = -1
    for linea, enlaces in p.lineas:
        if m := RE_DIA.match(linea):
            actual = fecha_de(m.group(1), int(m.group(2))).isoformat()
            dias[actual] = {"bloques": 0, "por_bloque": {}}
            orden = -1
        elif actual and RE_HORA.match(linea):
            orden += 1
            dias[actual]["bloques"] = orden + 1
        elif actual and enlaces and orden >= 0:
            for ancla, url in enlaces:
                if ancla and url_valida(url):
                    dias[actual]["por_bloque"].setdefault(orden, []).append((Enlace(texto=etiqueta(ancla, linea), url=url), linea))
    return dias
