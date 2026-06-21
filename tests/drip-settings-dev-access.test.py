from pathlib import Path


settings_html = Path(__file__).resolve().parents[1] / "DripSettings.html"
content = settings_html.read_text(encoding="utf-8")


def assert_contains(text: str, snippet: str, message: str) -> None:
    if snippet not in text:
        raise AssertionError(message)


assert_contains(
    content,
    "const accessRole =",
    "o modulo Dev precisa identificar o perfil salvo no dispositivo antes de abrir a gestao da API",
)

assert_contains(
    content,
    "if (accessRole !== 'dev')",
    "o modulo Dev precisa bloquear acesso de monitor e supervisor",
)

assert_contains(
    content,
    "window.location.replace(target);",
    "o modulo Dev precisa redirecionar perfis nao autorizados para a tela correta",
)

