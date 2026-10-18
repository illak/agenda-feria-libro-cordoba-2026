"""Publica data/ en web/public/data/: diff contra lo publicado, changelog y meta.json."""
import argparse
import json
import shutil
import sys

from . import cambios
from .build import RAIZ, ahora

DATA = RAIZ / "data"
PUBLICADO = RAIZ / "web" / "public" / "data"
ARCHIVOS = ["eventos.json", "sedes.json", "autores.json", "libros.json"]


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="feria.publicar")
    ap.add_argument("--solo-cambios", action="store_true", help="mostrar y guardar el diff sin copiar a web/")
    args = ap.parse_args(argv)

    if not (DATA / "eventos.json").exists() or not (DATA / "meta.json").exists():
        print("ERROR: no hay data/eventos.json; corré primero `uv run python -m feria.build`.")
        return 1
    meta = json.loads((DATA / "meta.json").read_text(encoding="utf-8"))
    if meta.get("extraccion_pendiente"):
        print(f"ERROR: el último build tiene {meta['extraccion_pendiente']} bloques sin extracción; no se publica.")
        return 1

    nuevos = json.loads((DATA / "eventos.json").read_text(encoding="utf-8"))
    previo = PUBLICADO / "eventos.json"
    viejos = json.loads(previo.read_text(encoding="utf-8")) if previo.exists() else None

    t = ahora()
    encabezado = f"## Actualización {t:%H:%M} (snapshot {meta['snapshot']})"
    if viejos is None:
        md = f"{encabezado}\n\nPrimera publicación: {len(nuevos)} eventos.\n"
    else:
        md = cambios.a_markdown(cambios.calcular(viejos, nuevos), encabezado)
    ruta = DATA / "cambios" / f"{t:%Y-%m-%d}.md"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    if ruta.exists():
        ruta.write_text(ruta.read_text(encoding="utf-8") + "\n" + md, encoding="utf-8")
    else:
        ruta.write_text(f"# Cambios del {t:%Y-%m-%d}\n\n{md}", encoding="utf-8")
    print(md)
    print(f"Guardado en {ruta.relative_to(RAIZ)}")

    if args.solo_cambios:
        return 0
    PUBLICADO.mkdir(parents=True, exist_ok=True)
    for nombre in ARCHIVOS:
        if (DATA / nombre).exists():
            shutil.copy2(DATA / nombre, PUBLICADO / nombre)
    meta["actualizado"] = t.isoformat(timespec="seconds")
    texto_meta = json.dumps(meta, ensure_ascii=False, indent=2) + "\n"
    (DATA / "meta.json").write_text(texto_meta, encoding="utf-8")
    (PUBLICADO / "meta.json").write_text(texto_meta, encoding="utf-8")
    print(f"Publicado en {PUBLICADO.relative_to(RAIZ)} ({meta['actualizado']}, snapshot {meta['snapshot']})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
