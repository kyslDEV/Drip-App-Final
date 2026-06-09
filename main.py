"""Aplicacao FastAPI do backend DripTest.

Este arquivo e a camada HTTP: declara endpoints, aplica autenticacao, abre a
conexao transacional com o banco e delega a regra de negocio para
repositories.py.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from psycopg import Connection

from . import database as database_module
from .database import close_pool, get_db, open_pool
from .repositories import (
    create_report_for_lots,
    create_weighing_from_payload,
    ensure_bootstrap_admin,
    ensure_default_plant,
    fetch_all,
    fetch_one,
    finalize_weighing,
    get_lot_by_id,
    get_or_create_client,
    get_or_create_lot,
    get_or_create_user,
    import_snapshot,
    reopen_weighing,
)
from .schemas import (
    ApiStatus,
    AuthLoginRequest,
    AuthLoginResponse,
    LotCreate,
    ReportCreate,
    SyncPushResult,
    SyncSnapshot,
    UserSummary,
    WeighingCreate,
    WeighingFinalize,
)
from .security import create_access_token, require_api_token, require_user_session, verify_password
from .settings import settings


UTC = timezone.utc


def _serialize_user(row: dict[str, Any]) -> UserSummary:
    """Converte uma linha da tabela users para o formato seguro retornado pela API."""
    return UserSummary(
        id=str(row["id"]),
        name=str(row["name"]),
        email=row.get("email"),
        role=str(row["role"]),
        plant_id=str(row["plant_id"]) if row.get("plant_id") else None,
    )


def get_current_user(
    claims: dict[str, Any] = Depends(require_user_session),
    conn: Connection = Depends(get_db),
) -> dict[str, Any]:
    """Carrega o usuario autenticado e bloqueia sessoes de usuarios inativos."""
    row = fetch_one(
        conn,
        """
        select id, plant_id, name, email, role, is_active
        from users
        where id = %s
        limit 1
        """,
        (claims["sub"],),
    )
    if not row or not row.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario invalido.")
    return row


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa recursos globais da API e garante dados minimos de operacao."""
    open_pool()
    assert database_module.pool is not None
    with database_module.pool.connection() as conn:
        with conn.transaction():
            # A planta padrao e o admin inicial permitem operar o backend mesmo
            # antes de uma configuracao completa de setores/usuarios.
            plant_id = ensure_default_plant(conn)
            ensure_bootstrap_admin(
                conn,
                plant_id=plant_id,
                name=settings.bootstrap_admin_name,
                email=settings.bootstrap_admin_email,
                password=settings.bootstrap_admin_password,
            )
    yield
    close_pool()


app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)

# CORS libera o frontend web/offline a chamar a API a partir das origens
# configuradas em DRIP_CORS_ORIGINS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=ApiStatus)
def health(conn: Connection = Depends(get_db)) -> ApiStatus:
    """Verifica se a API esta viva e se o PostgreSQL responde uma consulta simples."""
    fetch_one(conn, "select 1 as ok")
    return ApiStatus(status="ok", app=settings.app_name, database="ok")


@app.post("/auth/login", response_model=AuthLoginResponse)
def auth_login(payload: AuthLoginRequest, conn: Connection = Depends(get_db)) -> AuthLoginResponse:
    """Autentica por email ou nome e retorna uma sessao bearer assinada."""
    row = fetch_one(
        conn,
        """
        select id, plant_id, name, email, role, password_hash, is_active
        from users
        where lower(coalesce(email, '')) = lower(%s)
           or lower(name) = lower(%s)
        order by created_at asc
        limit 1
        """,
        (payload.identifier, payload.identifier),
    )
    # Usuario inexistente, inativo ou senha incorreta sempre retorna a mesma
    # mensagem para nao revelar qual parte da credencial falhou.
    if not row or not row.get("is_active", True) or not verify_password(payload.password, row.get("password_hash")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais invalidas.")

    token, expires_in = create_access_token(row)
    return AuthLoginResponse(
        access_token=token,
        expires_in=expires_in,
        user=_serialize_user(row),
    )


@app.get("/me", response_model=UserSummary)
def me(user: dict[str, Any] = Depends(get_current_user)) -> UserSummary:
    """Retorna o perfil resumido da sessao atual."""
    return _serialize_user(user)


@app.post(
    "/sync/push",
    response_model=SyncPushResult,
    dependencies=[Depends(require_api_token)],
)
def sync_push(snapshot: SyncSnapshot, conn: Connection = Depends(get_db)) -> dict[str, Any]:
    """Importa o snapshot local enviado pelo app offline."""
    return import_snapshot(conn, snapshot.model_dump())


@app.get("/sync/pull", dependencies=[Depends(require_api_token)])
def sync_pull(
    since: str | None = Query(default=None),
    conn: Connection = Depends(get_db),
) -> dict[str, Any]:
    """Entrega um recorte recente do banco para o cliente comparar/sincronizar."""
    params: tuple[Any, ...] = ()
    lot_where = ""
    report_where = ""
    weighing_sql = """
        select v.*, w.lot_id
        from v_weighing_report_data v
        join weighings w on w.id = v.id
        order by initial_weighed_at desc
        limit 1000
    """
    weighing_params: tuple[Any, ...] = ()

    if since:
        # since aceita ISO com Z do frontend e vira filtro updated_at no banco.
        since_value = datetime.fromisoformat(since.replace("Z", "+00:00"))
        params = (since_value,)
        lot_where = "where updated_at >= %s"
        report_where = "where updated_at >= %s"
        weighing_sql = """
            select v.*, w.lot_id
            from v_weighing_report_data v
            join weighings w on w.id = v.id
            where w.updated_at >= %s
            order by v.initial_weighed_at desc
            limit 1000
        """
        weighing_params = (since_value,)

    lots = fetch_all(
        conn,
        f"""
        select id, lot_code, fabrication_date, product_brand, species, status, updated_at
        from production_lots
        {lot_where}
        order by updated_at desc
        limit 500
        """,
        params,
    )
    weighings = fetch_all(conn, weighing_sql, weighing_params)
    reports = fetch_all(
        conn,
        f"""
        select id, lot_id, report_number, status, title, issued_at, updated_at
        from technical_reports
        {report_where}
        order by created_at desc
        limit 200
        """,
        params,
    )

    return {
        "serverTime": datetime.now(UTC).isoformat(),
        "lots": lots,
        "weighings": weighings,
        "reports": reports,
    }


@app.get("/lots", dependencies=[Depends(require_api_token)])
def list_lots(
    limit: int = Query(default=100, ge=1, le=500),
    conn: Connection = Depends(get_db),
) -> list[dict[str, Any]]:
    """Lista lotes ja consolidados pela view de resumo do banco."""
    return fetch_all(
        conn,
        """
        select *
        from v_lot_summary
        order by fabrication_date desc, lot_code asc
        limit %s
        """,
        (limit,),
    )


@app.get("/lots/{lot_id}", dependencies=[Depends(require_api_token)])
def get_lot(lot_id: str, conn: Connection = Depends(get_db)) -> dict[str, Any]:
    """Busca um lote especifico pelo ID exposto pela API."""
    row = get_lot_by_id(conn, lot_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote nao encontrado.")
    return row


@app.post("/lots")
def create_lot(
    payload: LotCreate,
    conn: Connection = Depends(get_db),
    auth: dict[str, Any] = Depends(require_api_token),
) -> dict[str, Any]:
    """Cria ou reutiliza um lote com base nos campos que definem unicidade."""
    plant_id = ensure_default_plant(conn)
    # Chamadas de usuario usam o proprio sub; chamadas de servico criam/acham o
    # monitor pelo nome enviado no payload.
    user_id = auth.get("sub") if auth.get("auth_type") == "user" else get_or_create_user(conn, plant_id, payload.monitor_name)
    lot_id = get_or_create_lot(
        conn,
        plant_id,
        payload.lot_code,
        payload.fabrication_date,
        payload.product_brand,
        payload.species,
        user_id,
        payload.notes,
    )
    row = get_lot_by_id(conn, lot_id)
    assert row is not None
    return row


@app.get("/weighings", dependencies=[Depends(require_api_token)])
def list_weighings(
    lot_id: str | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    conn: Connection = Depends(get_db),
) -> list[dict[str, Any]]:
    """Lista pesagens recentes, opcionalmente filtradas por lote."""
    if lot_id:
        return fetch_all(
            conn,
            """
            select v.*, w.lot_id
            from v_weighing_report_data v
            join weighings w on w.id = v.id
            where w.lot_id = %s
            order by v.initial_weighed_at desc
            limit %s
            """,
            (lot_id, limit),
        )
    return fetch_all(
        conn,
        """
        select v.*, w.lot_id
        from v_weighing_report_data v
        join weighings w on w.id = v.id
        order by v.initial_weighed_at desc
        limit %s
        """,
        (limit,),
    )


@app.post("/weighings")
def create_weighing(
    payload: WeighingCreate,
    conn: Connection = Depends(get_db),
    auth: dict[str, Any] = Depends(require_api_token),
) -> dict[str, Any]:
    """Registra uma pesagem inicial vinda da API, mantendo compatibilidade offline."""
    plant_id = ensure_default_plant(conn)
    user_id = auth.get("sub") if auth.get("auth_type") == "user" else get_or_create_user(conn, plant_id, payload.monitor_name)
    # O app client identifica a origem da pesagem para sincronizacao e auditoria.
    client_id = get_or_create_client(
        conn,
        plant_id,
        user_id,
        {
            "app": "DripTest",
            "schemaVersion": 1,
            "user": {
                "monitorName": payload.monitor_name,
                "lot": payload.lot_code,
                "fabDate": payload.fabrication_date,
            },
        },
    )
    return create_weighing_from_payload(
        conn,
        plant_id,
        payload.model_dump(),
        client_id=client_id,
        user_id=user_id,
    )


@app.patch("/weighings/{weighing_id}/finalize")
def finalize_weighing_endpoint(
    weighing_id: str,
    payload: WeighingFinalize,
    conn: Connection = Depends(get_db),
    auth: dict[str, Any] = Depends(require_api_token),
) -> dict[str, Any]:
    """Finaliza uma pesagem e calcula perda absoluta/percentual."""
    row = finalize_weighing(conn, weighing_id, payload.model_dump(), user_id=auth.get("sub"))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pesagem nao encontrada.")
    return row


@app.patch("/weighings/{weighing_id}/reopen")
def reopen_weighing_endpoint(
    weighing_id: str,
    conn: Connection = Depends(get_db),
    auth: dict[str, Any] = Depends(require_api_token),
) -> dict[str, Any]:
    """Reabre uma pesagem removendo os campos finais para nova finalizacao."""
    row = reopen_weighing(conn, weighing_id, user_id=auth.get("sub"))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pesagem nao encontrada.")
    return row


@app.get("/reports", dependencies=[Depends(require_api_token)])
def list_reports(
    lot_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    conn: Connection = Depends(get_db),
) -> list[dict[str, Any]]:
    """Lista laudos emitidos, com filtro opcional por lote."""
    if lot_id:
        return fetch_all(
            conn,
            """
            select id, lot_id, report_number, status, title, issued_at, created_at, updated_at
            from technical_reports
            where lot_id = %s
            order by created_at desc
            limit %s
            """,
            (lot_id, limit),
        )

    return fetch_all(
        conn,
        """
        select id, lot_id, report_number, status, title, issued_at, created_at, updated_at
        from technical_reports
        order by created_at desc
        limit %s
        """,
        (limit,),
    )


@app.post("/reports")
def create_report(
    payload: ReportCreate,
    conn: Connection = Depends(get_db),
    auth: dict[str, Any] = Depends(require_api_token),
) -> dict[str, Any]:
    """Emite laudo tecnico consolidando um ou mais lotes."""
    target_lot_ids = []
    if payload.lot_id:
        target_lot_ids.append(payload.lot_id)
    target_lot_ids.extend(payload.lot_ids)
    # Remove vazios e duplicidades implicitas antes de chamar o repositorio.
    target_lot_ids = [str(lot_id).strip() for lot_id in target_lot_ids if str(lot_id).strip()]
    if not target_lot_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe ao menos um lote para emissao do laudo.")

    row = create_report_for_lots(
        conn,
        target_lot_ids,
        user_id=auth.get("sub"),
        title=payload.title,
        objective=payload.objective,
        method=payload.method,
        conclusion=payload.conclusion,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nao foi possivel emitir o laudo.")
    return row


@app.get("/reports/{report_id}", dependencies=[Depends(require_api_token)])
def get_report(report_id: str, conn: Connection = Depends(get_db)) -> dict[str, Any]:
    """Busca o registro bruto do laudo salvo em technical_reports."""
    row = fetch_one(conn, "select * from technical_reports where id = %s", (report_id,))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laudo nao encontrado.")
    return row
