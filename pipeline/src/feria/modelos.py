"""Modelos Pydantic de los JSON publicados."""
from typing import Literal

from pydantic import BaseModel, Field

Rol = Literal["autor", "presenta", "modera", "participa", "a_cargo", "realizador"]


class Persona(BaseModel):
    autor_id: str
    nombre: str
    rol: Rol


class Sede(BaseModel):
    id: str
    nombre: str
    color: str
    tipo: Literal["carpa", "externa"]
    direccion: str = ""


class Evento(BaseModel):
    id: str
    fecha: str
    hora_inicio: str
    hora_fin: str = ""
    hora_fin_estimada: str = ""  # solo si el doc no trae hora_fin; es aproximada (inicio + DURACION_ESTIMADA)
    titulo: str
    descripcion: str = ""
    tipo: str
    ciclo: str = ""
    temas: list[str] = Field(default_factory=list, max_length=2)
    sede_id: str = ""
    personas: list[Persona] = Field(default_factory=list)
    libros_presentados: list[str] = Field(default_factory=list)
    editorial: str = ""
    publico: Literal["general", "infancias"] = "general"
    confianza: float
