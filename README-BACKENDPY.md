# DripTest Backend Python

Backend do DripTest usando FastAPI, psycopg e PostgreSQL.

Esta API foi criada para ligar o app Web ao banco definido em `database/schema.sql` e agora cobre autenticacao basica, lotes, pesagens, finalizacao, sincronizacao e laudos.

Estado atual da integracao:

- a pesagem inicial do app Web ja consegue gravar direto em `POST /weighings`;
- a tela de laudos agora consegue sincronizar os dados locais e emitir o laudo oficial em `POST /reports`;
- a sincronizacao do store e a emissao de laudo foram separadas: sincronizar dados nao gera laudo automaticamente;
- os laudos oficiais ficam salvos em `technical_reports` e vinculados as pesagens em `technical_report_weighings`.

## Estrutura

```text
backend-python/
  app/
    main.py
    repositories.py
    schemas.py
    database.py
    settings.py
    security.py
  requirements.txt
  .env.example
```

## Banco

1. Crie um banco PostgreSQL chamado `driptest`.
2. Execute o schema:

```bash
psql -d driptest -f ../database/schema.sql
```

## Configuracao

Copie `.env.example` para `.env` e ajuste:

```text
DRIP_DATABASE_URL=postgresql://postgres:password@db-host:5432/driptest
DRIP_API_TOKEN=your-strong-api-token
DRIP_CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000
DRIP_AUTH_TOKEN_TTL_HOURS=8
DRIP_BOOTSTRAP_ADMIN_NAME=Administrador DripTest
DRIP_BOOTSTRAP_ADMIN_EMAIL=admin@driptest.local
DRIP_BOOTSTRAP_ADMIN_PASSWORD=change-me
```

Observacoes:

- Nunca commite `.env` no controle de versao.
- `DRIP_DATABASE_URL` e obrigatorio.
- `DRIP_API_TOKEN` e obrigatorio.
- Quando `DRIP_BOOTSTRAP_ADMIN_EMAIL` e `DRIP_BOOTSTRAP_ADMIN_PASSWORD` estiverem preenchidos, o backend cria ou atualiza o primeiro usuario administrador na inicializacao.

Production checklist:

- Defina `DRIP_DATABASE_URL` apontando para o banco de producao.
- Defina `DRIP_API_TOKEN` com um token forte e rotacionavel.
- Defina credenciais seguras para `DRIP_BOOTSTRAP_ADMIN_*`.
- Configure `DRIP_CORS_ORIGINS` para as origens reais do front-end.
- Rode testes e crie backups do banco antes do cutover.

## Instalar e executar

```bash
cd backend-python
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Endpoints atuais

```text
GET  /health

POST /auth/login
GET  /me

POST /sync/push
GET  /sync/pull

GET  /lots
POST /lots
GET  /lots/{id}

GET  /weighings
POST /weighings
PATCH /weighings/{id}/finalize
PATCH /weighings/{id}/reopen

GET  /reports
POST /reports
GET  /reports/{report_id}
```

Observacao sobre laudos:

- `POST /reports` aceita `lot_id` para um lote tecnico unico;
- `POST /reports` tambem aceita `lot_ids` para emissao agregada quando o mesmo laudo precisa consolidar mais de um lote tecnico no banco.

## Autenticacao

O backend aceita dois modos de autenticacao:

- `Authorization: Bearer <DRIP_API_TOKEN>` para integracoes tecnicas e sincronizacao de servico;
- sessao assinada emitida por `POST /auth/login` para operacao humana e auditoria.

Payload esperado em `POST /auth/login`:

```json
{
  "identifier": "admin@driptest.local",
  "password": "change-me"
}
```

Resposta:

```json
{
  "access_token": "token-assinado",
  "token_type": "bearer",
  "expires_in": 28800,
  "user": {
    "id": "uuid",
    "name": "Administrador DripTest",
    "email": "admin@driptest.local",
    "role": "admin",
    "plant_id": "uuid"
  }
}
```

## Integracao com o app Web

O app Web ja possui:

```text
drip-api.js
drip-sync.js
```

Configuracao esperada no navegador:

```json
{
  "baseUrl": "http://localhost:8000",
  "token": "",
  "enabled": true
}
```

Com isso:

- `DripSync.pushLocalStore()` envia somente pesagens e testes locais para `POST /sync/push`;
- `DripSync.pushLocalStore({ includeReport: true })` permite incluir o snapshot local do laudo quando esse comportamento for desejado;
- a tela `DripReports.html` usa a API para sincronizar dados e emitir o laudo oficial por `POST /reports`.

## Fluxo oficial de laudos

Fluxo atual recomendado:

1. sincronizar os dados locais de pesagem e testes;
2. resolver no backend o(s) lote(s) tecnico(s) correspondente(s);
3. emitir o laudo oficial em `POST /reports`;
4. salvar o snapshot completo em `technical_reports.report_json`;
5. salvar hash SHA-256 canonicamente calculado;
6. registrar o relacionamento do laudo com as pesagens em `technical_report_weighings`.

Esse fluxo reduz divergencias entre:

- laudo local de previa/PDF;
- laudo oficial salvo no banco;
- historico consultado pela API.

## Proximos passos recomendados

- conectar o front-end aos novos endpoints de login, finalizacao e emissao de laudo;
- criar tela administrativa para configurar a API;
- adicionar botao "Sincronizar agora";
- criar migrations com Alembic quando o modelo estabilizar;
- criar testes automatizados para regras de negocio e fluxos da API.
