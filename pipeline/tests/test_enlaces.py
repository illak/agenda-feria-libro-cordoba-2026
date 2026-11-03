# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Illak Zapata
"""Hipervínculos del doc: el export a texto pierde las URL de "AQUÍ"; el HTML las conserva."""
from urllib.parse import quote

from feria.build import RAIZ
from feria.enlaces import etiqueta, extraer, url_valida
from feria.parser import parsear

TXT = RAIZ / "fixtures" / "programacion_2026-11-03.txt"
HTML = RAIZ / "fixtures" / "programacion_2026-11-03.html"


def envuelto(url: str) -> str:
    """Como los entrega Google en el export: google.com/url?q=<real>&sa=D..."""
    return f"https://www.google.com/url?q={quote(url, safe='')}&amp;sa=D&amp;source=editors"


def doc(*parrafos: str) -> str:
    return "<html><head><style>@import url(x);</style></head><body>" + "".join(f"<p>{p}</p>" for p in parrafos) + "</body></html>"


DIA = "<span>| VIERNES 30</span>"


def test_asocia_el_enlace_al_bloque_y_pone_etiqueta_legible():
    html = doc(DIA, "17:00", "Taller de dibujo", f'Actividad con inscripción previa <a href="{envuelto("https://forms.gle/abc")}">AQUÍ </a>', "Carpa Juan Filloy | Azul")
    d = extraer(html)["2026-10-30"]
    assert d["bloques"] == 1
    (enlace, linea), = d["por_bloque"][0]
    assert enlace.url == "https://forms.gle/abc"  # sin el envoltorio de Google
    assert enlace.texto == "Actividad con inscripción previa"
    assert linea == "Actividad con inscripción previa AQUÍ"


def test_un_ancla_con_sentido_se_deja_tal_cual():
    html = doc(DIA, "17:00", "Charla", 'Bases del <a href="https://ejemplo.org/bases.pdf">Premio de Traducción</a> 2026')
    (enlace, _), = extraer(html)["2026-10-30"]["por_bloque"][0]
    assert enlace.texto == "Premio de Traducción"


def test_mailto_y_url_en_el_ancla():
    html = doc(DIA, "17:00", "Charla", 'Escribir a <a href="mailto:a@b.com">a@b.com</a>', 'Sitio: <a href="https://x.org/">https://x.org/</a>')
    enlaces = [e.url for e, _ in extraer(html)["2026-10-30"]["por_bloque"][0]]
    assert enlaces == ["mailto:a@b.com", "https://x.org/"]


def test_descarta_esquemas_peligrosos_y_anclas_vacias():
    html = doc(DIA, "17:00", "Charla", '<a href="javascript:alert(1)">clic</a> <a href="data:text/html,x">otro</a> <a href="https://ok.org/"> </a>')
    assert extraer(html)["2026-10-30"]["por_bloque"] == {}
    assert url_valida("https://a.org") and url_valida("mailto:a@b.com") and not url_valida("javascript:alert(1)") and not url_valida("ftp://a.org")


def test_el_css_del_head_no_se_cuenta_como_linea():
    d = extraer(doc(DIA, "17:00", "Charla"))["2026-10-30"]
    assert d["bloques"] == 1


def test_enlaces_antes_de_la_primera_hora_se_ignoran():
    html = doc(DIA, '<a href="https://suelto.org/">Info</a>', "17:00", "Charla")
    assert extraer(html)["2026-10-30"]["por_bloque"] == {}


def test_etiqueta():
    assert etiqueta("AQUÍ", "Inscripciones AQUÍ") == "Inscripciones"
    assert etiqueta("aquí", "Para anotarte: aquí.") == "Para anotarte"
    assert etiqueta("AQUÍ", "AQUÍ") == "AQUÍ"  # sin contexto, queda el ancla
    assert etiqueta("Programa completo", "Programa completo") == "Programa completo"


# --- con el doc real ---------------------------------------------------------------------------

def eventos_con_enlaces():
    res = parsear(TXT.read_text(encoding="utf-8"), None, extraer(HTML.read_text(encoding="utf-8")))
    return res, [e for e in res.eventos if e.enlaces]


def test_el_doc_real_asigna_los_enlaces_a_sus_actividades():
    res, con = eventos_con_enlaces()
    urls = {e.id: [x.url for x in e.enlaces] for e in con}
    todas = [u for us in urls.values() for u in us]
    assert len(con) >= 10
    assert todas.count("https://forms.gle/kafr4VUn1KBc2Xmc9") == 6  # inscripciones del 12 y 13/11
    assert "https://forms.gle/iq63tkZsCqVVDwk76" in todas
    assert "https://alianzafrancesacba.org.ar/" in todas
    assert "mailto:librosmemoriavegetal@gmail.com" in todas
    assert not any("omitido" in a or "se omiten" in a for a in res.advertencias)


def test_la_alianza_francesa_queda_en_su_actividad():
    _, con = eventos_con_enlaces()
    e = next(e for e in con if any("alianzafrancesacba" in x.url for x in e.enlaces))
    assert e.fecha == "2026-11-14" and "Sabores de Alemania y Francia" in e.titulo


def test_todos_los_enlaces_tienen_etiqueta_legible_y_esquema_valido():
    _, con = eventos_con_enlaces()
    for e in con:
        for x in e.enlaces:
            assert x.texto.strip() and x.texto.lower() != "aquí"
            assert url_valida(x.url)


def test_sin_html_los_eventos_no_tienen_enlaces():
    res = parsear(TXT.read_text(encoding="utf-8"))
    assert all(e.enlaces == [] for e in res.eventos)


def test_si_el_dia_no_coincide_se_omiten_sus_enlaces_y_se_avisa():
    enlaces = extraer(HTML.read_text(encoding="utf-8"))
    enlaces["2026-11-12"]["bloques"] += 1  # el HTML "tiene" un bloque de más ese día
    res = parsear(TXT.read_text(encoding="utf-8"), None, enlaces)
    assert not any(e.enlaces for e in res.eventos if e.fecha == "2026-11-12")
    assert any("2026-11-12" in a and "se omiten sus enlaces" in a for a in res.advertencias)
    assert any(e.enlaces for e in res.eventos if e.fecha == "2026-11-13")  # los otros días no se tocan
