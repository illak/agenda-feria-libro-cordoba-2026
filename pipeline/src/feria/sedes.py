# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Illak Zapata
"""Catálogo de sedes y normalización del texto de sede del doc."""
import re
import unicodedata

from .modelos import Sede

CARPAS = [
    Sede(id="lilia-lardone", nombre="Carpa Lilia Lardone", color="naranja", tipo="carpa"),
    Sede(id="glauce-baldovin", nombre="Carpa Glauce Baldovin", color="roja", tipo="carpa"),
    Sede(id="juan-filloy", nombre="Carpa Juan Filloy", color="azul", tipo="carpa"),
    Sede(id="malicha-leguizamon", nombre="Carpa Malicha Leguizamón", color="magenta", tipo="carpa"),
    Sede(
        id="leonor-marzano",
        nombre="Escenario Leonor Marzano",
        color="turquesa",
        tipo="carpa",
        direccion="Explanada Palacio Municipal 6 de Julio",
    ),
]

# Fragmentos (sin acentos, minúsculas) que identifican cada carpa, incluyendo
# los errores de tipeo que tiene el doc (Badovin, Manzano).
_ALIAS = {
    "lilia-lardone": ["lilia lardone", "carpa naranja"],
    "glauce-baldovin": ["glauce", "baldovin", "badovin", "carpa roja", "susana cabuchi"],
    "juan-filloy": ["juan filloy", "carpa azul"],
    "malicha-leguizamon": ["malicha", "carpa magenta"],
    "leonor-marzano": ["leonor marzano", "leonor manzano"],
}

COLOR_EXTERNA = "gris"


def sin_acentos(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )


def slug(texto: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", sin_acentos(texto).lower()).strip("-")


def buscar_carpa(texto: str) -> str | None:
    """Devuelve el id de la carpa del catálogo que aparece en el texto, si hay."""
    t = sin_acentos(texto).lower()
    for sede_id, alias in _ALIAS.items():
        if any(a in t for a in alias):
            return sede_id
    return None


def sede_externa(texto: str) -> Sede:
    """Arma una sede externa a partir del texto crudo (nombre y dirección)."""
    t = re.sub(r"^(?:Invita|Lugar):\s*", "", texto.strip())
    t = re.sub(r"\s*\|\s*", " | ", t.rstrip("."))
    if "," in t:
        nombre, direccion = (p.strip() for p in t.split(",", 1))
    elif " - " in t:
        nombre, direccion = (p.strip() for p in t.rsplit(" - ", 1))
    else:
        nombre, direccion = t, ""
    return Sede(
        id=slug(t)[:60].strip("-"), nombre=nombre, color=COLOR_EXTERNA, tipo="externa", direccion=direccion
    )
