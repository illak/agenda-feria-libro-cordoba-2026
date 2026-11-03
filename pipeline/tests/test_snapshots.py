# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Illak Zapata
"""Combinación de snapshots: los días que el doc ya no trae se conservan del último snapshot que los tenía."""
import json

import pytest

from feria import build
from feria.build import RAIZ, combinar
from feria.parser import parsear

VIEJO = RAIZ / "fixtures" / "programacion_2026-10-26.txt"
NUEVO = RAIZ / "fixtures" / "programacion_2026-11-03.txt"


def texto(p):
    return p.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def combinado():
    return combinar([VIEJO, NUEVO], None)


def test_un_solo_snapshot_da_lo_mismo_que_parsearlo(combinado):
    res, aportes = combinar([NUEVO], None)
    solo = parsear(texto(NUEVO))
    assert [e.id for e in res.eventos] == [e.id for e in solo.eventos]
    assert aportes == {}


def test_los_dias_pasados_se_conservan_del_snapshot_viejo(combinado):
    res, aportes = combinado
    por_dia = {e.fecha for e in res.eventos}
    assert {"2026-10-30", "2026-10-31", "2026-11-01"} <= por_dia
    assert aportes == {VIEJO.name: ["2026-10-30", "2026-10-31", "2026-11-01"]}
    viejos = {e.id for e in parsear(texto(VIEJO)).eventos if e.fecha <= "2026-11-01"}
    assert viejos <= {e.id for e in res.eventos}


def test_los_dias_vigentes_salen_del_snapshot_nuevo(combinado):
    res, _ = combinado
    nuevos = [e.id for e in parsear(texto(NUEVO)).eventos]
    del_combinado = [e.id for e in res.eventos if e.fecha >= "2026-11-02"]
    assert sorted(del_combinado) == sorted(nuevos)
    # una actividad que solo está en el doc nuevo aparece
    assert any("pintando-memorias" in i for i in del_combinado)


def test_un_dia_en_ambos_snapshots_usa_el_mas_nuevo(combinado):
    res, _ = combinado
    ids_viejo_2_nov = {e.id for e in parsear(texto(VIEJO)).eventos if e.fecha == "2026-11-02"}
    ids_nuevo_2_nov = {e.id for e in parsear(texto(NUEVO)).eventos if e.fecha == "2026-11-02"}
    assert ids_viejo_2_nov != ids_nuevo_2_nov  # el doc cambió ese día
    assert {e.id for e in res.eventos if e.fecha == "2026-11-02"} == ids_nuevo_2_nov


def test_ids_unicos_y_orden_cronologico(combinado):
    res, _ = combinado
    ids = [e.id for e in res.eventos]
    assert len(ids) == len(set(ids))
    claves = [(e.hora_inicio, e.sede_id, e.id) for e in res.eventos]
    assert claves == sorted(claves)


def test_conserva_el_aviso_del_10_11_y_todas_las_sedes(combinado):
    res, _ = combinado
    assert "2026-11-10" in res.avisos_dias
    ids_sedes = {s.id for s in res.sedes}
    assert len(ids_sedes) == len(res.sedes)
    assert {e.sede_id for e in res.eventos if e.sede_id} <= ids_sedes


def test_orden_de_los_archivos_no_importa():
    a, _ = combinar([VIEJO, NUEVO], None)
    b, _ = combinar([NUEVO, VIEJO], None)
    assert [e.id for e in a.eventos] == [e.id for e in b.eventos]


def test_build_escribe_los_snapshots_antiguos_en_meta(tmp_path, monkeypatch):
    monkeypatch.setattr(build, "RAIZ", tmp_path)
    (tmp_path / "fixtures").mkdir()
    for p in (VIEJO, NUEVO):
        (tmp_path / "fixtures" / p.name).write_text(texto(p), encoding="utf-8")
    assert build.main(["--permitir-pendientes"]) == 0
    meta = json.loads((tmp_path / "data" / "meta.json").read_text(encoding="utf-8"))
    assert meta["snapshot"] == NUEVO.name
    assert meta["snapshots_antiguos"] == {VIEJO.name: ["2026-10-30", "2026-10-31", "2026-11-01"]}
    eventos = json.loads((tmp_path / "data" / "eventos.json").read_text(encoding="utf-8"))
    assert {e["fecha"] for e in eventos} >= {"2026-10-30", "2026-11-15"}
