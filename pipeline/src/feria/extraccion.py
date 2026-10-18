# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Illak Zapata
"""Extracción con LLM (subagentes Haiku) de personas, libro, editorial y temas.

El pipeline no llama al LLM: prepara lotes de bloques pendientes, los subagentes
escriben sus resultados en JSON, y `importar` los valida con Pydantic y los guarda
en un caché por hash del bloque. `parsear` solo lee ese caché.
"""
import hashlib
import json
import sys
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .modelos import Rol

RAIZ_PIPELINE = Path(__file__).resolve().parents[2]
CACHE = RAIZ_PIPELINE / "cache" / "extraccion"
LOTES = RAIZ_PIPELINE / "cache" / "lotes"

Tema = str
TEMAS = [
    "memoria y dictadura", "historia", "narrativa", "poesía", "ensayo y pensamiento",
    "infancias y juventudes", "no ficción y periodismo", "música y artes escénicas",
    "cine y audiovisual", "tecnología e IA", "países invitados", "oficio editorial",
]


class PersonaExtraida(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=3, max_length=80)
    rol: Rol


class Extraccion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    personas: list[PersonaExtraida] = Field(default_factory=list)
    libros_presentados: list[str] = Field(default_factory=list, max_length=8)
    editorial: str = Field(default="", max_length=100)
    temas: list[str] = Field(default_factory=list, max_length=2)

    def model_post_init(self, _ctx) -> None:
        invalidos = [t for t in self.temas if t not in TEMAS]
        if invalidos:
            raise ValueError(f"temas fuera de la taxonomía: {invalidos}")


def hash_bloque(texto: str) -> str:
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()[:16]


def cargar_cache() -> dict[str, Extraccion]:
    out = {}
    for ruta in CACHE.glob("*.json"):
        try:
            out[ruta.stem] = Extraccion.model_validate_json(ruta.read_text(encoding="utf-8"))
        except ValidationError:
            continue  # entrada corrupta: se vuelve a pedir
    return out


def preparar(bloques: dict[str, str], tamano: int = 25) -> list[Path]:
    """Escribe lotes con los bloques que no están en el caché."""
    LOTES.mkdir(parents=True, exist_ok=True)
    for viejo in LOTES.glob("lote_*.json"):
        viejo.unlink()
    cache = cargar_cache()
    pendientes = [{"hash": h, "texto": t} for h, t in bloques.items() if h not in cache]
    rutas = []
    for i in range(0, len(pendientes), tamano):
        ruta = LOTES / f"lote_{i // tamano + 1:02d}.json"
        ruta.write_text(json.dumps(pendientes[i:i + tamano], ensure_ascii=False, indent=1), encoding="utf-8")
        rutas.append(ruta)
    return rutas


def importar(rutas: list[Path]) -> tuple[int, list[str]]:
    """Valida los resultados de los subagentes y los guarda en el caché."""
    CACHE.mkdir(parents=True, exist_ok=True)
    ok, errores = 0, []
    # solo se aceptan hashes que pedimos: un subagente puede equivocarse al copiarlos
    validos = {x["hash"] for lote in LOTES.glob("lote_*.json") for x in json.loads(lote.read_text(encoding="utf-8"))}
    for ruta in rutas:
        try:
            datos = json.loads(ruta.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            errores.append(f"{ruta.name}: {e}")
            continue
        for h, crudo in datos.items():
            if h not in validos:
                errores.append(f"{ruta.name} {h}: hash que no está en los lotes")
                continue
            try:
                x = Extraccion.model_validate(crudo)
            except (ValidationError, ValueError) as e:
                errores.append(f"{ruta.name} {h}: {str(e).splitlines()[0]}")
                continue
            (CACHE / f"{h}.json").write_text(x.model_dump_json(indent=1), encoding="utf-8")
            ok += 1
    return ok, errores


def main(argv: list[str]) -> int:
    from .build import ultimo_snapshot
    from .parser import parsear

    if not argv:
        print("uso: python -m feria.extraccion preparar | importar")
        return 1
    if argv[0] == "preparar":
        fixture = ultimo_snapshot()
        res = parsear(fixture.read_text(encoding="utf-8"))
        rutas = preparar(res.bloques)
        print(f"{len(res.bloques)} bloques, {len(rutas)} lotes pendientes en {LOTES}")
    elif argv[0] == "importar":
        ok, errores = importar(sorted(LOTES.glob("resultado_*.json")))
        print(f"importados: {ok}, errores: {len(errores)}")
        for e in errores:
            print("  -", e)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
