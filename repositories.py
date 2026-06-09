"""Persistencia e regras de negocio do DripTest.

Este modulo concentra a traducao entre o formato usado pelo frontend offline e
as tabelas PostgreSQL. Aqui ficam normalizacao de lote/produto, criacao ou
atualizacao idempotente de registros, calculos de perda/absorcao, emissao de
laudos e trilha de auditoria.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from hashlib import sha256
from typing import Any
from unicodedata import normalize as unicode_normalize
from uuid import UUID, uuid4

from psycopg import Connection
from psycopg.types.json import Json

from .security import hash_password


DEFAULT_PLANT_CODE = "DEFAULT"
UTC = timezone.utc


def json_ready(value: Any) -> Any:
    """Converte valores de banco/Python para estruturas serializaveis em JSON."""
    if isinstance(value, dict):
        return {str(key): json_ready(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_ready(item) for item in value]
    if isinstance(value, tuple):
        return [json_ready(item) for item in value]
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return value


def canonical_json_dumps(value: Any) -> str:
    """Gera JSON deterministico para hash, sem depender da ordem original das chaves."""
    return json.dumps(json_ready(value), ensure_ascii=True, sort_keys=True, separators=(",", ":"))


def normalize_product_brand(value: Any, species: Any = "") -> str:
    """Padroniza marca/produto para evitar lotes duplicados por grafia diferente."""
    raw = str(value or "").strip()
    species_text = str(species or "").strip()
    source = raw or species_text
    # Remove acentos e caixa para comparar entradas como "Friato", "frango friato"
    # e "Ave Friato" como o mesmo produto.
    normalized = unicode_normalize("NFD", source.lower()).encode("ascii", "ignore").decode("ascii")

    if normalized in {"frango friato", "friato", "ave friato"}:
        return "Ave Friato"
    if normalized in {"frango nutriza", "nutriza", "ave nutriza"}:
        return "Ave Nutriza"
    return source or "Nao informado"


def parse_date(value: Any) -> date:
    """Aceita date ou texto ISO e retorna apenas a data de fabricacao."""
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    text = str(value or "").strip()
    if not text:
        return datetime.now(UTC).date()
    return date.fromisoformat(text[:10])


def parse_datetime(value: Any) -> datetime:
    """Normaliza data/hora de strings ISO, timestamps ou datetime para UTC."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, (int, float)):
        raw = float(value)
        # Valores grandes normalmente chegam em milissegundos do JavaScript.
        if raw > 10_000_000_000:
            raw = raw / 1000
        return datetime.fromtimestamp(raw, UTC)
    text = str(value or "").strip()
    if not text:
        return datetime.now(UTC)
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def to_int(value: Any, default: int = 0) -> int:
    """Converte entradas numericas flexiveis para inteiro, com fallback seguro."""
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return default


def to_float(value: Any, default: float | None = None) -> float | None:
    """Converte entradas numericas flexiveis para float, preservando None quando invalido."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def truncate_number(value: Any, decimal_places: int = 2) -> float | None:
    """Trunca casas decimais para campos que precisam repetir regra do relatorio."""
    numeric_value = to_float(value)
    if numeric_value is None:
        return None
    factor = 10**decimal_places
    return int(numeric_value * factor) / factor


def fetch_all(conn: Connection, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    """Executa uma consulta e retorna todas as linhas como dict."""
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def fetch_one(conn: Connection, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    """Executa uma consulta e retorna uma linha ou None."""
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def log_audit(
    conn: Connection,
    *,
    plant_id: str | None,
    user_id: str | None,
    client_id: str | None = None,
    entity_name: str,
    entity_id: str | None,
    action: str,
    old_data: dict[str, Any] | None = None,
    new_data: dict[str, Any] | None = None,
) -> None:
    """Registra mudancas relevantes para rastreabilidade operacional."""
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into audit_logs (
              plant_id, user_id, client_id, entity_name, entity_id, action, old_data, new_data
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                plant_id,
                user_id,
                client_id,
                entity_name,
                entity_id,
                action,
                Json(json_ready(old_data)) if old_data is not None else None,
                Json(json_ready(new_data)) if new_data is not None else None,
            ),
        )


def ensure_default_plant(conn: Connection) -> str:
    """Garante uma planta padrao para fluxos que ainda nao escolhem setor explicitamente."""
    row = fetch_one(
        conn,
        """
        insert into plants (name, code)
        values ('Planta padrao', %s)
        on conflict (code) do update set name = excluded.name
        returning id
        """,
        (DEFAULT_PLANT_CODE,),
    )
    assert row is not None
    return str(row["id"])


def ensure_bootstrap_admin(
    conn: Connection,
    *,
    plant_id: str,
    name: str,
    email: str,
    password: str,
) -> str | None:
    """Cria ou atualiza o administrador inicial configurado por variaveis de ambiente."""
    normalized_email = str(email or "").strip().lower()
    raw_password = str(password or "").strip()
    if not normalized_email or not raw_password:
        return None

    row = fetch_one(
        conn,
        "select id, password_hash from users where lower(email) = lower(%s) limit 1",
        (normalized_email,),
    )
    password_hash = hash_password(raw_password)

    if row:
        # Atualiza o admin existente para refletir a configuracao atual de startup.
        with conn.cursor() as cur:
            cur.execute(
                """
                update users
                set plant_id = %s,
                    name = %s,
                    role = 'admin',
                    password_hash = %s,
                    is_active = true
                where id = %s
                """,
                (plant_id, name, password_hash, row["id"]),
            )
        return str(row["id"])

    created = fetch_one(
        conn,
        """
        insert into users (plant_id, name, email, role, password_hash, is_active)
        values (%s, %s, %s, 'admin', %s, true)
        returning id
        """,
        (plant_id, name, normalized_email, password_hash),
    )
    return str(created["id"]) if created else None


def get_or_create_user(conn: Connection, plant_id: str, monitor_name: str | None) -> str | None:
    """Localiza ou cria um usuario monitor pela planta e nome informado no app."""
    name = str(monitor_name or "").strip()
    if not name:
        return None

    existing = fetch_one(
        conn,
        """
        select id from users
        where plant_id = %s and lower(name) = lower(%s) and role = 'monitor'
        order by created_at asc
        limit 1
        """,
        (plant_id, name),
    )
    if existing:
        return str(existing["id"])

    row = fetch_one(
        conn,
        """
        insert into users (plant_id, name, role)
        values (%s, %s, 'monitor')
        returning id
        """,
        (plant_id, name),
    )
    return str(row["id"]) if row else None


def get_or_create_client(
    conn: Connection,
    plant_id: str,
    user_id: str | None,
    snapshot: dict[str, Any],
) -> str:
    """Identifica o cliente/app que enviou dados offline para permitir sincronizacao."""
    user = snapshot.get("user") or {}
    # Quando o frontend nao manda clientKey, gera uma chave estavel a partir dos
    # principais dados de contexto para evitar criar varios clientes iguais.
    seed = "|".join(
        [
            str(snapshot.get("app") or "DripTest"),
            str(user.get("monitorName") or user.get("monitor") or ""),
            str(user.get("lot") or ""),
            str(user.get("fabDate") or ""),
        ]
    )
    client_key = str(snapshot.get("clientKey") or f"web-{sha256(seed.encode()).hexdigest()[:24]}")

    row = fetch_one(
        conn,
        """
        insert into app_clients (plant_id, user_id, client_key, platform, app_version, last_seen_at)
        values (%s, %s, %s, %s, %s, now())
        on conflict (client_key) do update set
          plant_id = excluded.plant_id,
          user_id = excluded.user_id,
          last_seen_at = now()
        returning id
        """,
        (plant_id, user_id, client_key, "web", str(snapshot.get("schemaVersion") or "1")),
    )
    assert row is not None
    return str(row["id"])


def get_or_create_lot(
    conn: Connection,
    plant_id: str,
    lot_code: Any,
    fabrication_date: Any,
    product_brand: Any,
    species: Any,
    created_by: str | None,
    notes: str | None = None,
) -> str:
    """Cria ou reutiliza lote pela chave natural: planta, codigo, data, marca e especie."""
    brand = normalize_product_brand(product_brand, species)
    species_text = str(species or "Outra").strip() or "Outra"
    row = fetch_one(
        conn,
        """
        insert into production_lots (
          plant_id, lot_code, fabrication_date, product_brand, species, created_by, notes
        )
        values (%s, %s, %s, %s, %s, %s, %s)
        on conflict (plant_id, lot_code, fabrication_date, product_brand, species) do update set
          notes = coalesce(excluded.notes, production_lots.notes)
        returning id
        """,
        (
            plant_id,
            str(lot_code or "Sem lote").strip() or "Sem lote",
            parse_date(fabrication_date),
            brand,
            species_text,
            created_by,
            notes,
        ),
    )
    assert row is not None
    return str(row["id"])


def get_lot_by_id(conn: Connection, lot_id: str) -> dict[str, Any] | None:
    """Busca lote pela view de resumo usada pelas telas e endpoints."""
    return fetch_one(
        conn,
        """
        select *
        from v_lot_summary
        where lot_id = %s
        limit 1
        """,
        (lot_id,),
    )


def upsert_weighing(
    conn: Connection,
    plant_id: str,
    client_id: str,
    record: dict[str, Any],
    fallback_user: dict[str, Any],
) -> str:
    """Insere ou atualiza uma pesagem enviada pelo app offline ou pela API."""
    species = str(record.get("species") or "Outra").strip() or "Outra"
    brand = normalize_product_brand(record.get("productBrand"), species)
    monitor_name = str(record.get("monitor") or fallback_user.get("monitorName") or "").strip()
    monitor_id = get_or_create_user(conn, plant_id, monitor_name)
    lot_id = get_or_create_lot(
        conn,
        plant_id,
        record.get("lote") or fallback_user.get("lot"),
        record.get("fabDate") or fallback_user.get("fabDate"),
        brand,
        species,
        monitor_id,
    )

    initial_gross = to_int(record.get("gross"))
    # O peso liquido inicial deve descontar embalagem; se o cliente ja mandou
    # net, preserva, senao calcula pelo peso bruto e embalagem.
    package_kg = to_float(record.get("packKg"), 0.006) or 0.006
    package_g = to_int(record.get("packGrams"), round(package_kg * 1000))
    initial_net = to_int(record.get("net"), max(0, initial_gross - package_g))
    final_net = record.get("finalNet")
    status = "final" if final_net is not None or str(record.get("status", "")).lower() == "final" else "initial"
    final_package_kg = to_float(record.get("finalPackKg"))
    final_package_g = record.get("finalPackGrams")
    # Frontend pode mandar embalagem final em kg ou g; o banco guarda as duas.
    if final_package_g is None and final_package_kg is not None:
        final_package_g = round(final_package_kg * 1000)
    production_shift = str(record.get("shift") or record.get("turno") or "").strip()
    notes = str(record.get("note") or record.get("notes") or "").strip()
    # Turno entra em notes para manter compatibilidade com telas antigas que nao
    # tinham coluna propria para shift.
    if production_shift and "turno:" not in notes.lower():
        notes = f"Turno: {production_shift}" + (f" | {notes}" if notes else "")

    row = fetch_one(
        conn,
        """
        insert into weighings (
          client_record_id, client_id, sync_status, source_app, lot_id, monitor_id,
          monitor_name_snapshot, sample_number, species, product_brand, status,
          initial_gross_g, initial_package_kg, initial_package_g, initial_net_g,
          time_min, time_interpolated, initial_weighed_at,
          final_gross_g, final_package_kg, final_package_g, final_net_g,
          loss_abs_g, loss_pct, final_weighed_at, notes
        )
        values (
          %s, %s, 'synced', 'web', %s, %s,
          %s, %s, %s, %s, %s,
          %s, %s, %s, %s,
          %s, %s, %s,
          %s, %s, %s, %s,
          %s, %s, %s, %s
        )
        on conflict (client_record_id) do update set
          -- Upsert por client_record_id torna a sincronizacao idempotente:
          -- reenviar o mesmo registro atualiza o banco em vez de duplicar amostra.
          client_id = excluded.client_id,
          sync_status = 'synced',
          lot_id = excluded.lot_id,
          monitor_id = excluded.monitor_id,
          monitor_name_snapshot = excluded.monitor_name_snapshot,
          species = excluded.species,
          product_brand = excluded.product_brand,
          status = excluded.status,
          initial_gross_g = excluded.initial_gross_g,
          initial_package_kg = excluded.initial_package_kg,
          initial_package_g = excluded.initial_package_g,
          initial_net_g = excluded.initial_net_g,
          time_min = excluded.time_min,
          time_interpolated = excluded.time_interpolated,
          initial_weighed_at = excluded.initial_weighed_at,
          final_gross_g = excluded.final_gross_g,
          final_package_kg = excluded.final_package_kg,
          final_package_g = excluded.final_package_g,
          final_net_g = excluded.final_net_g,
          loss_abs_g = excluded.loss_abs_g,
          loss_pct = excluded.loss_pct,
          final_weighed_at = excluded.final_weighed_at,
          notes = excluded.notes
        returning id
        """,
        (
            str(record.get("id") or uuid4()),
            client_id,
            lot_id,
            monitor_id,
            monitor_name or None,
            record.get("sampleNumber"),
            species,
            brand,
            status,
            initial_gross,
            package_kg,
            package_g,
            initial_net,
            record.get("timeMin"),
            bool(record.get("interpolated")),
            parse_datetime(record.get("createdAt")),
            record.get("finalGross"),
            final_package_kg,
            final_package_g,
            final_net,
            record.get("lossAbs"),
            record.get("lossPct"),
            parse_datetime(record.get("finalAt")) if record.get("finalAt") else None,
            notes,
        ),
    )
    assert row is not None
    return str(row["id"])


def upsert_absorption_test(
    conn: Connection,
    plant_id: str,
    client_id: str,
    test: dict[str, Any],
    fallback_user: dict[str, Any],
) -> str:
    """Insere ou atualiza teste de absorcao complementar ao laudo."""
    species = str(test.get("species") or "Outra").strip() or "Outra"
    brand = normalize_product_brand(test.get("productBrand"), species)
    monitor_id = get_or_create_user(conn, plant_id, fallback_user.get("monitorName"))
    lot_id = get_or_create_lot(
        conn,
        plant_id,
        test.get("lote") or fallback_user.get("lot"),
        fallback_user.get("fabDate"),
        brand,
        species,
        monitor_id,
    )

    weighing_id = None
    record_id = test.get("recordId")
    if record_id:
        # Vincula o teste a pesagem original quando o app offline preservou o ID.
        row = fetch_one(conn, "select id from weighings where client_record_id = %s", (str(record_id),))
        weighing_id = str(row["id"]) if row else None

    row = fetch_one(
        conn,
        """
        insert into absorption_tests (
          client_record_id, client_id, lot_id, weighing_id, monitor_id, species, product_brand,
          base_type, initial_weight_g, final_weight_g, dry_weight_g,
          absorption_g, absorption_pct, note, tested_at
        )
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        on conflict (client_record_id) do update set
          lot_id = excluded.lot_id,
          weighing_id = excluded.weighing_id,
          monitor_id = excluded.monitor_id,
          species = excluded.species,
          product_brand = excluded.product_brand,
          base_type = excluded.base_type,
          initial_weight_g = excluded.initial_weight_g,
          final_weight_g = excluded.final_weight_g,
          dry_weight_g = excluded.dry_weight_g,
          absorption_g = excluded.absorption_g,
          absorption_pct = excluded.absorption_pct,
          note = excluded.note,
          tested_at = excluded.tested_at
        returning id
        """,
        (
            str(test.get("id") or uuid4()),
            client_id,
            lot_id,
            weighing_id,
            monitor_id,
            species,
            brand,
            "dry" if test.get("baseType") == "dry" else "initial",
            to_float(test.get("initialWeight"), 0) or 0,
            to_float(test.get("finalWeight"), 0) or 0,
            to_float(test.get("dryWeight")),
            to_float(test.get("absorption"), 0) or 0,
            to_float(test.get("absorptionPercent")),
            str(test.get("note") or ""),
            parse_datetime(test.get("createdAt")),
        ),
    )
    assert row is not None
    return str(row["id"])


def calculate_gross_absorption_pct(initial_gross_g: Any, final_gross_g: Any) -> float | None:
    """Calcula absorcao/perda bruta percentual usando peso bruto inicial e final."""
    initial_gross = to_float(initial_gross_g)
    final_gross = to_float(final_gross_g)
    if not initial_gross or initial_gross <= 0 or final_gross is None:
        return None
    return ((initial_gross - final_gross) * 100.0) / initial_gross


def classify_market_by_percent(percent: Any) -> dict[str, Any]:
    """Classifica o indicador de mercado conforme faixas tecnicas do DripTest."""
    value = to_float(percent)
    if value is None:
        return {"indicator": None, "warning": False}
    if value >= 8:
        return {"indicator": "Alterado (Mercado Interno)", "warning": True}
    if value >= 6:
        return {"indicator": "Mercado Interno", "warning": False}
    if value >= 5.1:
        return {"indicator": "Uniao Europeia (Sugerir exportacao)", "warning": False}
    if value >= 4:
        return {"indicator": "Russia (Sugerir exportacao)", "warning": False}
    return {"indicator": "Normal", "warning": False}


def fetch_weighing_report_row(conn: Connection, weighing_id: str) -> dict[str, Any] | None:
    """Retorna uma pesagem no formato enriquecido da view usada pelo relatorio."""
    return fetch_one(
        conn,
        """
        select v.*, l.id as lot_id, l.plant_id
        from v_weighing_report_data v
        join weighings w on w.id = v.id
        join production_lots l on l.id = w.lot_id
        where v.id = %s
        limit 1
        """,
        (weighing_id,),
    )


def create_weighing_from_payload(
    conn: Connection,
    plant_id: str,
    payload: dict[str, Any],
    *,
    client_id: str,
    user_id: str | None,
) -> dict[str, Any]:
    """Cria pesagem pela API publica convertendo payload Pydantic para formato offline."""
    monitor_name = payload.get("monitor_name")
    if monitor_name and not user_id:
        user_id = get_or_create_user(conn, plant_id, monitor_name)

    lot_id = get_or_create_lot(
        conn,
        plant_id,
        payload["lot_code"],
        payload["fabrication_date"],
        payload["product_brand"],
        payload["species"],
        user_id,
        payload.get("notes"),
    )
    lot = fetch_one(conn, "select plant_id from production_lots where id = %s", (lot_id,))
    lot_plant_id = str(lot["plant_id"]) if lot and lot.get("plant_id") else plant_id

    # Reusa upsert_weighing para que a API e o sync offline sigam a mesma regra
    # de persistencia e nao criem divergencia de calculo/normalizacao.
    record = {
        "id": payload.get("client_record_id") or str(uuid4()),
        "species": payload["species"],
        "productBrand": payload["product_brand"],
        "lote": payload["lot_code"],
        "monitor": monitor_name,
        "shift": payload.get("shift"),
        "turno": payload.get("shift"),
        "fabDate": payload["fabrication_date"],
        "gross": payload["initial_gross_g"],
        "packKg": payload["initial_package_kg"],
        "packGrams": payload["initial_package_g"],
        "net": payload["initial_net_g"],
        "timeMin": payload.get("time_min"),
        "interpolated": bool(payload.get("time_interpolated")),
        "createdAt": payload.get("initial_weighed_at") or datetime.now(UTC).isoformat(),
        "sampleNumber": payload.get("sample_number"),
        "notes": payload.get("notes"),
    }
    weighing_id = upsert_weighing(
        conn,
        lot_plant_id,
        client_id,
        record,
        {"monitorName": monitor_name, "lot": payload["lot_code"], "fabDate": payload["fabrication_date"]},
    )

    row = fetch_weighing_report_row(conn, weighing_id)
    assert row is not None
    log_audit(
        conn,
        plant_id=lot_plant_id,
        user_id=user_id,
        client_id=client_id,
        entity_name="weighing",
        entity_id=weighing_id,
        action="create",
        new_data=row,
    )
    return row


def finalize_weighing(
    conn: Connection,
    weighing_id: str,
    payload: dict[str, Any],
    *,
    user_id: str | None,
) -> dict[str, Any] | None:
    """Marca uma amostra como finalizada e calcula perda liquida."""
    current = fetch_one(conn, "select * from weighings where id = %s", (weighing_id,))
    if not current:
        return None

    final_net = to_int(payload["final_net_g"])
    final_package_g = payload.get("final_package_g")
    # A embalagem final pode vir em gramas, em kg ou ser herdada da embalagem inicial.
    if final_package_g is None and payload.get("final_package_kg") is not None:
        final_package_g = round(float(payload["final_package_kg"]) * 1000)
    if final_package_g is None:
        final_package_g = current.get("final_package_g") or current.get("initial_package_g") or 0
    final_package_kg = payload.get("final_package_kg")
    if final_package_kg is None and final_package_g is not None:
        final_package_kg = float(final_package_g) / 1000
    final_gross = payload.get("final_gross_g")
    if final_gross is None:
        final_gross = final_net + to_int(final_package_g)

    # Regra de perda liquida: peso liquido inicial menos peso liquido final.
    loss_abs = to_int(current.get("initial_net_g")) - final_net
    loss_pct = None
    initial_net = to_int(current.get("initial_net_g"))
    if initial_net > 0:
        loss_pct = round((loss_abs * 100.0) / initial_net, 2)

    final_weighed_at = parse_datetime(payload.get("final_weighed_at"))
    notes = payload.get("notes")

    with conn.cursor() as cur:
        cur.execute(
            """
            update weighings
            set status = 'final',
                final_gross_g = %s,
                final_package_kg = %s,
                final_package_g = %s,
                final_net_g = %s,
                loss_abs_g = %s,
                loss_pct = %s,
                final_weighed_at = %s,
                notes = coalesce(%s, notes)
            where id = %s
            """,
            (
                final_gross,
                final_package_kg,
                final_package_g,
                final_net,
                loss_abs,
                loss_pct,
                final_weighed_at,
                notes,
                weighing_id,
            ),
        )

    updated = fetch_weighing_report_row(conn, weighing_id)
    assert updated is not None
    log_audit(
        conn,
        plant_id=str(updated.get("plant_id")) if updated.get("plant_id") else None,
        user_id=user_id,
        entity_name="weighing",
        entity_id=weighing_id,
        action="finalize",
        old_data=current,
        new_data=updated,
    )
    return updated


def reopen_weighing(conn: Connection, weighing_id: str, *, user_id: str | None) -> dict[str, Any] | None:
    """Remove dados finais para permitir corrigir uma amostra ja finalizada."""
    current = fetch_one(conn, "select * from weighings where id = %s", (weighing_id,))
    if not current:
        return None

    with conn.cursor() as cur:
        cur.execute(
            """
            update weighings
            set status = 'reopened',
                final_gross_g = null,
                final_package_kg = null,
                final_package_g = null,
                final_net_g = null,
                loss_abs_g = null,
                loss_pct = null,
                final_weighed_at = null
            where id = %s
            """,
            (weighing_id,),
        )

    updated = fetch_weighing_report_row(conn, weighing_id)
    assert updated is not None
    log_audit(
        conn,
        plant_id=str(updated.get("plant_id")) if updated.get("plant_id") else None,
        user_id=user_id,
        entity_name="weighing",
        entity_id=weighing_id,
        action="reopen",
        old_data=current,
        new_data=updated,
    )
    return updated


def build_report_conclusion(report: dict[str, Any]) -> str:
    """Gera conclusao padrao conforme completude das pesagens do laudo."""
    totals = report.get("totals") or {}
    if not to_int(totals.get("initialRecords")):
        return "Sem registros de pesagem para emissao de conclusao tecnica."
    if not to_int(totals.get("finalizedRecords")):
        return "Laudo parcial: ha pesagens iniciais registradas, mas ainda nao existem pesagens finais para conclusao de perda/absorcao."
    if to_int(totals.get("pendingRecords")) > 0:
        return "Laudo parcial: existem pesagens finais registradas, mas ainda ha amostras pendentes de finalizacao."
    return "Laudo concluido: todas as amostras registradas possuem pesagem final e indicadores consolidados de perda/absorcao."


def build_report_identity(report: dict[str, Any]) -> tuple[dict[str, Any], str, str, str]:
    """Normaliza o laudo e cria hash/numero tecnico reproduzivel."""
    normalized_report = json_ready(report)
    payload = canonical_json_dumps(normalized_report)
    report_hash = sha256(payload.encode("utf-8")).hexdigest()
    generated_at = normalized_report.get("generatedAt")
    generated_dt = parse_datetime(generated_at) if generated_at else datetime.now(UTC)
    report_number = f"DRIP-{generated_dt.strftime('%Y%m%d')}-{report_hash[:8].upper()}"
    return normalized_report, payload, report_hash, report_number


def _build_report_snapshot_for_lot_ids(
    conn: Connection,
    lot_ids: list[str],
    *,
    title: str | None = None,
    objective: str | None = None,
    method: str | None = None,
    conclusion: str | None = None,
) -> dict[str, Any] | None:
    """Monta o JSON completo do laudo para um conjunto de lotes."""
    unique_lot_ids = []
    for lot_id in lot_ids:
        lot_text = str(lot_id or "").strip()
        if lot_text and lot_text not in unique_lot_ids:
            unique_lot_ids.append(lot_text)

    if not unique_lot_ids:
        return None

    # Primeiro carrega dados mestres dos lotes, depois pesagens e testes que
    # compoem os indicadores do relatorio.
    lots = fetch_all(
        conn,
        """
        select l.*, p.name as plant_name
        from production_lots l
        left join plants p on p.id = l.plant_id
        where l.id = any(%s)
        order by l.fabrication_date asc, l.lot_code asc, l.product_brand asc, l.species asc
        """,
        (unique_lot_ids,),
    )
    if not lots:
        return None

    weighings = fetch_all(
        conn,
        """
        select v.*, l.id as lot_id, l.plant_id, p.name as plant_name
        from v_weighing_report_data v
        join weighings w on w.id = v.id
        join production_lots l on l.id = w.lot_id
        left join plants p on p.id = l.plant_id
        where l.id = any(%s)
        order by l.fabrication_date asc, l.lot_code asc, v.initial_weighed_at asc
        """,
        (unique_lot_ids,),
    )
    tests = fetch_all(
        conn,
        """
        select id, client_record_id, lot_id, weighing_id, species, product_brand, base_type,
               initial_weight_g, final_weight_g, dry_weight_g, absorption_g, absorption_pct,
               note, tested_at
        from absorption_tests
        where lot_id = any(%s)
        order by tested_at desc
        """,
        (unique_lot_ids,),
    )

    finalized = [row for row in weighings if row.get("final_net_g") is not None or str(row.get("status")) == "final"]
    # Media bruta usa a regra operacional atual: soma das amostras finalizadas
    # dividida por 6, mantendo precisao interna para exibicao posterior.
    gross_abs_values = [calculate_gross_absorption_pct(row.get("initial_gross_g"), row.get("final_gross_g")) for row in finalized]
    gross_abs_values = [value for value in gross_abs_values if value is not None]
    lot_gross_avg = sum(gross_abs_values) / 6 if gross_abs_values else None
    lot_market = classify_market_by_percent(lot_gross_avg)
    unique_lot_codes = sorted({str(lot.get("lot_code") or "").strip() for lot in lots if lot.get("lot_code")})
    unique_fabrication_dates = sorted({str(lot.get("fabrication_date")) for lot in lots if lot.get("fabrication_date")})
    unique_plants = sorted({str(lot.get("plant_name") or "").strip() for lot in lots if lot.get("plant_name")})

    total_time = sum(to_int(row.get("time_min")) for row in weighings)
    total_gross = sum(to_int(row.get("initial_gross_g")) for row in weighings)
    total_initial_net = sum(to_int(row.get("initial_net_g")) for row in weighings)
    total_final_net = sum(to_int(row.get("final_net_g")) for row in finalized)
    total_loss_abs = sum(to_int(row.get("loss_abs_g")) for row in finalized)
    # average_loss_pct tambem segue a base operacional de seis amostras.
    average_loss_pct = truncate_number(
        sum(to_float(row.get("loss_pct"), 0) or 0 for row in finalized) / 6,
        2,
    ) if finalized else None

    report = {
        # O formato do snapshot espelha o store do frontend para facilitar
        # exibicao, compartilhamento e sincronizacao sem conversoes extras.
        "generatedAt": datetime.now(UTC).isoformat(),
        "laudo": {
            "title": title or "Laudo tecnico de analise de gotejamento",
            "objective": objective or "Registrar e consolidar pesagens iniciais e finais para avaliacao de perda/absorcao no processo DripTest.",
            "method": method or "Pesagem inicial do produto, calculo do peso liquido descontando embalagem, determinacao do tempo previsto pelo peso bruto, acompanhamento do cronograma e registro da pesagem final.",
            "traceability": {
                "lots": unique_lot_codes,
                "lotIds": unique_lot_ids,
                "monitors": sorted({str(row.get("monitor_name") or "").strip() for row in weighings if row.get("monitor_name")}),
                "plants": unique_plants,
                "species": sorted({str(row.get("species") or "").strip() for row in weighings if row.get("species")}),
                "brands": sorted({str(row.get("product_brand") or "").strip() for row in weighings if row.get("product_brand")}),
                "fabricationDates": unique_fabrication_dates,
            },
        },
        "metadata": {
            "storeVersion": 2,
            "updatedAt": datetime.now(UTC).isoformat(),
            "officialSource": "backend",
            "lotIds": unique_lot_ids,
            "firstCreatedAt": weighings[0]["initial_weighed_at"] if weighings else None,
            "lastCreatedAt": weighings[-1]["initial_weighed_at"] if weighings else None,
            "firstFinalAt": finalized[0]["final_weighed_at"] if finalized else None,
            "lastFinalAt": finalized[-1]["final_weighed_at"] if finalized else None,
        },
        "totals": {
            "initialRecords": len(weighings),
            "finalizedRecords": len(finalized),
            "pendingRecords": len(weighings) - len(finalized),
            "marketWarnings": 1 if lot_market["warning"] else 0,
            "absorptionTests": len(tests),
            "lots": len(unique_lot_codes),
            "monitors": len({row.get("monitor_name") for row in weighings if row.get("monitor_name")}),
            "plants": len(unique_plants),
            "species": len({row.get("species") for row in weighings if row.get("species")}),
            "brands": len({row.get("product_brand") for row in weighings if row.get("product_brand")}),
            "totalTimeMin": total_time,
            "totalGross": total_gross,
            "totalNetInitial": total_initial_net,
            "totalFinalNet": total_final_net,
            "totalLossAbs": total_loss_abs,
            "averageTimeMin": round(total_time / len(weighings), 2) if weighings else None,
            "averageFlowMinutes": None,
            "averageLossPct": average_loss_pct,
            "averageAbsorption": round(sum(to_float(test.get("absorption_g"), 0) or 0 for test in tests) / len(tests), 2) if tests else None,
            "averageAbsorptionPercent": round(sum(to_float(test.get("absorption_pct"), 0) or 0 for test in tests) / len(tests), 2) if tests else None,
            "interpolatedRecords": len([row for row in weighings if row.get("time_interpolated")]),
            "recordsWithoutTime": len([row for row in weighings if row.get("time_min") is None]),
        },
        "groups": {
            "bySpecies": [],
            "byBrand": [],
            "byLot": [],
            "byMonitor": [],
            "byPlant": [],
        },
        "lotSummaries": [
            {
                "key": lot_code,
                "records": len([row for row in finalized if str(row.get("lot_code") or "").strip() == lot_code]),
                "averageGrossAbsPct": round(
                    sum(
                        value
                        for value in [
                            calculate_gross_absorption_pct(row.get("initial_gross_g"), row.get("final_gross_g"))
                            for row in finalized
                            if str(row.get("lot_code") or "").strip() == lot_code
                        ]
                        if value is not None
                    ) / 6,
                    6,
                ) if any(str(row.get("lot_code") or "").strip() == lot_code for row in finalized) else None,
                "averageGrossAbsPctDisplay": None,
                "marketIndicator": None,
                "marketWarning": False,
            }
            for lot_code in unique_lot_codes
        ],
        "initialRecords": [
            {
                "dbId": str(row["id"]),
                "id": row["client_record_id"] or str(row["id"]),
                "lotId": str(row["lot_id"]),
                "species": row["species"],
                "productBrand": row["product_brand"],
                "lote": row["lot_code"],
                "monitor": row["monitor_name"],
                "plantName": row.get("plant_name"),
                "fabDate": str(row["fabrication_date"]),
                "gross": row["initial_gross_g"],
                "packGrams": row["initial_package_g"],
                "net": row["initial_net_g"],
                "timeMin": row["time_min"],
                "interpolated": row["time_interpolated"],
                "status": row["status"],
                "createdAt": row["initial_weighed_at"],
                "finalGross": row["final_gross_g"],
                "finalPackGrams": row["final_package_g"],
                "finalNet": row["final_net_g"],
                "lossAbs": row["loss_abs_g"],
                "lossPct": row["loss_pct"],
                "finalAt": row["final_weighed_at"],
            }
            for row in weighings
        ],
        "finalizedRecords": [
            {
                "dbId": str(row["id"]),
                "id": row["id"],
                "lotId": str(row["lot_id"]),
                "lotGrossAbsPct": calculate_gross_absorption_pct(row.get("initial_gross_g"), row.get("final_gross_g")),
                "marketIndicator": lot_market["indicator"],
                "marketWarning": lot_market["warning"],
                **{
                    "species": row["species"],
                    "productBrand": row["product_brand"],
                    "lote": row["lot_code"],
                    "monitor": row["monitor_name"],
                    "plantName": row.get("plant_name"),
                    "fabDate": str(row["fabrication_date"]),
                    "gross": row["initial_gross_g"],
                    "finalGross": row["final_gross_g"],
                    "finalPackGrams": row["final_package_g"],
                    "finalNet": row["final_net_g"],
                    "lossAbs": row["loss_abs_g"],
                    "lossPct": row["loss_pct"],
                    "createdAt": row["initial_weighed_at"],
                    "finalAt": row["final_weighed_at"],
                },
            }
            for row in finalized
        ],
        "absorptionTests": [
            {
                "id": test["client_record_id"] or str(test["id"]),
                "recordId": test["weighing_id"],
                "species": test["species"],
                "productBrand": test["product_brand"],
                "lote": next((str(item.get("lot_code")) for item in lots if str(item.get("id")) == str(test.get("lot_id"))), ""),
                "baseType": test["base_type"],
                "initialWeight": test["initial_weight_g"],
                "finalWeight": test["final_weight_g"],
                "dryWeight": test["dry_weight_g"],
                "absorption": test["absorption_g"],
                "absorptionPercent": test["absorption_pct"],
                "note": test["note"],
                "createdAt": test["tested_at"],
            }
            for test in tests
        ],
    }
    lot_summary_map = {}
    for item in report["lotSummaries"]:
        # Recalcula por lote para classificar mercado de cada lote consolidado.
        values = [
            calculate_gross_absorption_pct(row.get("initial_gross_g"), row.get("final_gross_g"))
            for row in finalized
            if str(row.get("lot_code") or "").strip() == item["key"]
        ]
        values = [value for value in values if value is not None]
        average_value = sum(values) / 6 if values else None
        market = classify_market_by_percent(average_value)
        item["averageGrossAbsPct"] = average_value
        item["averageGrossAbsPctDisplay"] = None if average_value is None else f"{average_value:.6f}"
        item["marketIndicator"] = market["indicator"]
        item["marketWarning"] = market["warning"]
        lot_summary_map[item["key"]] = item

    for row in report["finalizedRecords"]:
        # Propaga o indicador consolidado do lote para cada registro finalizado.
        lot_summary = lot_summary_map.get(str(row.get("lote") or "").strip())
        if lot_summary:
            row["lotGrossAbsPct"] = lot_summary.get("averageGrossAbsPct")
            row["marketIndicator"] = lot_summary.get("marketIndicator")
            row["marketWarning"] = lot_summary.get("marketWarning")

    report["conclusion"] = conclusion or build_report_conclusion(report)
    return report


def build_report_snapshot_for_lot(
    conn: Connection,
    lot_id: str,
    *,
    title: str | None = None,
    objective: str | None = None,
    method: str | None = None,
    conclusion: str | None = None,
) -> dict[str, Any] | None:
    """Atalho para montar laudo de um unico lote mantendo a API anterior."""
    return _build_report_snapshot_for_lot_ids(
        conn,
        [lot_id],
        title=title,
        objective=objective,
        method=method,
        conclusion=conclusion,
    )


def sync_report_weighing_links(
    conn: Connection,
    report_id: str,
    report: dict[str, Any],
    *,
    lot_ids: list[str] | None = None,
) -> None:
    """Sincroniza a tabela de relacionamento entre laudo emitido e pesagens usadas."""
    record_snapshots: dict[str, dict[str, Any]] = {}
    for key in ("initialRecords", "finalizedRecords"):
        for record in report.get(key) or []:
            record_id = str(record.get("id") or "").strip()
            db_id = str(record.get("dbId") or "").strip()
            if record_id:
                record_snapshots[record_id] = json_ready(record)
            if db_id:
                record_snapshots[db_id] = json_ready(record)

    if not record_snapshots:
        return

    # Procura por ID do banco e por ID do cliente offline, pois ambos aparecem
    # em diferentes pontos do snapshot do relatorio.
    query = """
        select id, client_record_id
        from weighings
        where (cast(id as text) = any(%s) or coalesce(client_record_id, '') = any(%s))
    """
    params: tuple[Any, ...] = (list(record_snapshots.keys()), list(record_snapshots.keys()))
    if lot_ids:
        query += " and lot_id = any(%s)"
        params = params + (lot_ids,)

    weighings = fetch_all(conn, query, params)

    with conn.cursor() as cur:
        cur.execute("delete from technical_report_weighings where report_id = %s", (report_id,))
        for weighing in weighings:
            snapshot = record_snapshots.get(str(weighing.get("client_record_id") or "")) or record_snapshots.get(str(weighing["id"]))
            if not snapshot:
                continue
            cur.execute(
                """
                insert into technical_report_weighings (report_id, weighing_id, snapshot_json)
                values (%s, %s, %s)
                on conflict (report_id, weighing_id) do update
                set snapshot_json = excluded.snapshot_json
                """,
                (report_id, weighing["id"], Json(snapshot)),
            )


def create_report_for_lots(
    conn: Connection,
    lot_ids: list[str],
    *,
    user_id: str | None,
    title: str | None = None,
    objective: str | None = None,
    method: str | None = None,
    conclusion: str | None = None,
) -> dict[str, Any] | None:
    """Emite laudo para um ou varios lotes e grava auditoria da emissao."""
    unique_lot_ids = []
    for lot_id in lot_ids:
        lot_text = str(lot_id or "").strip()
        if lot_text and lot_text not in unique_lot_ids:
            unique_lot_ids.append(lot_text)

    if not unique_lot_ids:
        return None

    report = _build_report_snapshot_for_lot_ids(
        conn,
        unique_lot_ids,
        title=title,
        objective=objective,
        method=method,
        conclusion=conclusion,
    )
    if not report:
        return None
    # technical_reports.lot_id so recebe valor quando o laudo e de lote unico;
    # laudos consolidados usam a tabela tecnica de vinculos.
    primary_lot_id = unique_lot_ids[0] if len(unique_lot_ids) == 1 else None
    report_id = insert_report_snapshot(conn, primary_lot_id, user_id, report, lot_ids=unique_lot_ids)
    if not report_id:
        return None
    row = fetch_one(conn, "select * from technical_reports where id = %s", (report_id,))
    if row:
        lot_row = fetch_one(
            conn,
            "select plant_id from production_lots where id = any(%s) and plant_id is not null limit 1",
            (unique_lot_ids,),
        )
        log_audit(
            conn,
            plant_id=str(lot_row["plant_id"]) if lot_row and lot_row.get("plant_id") else None,
            user_id=user_id,
            entity_name="technical_report",
            entity_id=report_id,
            action="issue_report",
            new_data=row,
        )
    return row


def create_report_for_lot(
    conn: Connection,
    lot_id: str,
    *,
    user_id: str | None,
    title: str | None = None,
    objective: str | None = None,
    method: str | None = None,
    conclusion: str | None = None,
) -> dict[str, Any] | None:
    """Compatibilidade para chamadas antigas que emitem laudo de apenas um lote."""
    return create_report_for_lots(
        conn,
        [lot_id],
        user_id=user_id,
        title=title,
        objective=objective,
        method=method,
        conclusion=conclusion,
    )


def insert_report_snapshot(
    conn: Connection,
    lot_id: str | None,
    user_id: str | None,
    report: dict[str, Any],
    *,
    lot_ids: list[str] | None = None,
) -> str | None:
    """Grava o snapshot do laudo em technical_reports e vincula pesagens usadas."""
    if not report:
        return None

    normalized_report, _, report_hash, report_number = build_report_identity(report)
    laudo = normalized_report.get("laudo") or {}
    totals = normalized_report.get("totals") or {}

    row = fetch_one(
        conn,
        """
        insert into technical_reports (
          lot_id, report_number, status, title, objective, method, conclusion,
          total_initial_records, total_finalized_records, total_pending_records,
          total_gross_g, total_initial_net_g, total_final_net_g,
          total_loss_abs_g, average_loss_pct, report_json, sha256_hash,
          issued_by, issued_at
        )
        values (
          %s, %s, 'issued', %s, %s, %s, %s,
          %s, %s, %s,
          %s, %s, %s,
          %s, %s, %s, %s,
          %s, now()
        )
        on conflict (report_number) do update set
          -- Mesmo conteudo gera mesmo numero; reemitir atualiza o JSON/hash salvo.
          report_json = excluded.report_json,
          sha256_hash = excluded.sha256_hash
        returning id
        """,
        (
            lot_id,
            report_number,
            laudo.get("title") or "Laudo tecnico de analise de gotejamento",
            laudo.get("objective"),
            laudo.get("method"),
            report.get("conclusion") or build_report_conclusion(report),
            to_int(totals.get("initialRecords")),
            to_int(totals.get("finalizedRecords")),
            to_int(totals.get("pendingRecords")),
            to_int(totals.get("totalGross")),
            to_int(totals.get("totalNetInitial")),
            to_int(totals.get("totalFinalNet")),
            to_int(totals.get("totalLossAbs")),
            to_float(totals.get("averageLossPct")),
            Json(normalized_report),
            report_hash,
            user_id,
        ),
    )
    report_id = str(row["id"]) if row else None
    if report_id:
        sync_report_weighing_links(conn, report_id, normalized_report, lot_ids=lot_ids or ([lot_id] if lot_id else []))
    return report_id


def import_snapshot(conn: Connection, snapshot: dict[str, Any]) -> dict[str, Any]:
    """Importa o pacote offline completo enviado pelo frontend local-first."""
    plant_id = ensure_default_plant(conn)
    user_payload = snapshot.get("user") or {}
    monitor_name = user_payload.get("monitorName") or user_payload.get("monitor")
    user_id = get_or_create_user(conn, plant_id, monitor_name)
    client_id = get_or_create_client(conn, plant_id, user_id, snapshot)

    sync_row = fetch_one(
        conn,
        """
        insert into sync_batches (client_id, user_id, direction, status, payload_json)
        values (%s, %s, 'push', 'pending', %s)
        returning id
        """,
        (client_id, user_id, Json(snapshot)),
    )
    assert sync_row is not None
    batch_id = str(sync_row["id"])

    # O store segue a estrutura do localStorage/web app: pesagens iniciais,
    # testes de absorcao e eventualmente um relatorio pre-montado.
    store = snapshot.get("store") or {}
    records = store.get("initialRecords") or []
    absorption_tests = store.get("absorptionTests") or []
    imported = {"lots": 0, "weighings": 0, "absorptionTests": 0, "reports": 0}
    # Protect the server from extremely large payloads; clients should chunk large datasets.
    total_items = (len(records) if isinstance(records, list) else 0) + (
        len(absorption_tests) if isinstance(absorption_tests, list) else 0
    )
    MAX_BATCH_ITEMS = 1000
    if total_items > MAX_BATCH_ITEMS:
        err = f"payload_too_large: {total_items} items (max {MAX_BATCH_ITEMS})"
        with conn.cursor() as cur:
            cur.execute(
                """
                update sync_batches
                set status = 'error', error_message = %s, finished_at = now()
                where id = %s
                """,
                (err, batch_id),
            )
        return {
            "ok": False,
            "syncBatchId": batch_id,
            "imported": imported,
            "conflicts": [{"error": err}],
        }
    conflicts: list[dict[str, Any]] = []
    lot_ids: set[str] = set()

    try:
        for record in records:
            try:
                # Cada registro roda em subtransacao para um erro nao impedir a
                # importacao dos demais itens do lote.
                with conn.transaction():
                    weighing_id = upsert_weighing(conn, plant_id, client_id, record, user_payload)
                    imported["weighings"] += 1
                    lot_row = fetch_one(conn, "select lot_id from weighings where id = %s", (weighing_id,))
                    if lot_row:
                        lot_ids.add(str(lot_row["lot_id"]))
            except Exception as exc:
                conflicts.append({"entity": "weighing", "clientRecordId": record.get("id"), "error": str(exc)})

        for test in absorption_tests:
            try:
                # Mesma estrategia de conflito isolado para testes de absorcao.
                with conn.transaction():
                    upsert_absorption_test(conn, plant_id, client_id, test, user_payload)
                    imported["absorptionTests"] += 1
            except Exception as exc:
                conflicts.append({"entity": "absorption_test", "clientRecordId": test.get("id"), "error": str(exc)})

        imported["lots"] = len(lot_ids)
        # Se o snapshot trouxe relatorio, salva uma versao oficial associada aos
        # lotes importados nesta sincronizacao.
        report_id = insert_report_snapshot(
            conn,
            next(iter(lot_ids), None) if len(lot_ids) == 1 else None,
            user_id,
            snapshot.get("report") or {},
            lot_ids=sorted(lot_ids),
        )
        if report_id:
            imported["reports"] = 1

        status = "conflict" if conflicts else "synced"
        with conn.cursor() as cur:
            # O batch fica como conflict quando parte dos itens falhou, mas os
            # itens validos continuam persistidos.
            cur.execute(
                """
                update sync_batches
                set status = %s, error_message = %s, finished_at = now()
                where id = %s
                """,
                (status, json.dumps(conflicts, ensure_ascii=True) if conflicts else None, batch_id),
            )
    except Exception as exc:
        with conn.cursor() as cur:
            # Erro fora dos itens individuais invalida o batch completo.
            cur.execute(
                """
                update sync_batches
                set status = 'error', error_message = %s, finished_at = now()
                where id = %s
                """,
                (str(exc), batch_id),
            )
        raise

    return {
        "ok": not conflicts,
        "syncBatchId": batch_id,
        "imported": imported,
        "conflicts": conflicts,
    }
