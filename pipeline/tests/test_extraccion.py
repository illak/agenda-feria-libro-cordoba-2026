# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Illak Zapata
import json

import pytest
from pydantic import ValidationError

from feria import extraccion
from feria.extraccion import Extraccion, hash_bloque, importar
from feria.parser import parsear

from test_parser import FIXTURE


def test_tema_fuera_de_taxonomia_se_rechaza():
    with pytest.raises(ValidationError):
        Extraccion.model_validate({"temas": ["astrología"]})


def test_mas_de_dos_temas_se_rechaza():
    with pytest.raises(ValidationError):
        Extraccion.model_validate({"temas": ["poesía", "historia", "narrativa"]})


def test_rol_realizador_y_varios_libros():
    x = Extraccion.model_validate({
        "personas": [{"nombre": "Ana Pérez", "rol": "realizador"}],
        "libros_presentados": ["Uno", "Dos"],
    })
    assert x.personas[0].rol == "realizador" and len(x.libros_presentados) == 2


def test_formato_viejo_se_rechaza():
    with pytest.raises(ValidationError):
        Extraccion.model_validate({"libro_presentado": "Un libro"})


def test_rol_invalido_se_rechaza():
    with pytest.raises(ValidationError):
        Extraccion.model_validate({"personas": [{"nombre": "Ana Pérez", "rol": "jefe"}]})


def test_hash_estable_por_contenido():
    assert hash_bloque("a") == hash_bloque("a") != hash_bloque("b")


def test_importar_valida_y_cachea(tmp_path, monkeypatch):
    monkeypatch.setattr(extraccion, "CACHE", tmp_path / "cache")
    monkeypatch.setattr(extraccion, "LOTES", tmp_path / "lotes")
    (tmp_path / "lotes").mkdir()
    (tmp_path / "lotes" / "lote_01.json").write_text(
        json.dumps([{"hash": "aaaa", "texto": "x"}, {"hash": "bbbb", "texto": "y"}, {"hash": "cccc", "texto": "z"}])
    )
    res = tmp_path / "lotes" / "resultado_01.json"
    res.write_text(json.dumps({
        "aaaa": {"temas": ["poesía"], "libros_presentados": ["Un libro"]},
        "bbbb": {"temas": ["inventado"]},   # fuera de la taxonomía
        "zzzz": {"temas": []},              # hash que no se pidió
    }))
    ok, errores = importar([res])
    assert ok == 1 and len(errores) == 2
    assert extraccion.cargar_cache().keys() == {"aaaa"}


def test_etiqueta_explicita_gana_sobre_el_llm_y_se_registra_el_conflicto():
    texto = FIXTURE.read_text(encoding="utf-8")
    base = parsear(texto)
    # "Poderes, violencias invisibilizadas...": Autor: Darío Villarreal / A cargo de: Emporio Ediciones
    h = next(h for h, i in base.bloques_info.items() if i["titulo"].startswith("Poderes, violencias"))
    x = Extraccion.model_validate({
        "personas": [{"nombre": "Darío Villarreal", "rol": "participa"}],
        "editorial": "Otra Editorial",
    })
    con = parsear(texto, {h: x})
    ev = next(e for e in con.eventos if e.titulo.startswith("Poderes, violencias"))
    assert ev.editorial == "Emporio Ediciones"
    assert [p.rol for p in ev.personas if p.nombre == "Darío Villarreal"] == ["autor"]
    assert len(con.conflictos) == 2


def test_bloques_sin_cache_quedan_pendientes():
    texto = FIXTURE.read_text(encoding="utf-8")
    assert parsear(texto).extraccion_pendiente == {}  # sin LLM no hay pendientes
    con = parsear(texto, {})
    assert con.extraccion_pendiente.keys() == con.bloques.keys()


def test_merge_pisa_regex_solo_si_hay_dato():
    texto = FIXTURE.read_text(encoding="utf-8")
    base = parsear(texto)
    h = next(iter(base.bloques))
    x = Extraccion.model_validate({"temas": ["historia"], "personas": [{"nombre": "Ana Pérez", "rol": "autor"}]})
    con = parsear(texto, {h: x})
    ev = next(e for e in con.eventos if e.temas)
    assert ev.temas == ["historia"] and ev.personas[0].nombre == "Ana Pérez"
    assert sum(1 for e in con.eventos if e.temas) < len(con.eventos)
