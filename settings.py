"""Configuracao carregada por variaveis de ambiente.

Todos os nomes abaixo recebem o prefixo DRIP_ no ambiente. Exemplo:
database_url e lido como DRIP_DATABASE_URL. A validacao no final do arquivo
impede que a API suba sem banco ou token de seguranca.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Mapa de configuracoes operacionais do backend DripTest."""

    # Nome usado no /health e no titulo da documentacao OpenAPI.
    app_name: str = "DripTest API"
    # URL completa de conexao PostgreSQL. Obrigatoria em qualquer ambiente.
    database_url: str = ""
    # Token de servico usado por clientes de sincronizacao e assinatura de sessao.
    api_token: str = ""
    # Lista separada por virgulas de origens liberadas para chamadas do navegador.
    cors_origins: str = "http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000"
    # Duracao das sessoes de usuario autenticado, em horas.
    auth_token_ttl_hours: int = 8
    # Dados opcionais para criar/atualizar o administrador inicial no startup.
    bootstrap_admin_name: str = "Administrador DripTest"
    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""

    # Pydantic le backend-python/.env e ignora variaveis extras para manter
    # compatibilidade com ambientes que tenham outras chaves.
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="DRIP_",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        """Converte a string de CORS em lista consumida pelo middleware FastAPI."""
        raw = self.cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [item.strip() for item in raw.split(",") if item.strip()]


# Instancia unica importada pelos demais modulos.
settings = Settings()

# Enforce required secrets / config early so production deployments fail fast.
if not settings.database_url:
    raise RuntimeError(
        "DRIP_DATABASE_URL is not set. Copy backend-python/.env.example to .env and set DRIP_DATABASE_URL"
    )

if not settings.api_token:
    raise RuntimeError(
        "DRIP_API_TOKEN is not set. For production you must set a strong API token in the environment."
    )
