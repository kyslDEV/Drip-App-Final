from pathlib import Path


supervisor_html = Path(__file__).resolve().parents[1] / "DripSupervisor.html"
content = supervisor_html.read_text(encoding="utf-8")


def assert_not_contains(text: str, snippet: str, message: str) -> None:
    if snippet in text:
        raise AssertionError(message)


def assert_contains(text: str, snippet: str, message: str) -> None:
    if snippet not in text:
        raise AssertionError(message)


assert_not_contains(
    content,
    'href="DripSettings.html"',
    "a navegacao do Supervisor nao deve expor atalho para Banco e Dados",
)

assert_not_contains(
    content,
    'id="syncLocalBtn"',
    "o Supervisor nao deve expor acao manual de sincronizacao com a API",
)

assert_not_contains(
    content,
    'id="syncBankBtn"',
    "o Supervisor nao deve expor acao manual de consulta ao banco",
)

assert_not_contains(
    content,
    'id="testApiBtn"',
    "o Supervisor nao deve expor teste tecnico de API",
)

assert_not_contains(
    content,
    "async function testApiConnection()",
    "a tela do Supervisor nao deve carregar rotina tecnica de teste de API",
)

assert_not_contains(
    content,
    "async function syncLocalNow()",
    "a tela do Supervisor nao deve carregar rotina tecnica de sync manual",
)

assert_not_contains(
    content,
    'id="sourceFilter"',
    "o Supervisor nao deve expor filtro de origem da API",
)

assert_contains(
    content,
    '<script src="drip-api.js"></script>',
    "o Supervisor pode consultar a API em modo somente leitura para enxergar as acoes do monitor",
)

assert_contains(
    content,
    "DripApi.isEnabled()",
    "o Supervisor precisa detectar quando a API esta habilitada para ativar a leitura automatica",
)

assert_contains(
    content,
    "SupervisorData.normalizeServerRows(",
    "a tela do Supervisor precisa normalizar a resposta do backend",
)

assert_contains(
    content,
    "SupervisorData.mergeRecords(",
    "a tela do Supervisor precisa mesclar dados locais e dados da API",
)

assert_contains(
    content,
    "DripApi.listWeighings(",
    "o Supervisor precisa buscar as pesagens sincronizadas no backend",
)

assert_contains(
    content,
    "document.getElementById('refreshBtn').addEventListener('click', () => { void loadData(); });",
    "o botao Atualizar deve recarregar a leitura consolidada do Supervisor",
)
