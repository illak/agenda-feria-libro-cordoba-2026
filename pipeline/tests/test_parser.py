import json
from pathlib import Path

import pytest

from feria.build import RAIZ, escribir_json, reporte
from feria.parser import parsear

FIXTURE = RAIZ / "fixtures" / "programacion_2026-10-17.txt"  # snapshot fijo: los tests no deben depender del último


@pytest.fixture(scope="module")
def res():
    return parsear(FIXTURE.read_text(encoding="utf-8"))


def por_id(res, fragmento):
    encontrados = [e for e in res.eventos if fragmento in e.id]
    assert len(encontrados) == 1, fragmento
    return encontrados[0]


def test_cantidad_y_rango_de_fechas(res):
    assert 350 <= len(res.eventos) <= 420
    fechas = {e.fecha for e in res.eventos}
    assert min(fechas) == "2026-10-30" and max(fechas) == "2026-11-15"


def test_mes_inferido_y_zona_horaria(res):
    e = res.eventos[-1]
    assert e.fecha.startswith("2026-11")
    assert all(ev.hora_inicio.endswith("-03:00") for ev in res.eventos)


def test_ids_unicos_y_estables(res):
    ids = [e.id for e in res.eventos]
    assert len(ids) == len(set(ids))
    again = parsear(FIXTURE.read_text(encoding="utf-8"))
    assert ids == [e.id for e in again.eventos]


def test_evento_con_campos(res):
    e = por_id(res, "2026-10-30-1900-glauce-baldovin-poderes")
    assert e.sede_id == "glauce-baldovin"
    assert e.editorial == "Emporio Ediciones"
    roles = {(p.nombre, p.rol) for p in e.personas}
    assert ("Darío Villarreal", "autor") in roles


def test_libro_y_autor_desde_el_titulo(res):
    e = por_id(res, "2026-10-30-1700-malicha-leguizamon-presentacion-libro-alegria")
    assert e.libros_presentados == ["La alegría perdida de Caitruz"]
    assert any(p.nombre == "Mario Figueroa" and p.rol == "autor" for p in e.personas)
    assert e.ciclo == "INFANCIAS" and e.publico == "infancias"


def test_bloque_sade_se_separa_en_eventos_individuales(res):
    sade = [e for e in res.eventos if e.fecha == "2026-11-03" and "SADE" in e.titulo]
    assert [e.hora_inicio[11:16] for e in sade] == ["15:00", "16:00", "17:00", "18:00", "19:00", "20:00"]
    assert sade[0].hora_fin.endswith("T16:00:00-03:00")
    voces = sade[3]
    assert voces.libros_presentados == ["Voces del alma", "La cruz de los Andes", "La Escultura"]
    assert {p.nombre for p in voces.personas if p.rol == "autor"} == {"María Elena Roquier", "Javier del Corro"}
    # la marca con typo "(16;00)" del otro bloque también se reconoce
    assert len([e for e in res.eventos if e.fecha == "2026-11-04" and "SADE" in e.titulo]) == 6


def test_etiqueta_direccion_es_realizador(res):
    quino = next(e for e in res.eventos if "Quinografía" in e.titulo)
    assert {p.nombre for p in quino.personas if p.rol == "realizador"} == {"Mariano Donoso", "Federico Cardone"}


def test_horas_variantes(res):
    # "20.00 a 21.00" con punto, y rango que cruza medianoche
    cruza = [e for e in res.eventos if e.hora_fin and e.hora_fin[:10] > e.hora_inicio[:10]]
    assert cruza and all(e.hora_fin > e.hora_inicio for e in res.eventos if e.hora_fin)


def test_dos_funciones_generan_dos_eventos(res):
    quino = [e for e in res.eventos if "Quinografía" in e.titulo and e.fecha == "2026-11-13"]
    assert sorted(e.hora_inicio[11:16] for e in quino) == ["15:30", "23:00"]


def test_normaliza_variantes_de_sede(res):
    carpas = {e.sede_id for e in res.eventos}
    assert {"lilia-lardone", "glauce-baldovin", "juan-filloy", "malicha-leguizamon", "leonor-marzano"} <= carpas
    sedes = {s.id: s for s in res.sedes}
    assert not any("badovin" in i or "manzano" in i for i in sedes)
    assert sedes["glauce-baldovin"].color == "roja"
    assert any(s.tipo == "externa" and s.color == "gris" for s in sedes.values())


def test_carpa_susana_cabuchi_es_glauce_baldovin(res):
    # error del doc: la carpa roja es Glauce Baldovin
    assert not any("Cabuchi" in a for a in res.advertencias)
    assert not any("cabuchi" in s.id for s in res.sedes)


def test_sede_desconocida_es_warning(res):
    assert any("sede fuera del catálogo" in a for a in res.advertencias)


def test_todos_los_sede_id_existen_en_sedes(res):
    ids = {s.id for s in res.sedes}
    assert all(e.sede_id in ids for e in res.eventos if e.sede_id)


def test_reporte_incluye_campos_vacios(res):
    texto = reporte(res)
    assert f"Total de eventos: {len(res.eventos)}" in texto
    assert "Campos vacíos" in texto and "descripcion" in texto
    assert "Filas de baja confianza" in texto


def test_json_de_salida(res, tmp_path):
    ruta = tmp_path / "eventos.json"
    escribir_json(ruta, res.eventos)
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    assert len(datos) == len(res.eventos)
    assert {"id", "fecha", "hora_inicio", "sede_id", "personas", "confianza"} <= datos[0].keys()


def test_dia_sin_actividades_queda_como_aviso(res):
    assert list(res.avisos_dias) == ["2026-11-10"]
    assert "Papa León XIV" in res.avisos_dias["2026-11-10"]
    assert not any(e.fecha == "2026-11-10" for e in res.eventos)


def test_hora_fin_estimada_solo_si_falta_hora_fin(res):
    sin_fin = [e for e in res.eventos if not e.hora_fin]
    assert sin_fin and all(e.hora_fin_estimada for e in sin_fin)
    assert all(not e.hora_fin_estimada for e in res.eventos if e.hora_fin)
    e = next(e for e in sin_fin if e.hora_inicio.endswith("T17:00:00-03:00"))
    assert e.hora_fin_estimada == e.hora_inicio.replace("T17:00", "T18:00")
