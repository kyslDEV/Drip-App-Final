from pathlib import Path


final_html = Path(__file__).resolve().parents[1] / "DripTestF.html"
content = final_html.read_text(encoding="utf-8")


def assert_contains(text: str, snippet: str, message: str) -> None:
    if snippet not in text:
        raise AssertionError(message)


assert_contains(
    content,
    "DripApi.finalizeWeighing(",
    "a pesagem final precisa ser enviada para a API quando a amostra ja existir no backend",
)

assert_contains(
    content,
    "DripApi.reopenWeighing(",
    "a reabertura precisa desfazer a etapa final tambem no backend",
)

assert_contains(
    content,
    "record.backendId",
    "o fluxo final precisa usar o ID do backend para sincronizar a mesma amostra",
)

assert_contains(
    content,
    "syncStatus: 'error'",
    "o fluxo final precisa marcar erro de sincronizacao quando a API falhar",
)
