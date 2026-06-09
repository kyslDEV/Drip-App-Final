"""Controle central de conexoes com o PostgreSQL.

O backend usa um pool unico por processo para evitar abrir uma conexao nova a
cada requisicao. Cada endpoint recebe uma conexao por dependencia FastAPI e a
operacao fica protegida por uma transacao.
"""

from collections.abc import Generator

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .settings import settings


# Pool global do processo. Ele comeca vazio e e aberto no lifespan da API ou na
# primeira chamada de get_db(), caso algum teste/uso direto acione a dependencia.
pool: ConnectionPool | None = None


def open_pool() -> None:
    """Abre o pool somente uma vez usando a URL configurada em DRIP_DATABASE_URL."""
    global pool
    if pool is None:
        pool = ConnectionPool(
            conninfo=settings.database_url,
            min_size=1,
            max_size=8,
            # dict_row faz cada linha voltar como dict, simplificando schemas e
            # respostas JSON sem depender de indice de coluna.
            kwargs={"row_factory": dict_row},
            open=True,
        )


def close_pool() -> None:
    """Fecha o pool no encerramento da aplicacao para liberar conexoes."""
    global pool
    if pool is not None:
        pool.close()
        pool = None


def get_db() -> Generator[Connection, None, None]:
    """Entrega uma conexao transacional para cada endpoint FastAPI."""
    if pool is None:
        open_pool()

    assert pool is not None
    with pool.connection() as conn:
        # Se o endpoint terminar sem erro a transacao confirma; se levantar
        # excecao, o psycopg desfaz as alteracoes automaticamente.
        with conn.transaction():
            yield conn
