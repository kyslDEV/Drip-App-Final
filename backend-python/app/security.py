"""Autenticacao e autorizacao do backend DripTest.

Este modulo cobre dois tipos de acesso:
- token de servico, usado por clientes de sincronizacao;
- sessao de usuario, gerada no login e assinada com HMAC.

Nao ha dependencia externa de JWT aqui: o token e um payload JSON em base64url
mais uma assinatura HMAC-SHA256.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .settings import settings


TOKEN_ALGORITHM = "HS256"
PASSWORD_ALGORITHM = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 390000


# HTTPBearer extrai o cabecalho Authorization: Bearer <token>. auto_error=False
# permite personalizar a mensagem de erro em require_api_token/require_user_session.
bearer = HTTPBearer(auto_error=False)


def _require_signing_secret() -> bytes:
    """Retorna o segredo usado para HMAC ou falha se o servidor estiver mal configurado."""
    if not settings.api_token:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfiguration: API token not set.",
        )
    return settings.api_token.encode("utf-8")


def _b64url_encode(raw: bytes) -> str:
    """Codifica bytes em base64url sem padding, formato usado no token."""
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    """Decodifica base64url recolocando o padding removido na emissao."""
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def hash_password(password: str) -> str:
    """Gera hash PBKDF2 com salt proprio para senha de usuario."""
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_ITERATIONS,
    )
    return f"{PASSWORD_ALGORITHM}${PASSWORD_ITERATIONS}${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    """Confere senha informada contra o hash salvo no banco."""
    if not stored_hash:
        return False

    try:
        algorithm, iterations_text, salt_hex, digest_hex = stored_hash.split("$", 3)
        if algorithm != PASSWORD_ALGORITHM:
            return False
        iterations = int(iterations_text)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except (ValueError, TypeError):
        return False

    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    # compare_digest evita comparacao com tempo variavel e reduz risco de timing attack.
    return hmac.compare_digest(candidate, expected)


def create_access_token(user: dict[str, Any]) -> tuple[str, int]:
    """Cria token de sessao assinado a partir dos dados principais do usuario."""
    ttl_seconds = max(1, int(settings.auth_token_ttl_hours)) * 3600
    payload = {
        "sub": str(user["id"]),
        "email": user.get("email"),
        "name": user.get("name"),
        "role": user.get("role"),
        "exp": int(time.time()) + ttl_seconds,
        "alg": TOKEN_ALGORITHM,
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(_require_signing_secret(), payload_bytes, hashlib.sha256).digest()
    # O token final e "<payload-base64url>.<assinatura-base64url>".
    token = f"{_b64url_encode(payload_bytes)}.{_b64url_encode(signature)}"
    return token, ttl_seconds


def parse_access_token(token: str) -> dict[str, Any] | None:
    """Valida assinatura, validade e algoritmo do token de sessao."""
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        payload_bytes = _b64url_decode(encoded_payload)
        given_signature = _b64url_decode(encoded_signature)
    except (ValueError, TypeError):
        return None

    expected_signature = hmac.new(_require_signing_secret(), payload_bytes, hashlib.sha256).digest()
    if not hmac.compare_digest(given_signature, expected_signature):
        return None

    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
    except json.JSONDecodeError:
        return None

    if payload.get("exp") is None or int(payload["exp"]) < int(time.time()):
        return None
    if payload.get("alg") != TOKEN_ALGORITHM:
        return None
    return payload


def require_api_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict[str, Any]:
    # Support both the service token already used by sync clients and signed user sessions.
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token da API invalido.",
        )

    token = credentials.credentials
    # Token igual a DRIP_API_TOKEN representa chamada tecnica/de servico.
    if token == settings.api_token:
        return {"auth_type": "service", "role": "admin"}

    # Caso contrario, tenta tratar como sessao de usuario emitida pelo login.
    claims = parse_access_token(token)
    if claims:
        claims["auth_type"] = "user"
        return claims

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token da API invalido.",
    )


def require_user_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict[str, Any]:
    """Exige especificamente uma sessao de usuario, nao apenas token de servico."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessao invalida.",
        )

    claims = parse_access_token(credentials.credentials)
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessao invalida.",
        )
    return claims
