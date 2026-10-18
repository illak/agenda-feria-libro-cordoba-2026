from feria import cambios


def ev(id, titulo="Charla", fecha="2026-11-01", hora="18:00", sede="juan-filloy", **extra):
    base = dict(
        id=id, fecha=fecha, hora_inicio=f"{fecha}T{hora}:00-03:00", hora_fin="", titulo=titulo,
        descripcion="", tipo="charla", ciclo="", temas=[], sede_id=sede, personas=[],
        libros_presentados=[], editorial="", publico="general",
    )
    return base | extra


def test_agregados_y_eliminados():
    d = cambios.calcular([ev("a"), ev("b", titulo="Otra")], [ev("a"), ev("c", titulo="Nueva")])
    assert [e["id"] for e in d["agregados"]] == ["c"]
    assert [e["id"] for e in d["eliminados"]] == ["b"]
    assert d["modificados"] == []


def test_cambio_de_hora_se_ve_como_modificacion_aunque_cambie_el_id():
    d = cambios.calcular([ev("viejo", hora="18:00")], [ev("nuevo", hora="19:30")])
    assert d["agregados"] == [] and d["eliminados"] == []
    assert d["modificados"][0]["campos"] == ["hora_inicio"]


def test_cambio_de_sede_y_markdown():
    d = cambios.calcular([ev("x", sede="juan-filloy")], [ev("y", sede="glauce-baldovin")])
    md = cambios.a_markdown(d, "## Prueba")
    assert "Cambios de horario o sede" in md and "juan-filloy → glauce-baldovin" in md


def test_otros_campos_modificados():
    d = cambios.calcular([ev("a", temas=[])], [ev("a", temas=["historia"])])
    assert d["modificados"][0]["campos"] == ["temas"]
    assert "Otras modificaciones" in cambios.a_markdown(d, "## Prueba")
