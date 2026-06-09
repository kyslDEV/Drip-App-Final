"""Contratos de entrada e saida da API.

Os modelos Pydantic definem o formato esperado nos endpoints FastAPI. Eles
servem como validacao automatica, documentacao OpenAPI e protecao para que a
camada de repositorio receba campos previsiveis.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ApiStatus(BaseModel):
    """Resposta simples do /health indicando API e banco disponiveis."""

    status: str
    app: str
    database: str


class SyncSnapshot(BaseModel):
    """Pacote enviado pelo app offline com usuario, dados locais e laudo."""

    app: str = "DripTest"
    schemaVersion: int = 1
    generatedAt: str | None = None
    # user/store/report ficam flexiveis porque o frontend offline evolui em
    # etapas e a normalizacao detalhada acontece em repositories.py.
    user: dict[str, Any] = Field(default_factory=dict)
    store: dict[str, Any] = Field(default_factory=dict)
    report: dict[str, Any] = Field(default_factory=dict)


class SyncPushResult(BaseModel):
    """Resumo do resultado da importacao de um snapshot offline."""

    ok: bool
    syncBatchId: str
    imported: dict[str, int]
    conflicts: list[dict[str, Any]]


class AuthLoginRequest(BaseModel):
    """Credenciais informadas no login."""

    identifier: str
    password: str


class UserSummary(BaseModel):
    """Dados seguros do usuario retornados para o frontend."""

    id: str
    name: str
    email: str | None = None
    role: str
    plant_id: str | None = None


class AuthLoginResponse(BaseModel):
    """Resposta de login com token bearer e perfil resumido."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserSummary


class LotCreate(BaseModel):
    """Campos necessarios para criar ou localizar um lote de producao."""

    lot_code: str
    fabrication_date: str
    product_brand: str
    species: str
    monitor_name: str | None = None
    notes: str | None = None


class WeighingCreate(BaseModel):
    """Registro de pesagem inicial recebido da tela/API."""

    lot_code: str
    fabrication_date: str
    product_brand: str
    species: str
    monitor_name: str | None = None
    shift: str | None = None
    # client_record_id preserva o ID criado no app offline para permitir upsert.
    client_record_id: str | None = None
    sample_number: int | None = None
    initial_gross_g: int
    # A embalagem padrao do fluxo DripTest e 0,006 kg, equivalente a 6 g.
    initial_package_kg: float = 0.006
    initial_package_g: int = 6
    initial_net_g: int
    time_min: int | None = None
    time_interpolated: bool = False
    initial_weighed_at: str | None = None
    notes: str | None = None


class WeighingFinalize(BaseModel):
    """Campos da pesagem final usados para calcular perda e concluir amostra."""

    final_net_g: int
    final_gross_g: int | None = None
    final_package_kg: float | None = None
    final_package_g: int | None = None
    final_weighed_at: str | None = None
    notes: str | None = None


class ReportCreate(BaseModel):
    """Solicitacao de emissao de laudo para um ou mais lotes."""

    lot_id: str | None = None
    # lot_ids permite emitir laudo consolidado; lot_id e mantido para chamada simples.
    lot_ids: list[str] = Field(default_factory=list)
    title: str | None = None
    objective: str | None = None
    method: str | None = None
    conclusion: str | None = None
