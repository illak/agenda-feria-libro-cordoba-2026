import json

from feria import actualizar, build, extraccion, publicar

from test_parser import FIXTURE


def preparar_raiz(tmp_path, monkeypatch):
    for mod in (build, actualizar, publicar):
        monkeypatch.setattr(mod, "RAIZ", tmp_path, raising=False)
    monkeypatch.setattr(actualizar, "FIXTURES", tmp_path / "fixtures")
    monkeypatch.setattr(publicar, "DATA", tmp_path / "data")
    monkeypatch.setattr(publicar, "PUBLICADO", tmp_path / "web" / "public" / "data")
    monkeypatch.setattr(extraccion, "CACHE", tmp_path / "cache" / "extraccion")
    monkeypatch.setattr(extraccion, "LOTES", tmp_path / "cache" / "lotes")
    (tmp_path / "fixtures").mkdir()
    (tmp_path / "fixtures" / FIXTURE.name).write_text(FIXTURE.read_text(encoding="utf-8"), encoding="utf-8")


def test_build_falla_con_pendientes_salvo_que_se_permita(tmp_path, monkeypatch, capsys):
    preparar_raiz(tmp_path, monkeypatch)
    assert build.main([]) == 1
    assert "extraccion_pendiente" in capsys.readouterr().out
    assert not (tmp_path / "data" / "eventos.json").exists()
    assert build.main(["--permitir-pendientes"]) == 0
    meta = json.loads((tmp_path / "data" / "meta.json").read_text(encoding="utf-8"))
    assert meta["snapshot"] == FIXTURE.name and meta["extraccion_pendiente"] > 0


def test_actualizar_con_archivo_prepara_lotes_y_no_duplica_snapshot(tmp_path, monkeypatch, capsys):
    preparar_raiz(tmp_path, monkeypatch)
    assert actualizar.main([str(FIXTURE)]) == 0
    out = capsys.readouterr().out
    assert "Lotes preparados" in out and "Siguiente paso" in out
    assert list((tmp_path / "cache" / "lotes").glob("lote_*.json"))


def test_actualizar_rechaza_archivo_que_no_es_la_programacion(tmp_path, monkeypatch):
    preparar_raiz(tmp_path, monkeypatch)
    basura = tmp_path / "x.txt"
    basura.write_text("hola", encoding="utf-8")
    assert actualizar.main([str(basura)]) == 1


def test_publicar_copia_actualiza_meta_y_guarda_cambios(tmp_path, monkeypatch):
    preparar_raiz(tmp_path, monkeypatch)
    assert build.main(["--permitir-pendientes"]) == 0
    # publicar no acepta un build con pendientes
    assert publicar.main([]) == 1
    meta = json.loads((tmp_path / "data" / "meta.json").read_text(encoding="utf-8"))
    meta["extraccion_pendiente"] = 0
    (tmp_path / "data" / "meta.json").write_text(json.dumps(meta), encoding="utf-8")

    assert publicar.main([]) == 0
    pub = tmp_path / "web" / "public" / "data"
    publicado = json.loads((pub / "meta.json").read_text(encoding="utf-8"))
    assert publicado["snapshot"] == FIXTURE.name and publicado["actualizado"].endswith("-03:00")
    assert (pub / "eventos.json").exists() and (pub / "sedes.json").exists()
    cambios = list((tmp_path / "data" / "cambios").glob("*.md"))
    assert len(cambios) == 1 and "Primera publicación" in cambios[0].read_text(encoding="utf-8")

    # segunda vez: sin cambios, el changelog del día suma una sección
    assert publicar.main([]) == 0
    assert "Agregados: 0 · Eliminados: 0 · Modificados: 0" in cambios[0].read_text(encoding="utf-8")
