-- DripTest - schema PostgreSQL robusto
-- Base alinhada ao app Web atual e preparada para API/FastAPI + app Kotlin/Room.

-- Extensao usada para gerar UUIDs diretamente no banco.
create extension if not exists pgcrypto;

-- Perfis aceitos pelo backend e usados para autorizacao/auditoria.
do $$
begin
  create type user_role as enum ('monitor', 'supervisor', 'admin');
exception when duplicate_object then null;
end $$;

-- Estado funcional do lote dentro do processo produtivo.
do $$
begin
  create type lot_status as enum ('open', 'closed', 'cancelled');
exception when duplicate_object then null;
end $$;

-- Etapas possiveis de uma pesagem no ciclo DripTest.
do $$
begin
  create type weighing_status as enum ('initial', 'final', 'reopened', 'cancelled');
exception when duplicate_object then null;
end $$;

-- Situacao de emissao do laudo tecnico.
do $$
begin
  create type report_status as enum ('draft', 'issued', 'cancelled');
exception when duplicate_object then null;
end $$;

-- Estado tecnico de sincronizacao entre cliente local e servidor.
do $$
begin
  create type sync_status as enum ('pending', 'synced', 'conflict', 'error');
exception when duplicate_object then null;
end $$;

-- Trigger generico para manter updated_at coerente sem depender da aplicacao.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Planta/setor operacional. Hoje a aplicacao usa uma planta padrao, mas a
-- estrutura ja permite separar registros por unidade/area futuramente.
create table if not exists plants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Usuarios humanos da operacao e da administracao.
-- plant_id pode ser nulo para preservar historico mesmo se a planta for alterada/removida.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id) on delete set null,
  name text not null,
  email text unique,
  role user_role not null default 'monitor',
  password_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dispositivo/app cliente que envia dados para a API.
-- client_key precisa ser unico para permitir sincronizacao idempotente.
create table if not exists app_clients (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  client_key text not null unique,
  platform text not null default 'web',
  app_version text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- Lote tecnico de producao analisado no DripTest.
-- A chave unica evita duplicacao do mesmo lote por variacao de importacao/sync.
create table if not exists production_lots (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id) on delete set null,
  lot_code text not null,
  fabrication_date date not null,
  product_brand text not null,
  species text not null,
  status lot_status not null default 'open',
  notes text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plant_id, lot_code, fabrication_date, product_brand, species)
);

-- Registro principal da analise de gotejamento.
-- Esta tabela concentra a pesagem inicial, a pesagem final e os indicadores
-- calculados de perda para cada amostra.
create table if not exists weighings (
  id uuid primary key default gen_random_uuid(),

  -- ID original do app Web/Kotlin. Mantem compatibilidade com localStorage/Room.
  client_record_id text unique,
  client_id uuid references app_clients(id) on delete set null,
  sync_status sync_status not null default 'synced',
  source_app text not null default 'web',

  lot_id uuid not null references production_lots(id) on delete cascade,
  monitor_id uuid references users(id) on delete set null,
  monitor_name_snapshot text,
  sample_number integer,

  species text not null,
  product_brand text not null,
  status weighing_status not null default 'initial',

  -- Pesagem inicial
  initial_gross_g integer not null check (initial_gross_g > 0),
  initial_package_kg numeric(8, 4) not null default 0.006,
  initial_package_g integer not null default 6 check (initial_package_g >= 0),
  initial_net_g integer not null check (initial_net_g >= 0),
  time_min integer check (time_min is null or time_min >= 0),
  time_interpolated boolean not null default false,
  initial_weighed_at timestamptz not null default now(),

  -- Pesagem final
  final_gross_g integer check (final_gross_g is null or final_gross_g >= 0),
  final_package_kg numeric(8, 4),
  final_package_g integer check (final_package_g is null or final_package_g >= 0),
  final_net_g integer check (final_net_g is null or final_net_g >= 0),
  loss_abs_g integer,
  loss_pct numeric(8, 2),
  final_weighed_at timestamptz,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Uma pesagem marcada como final precisa ter dados minimos de fechamento.
  check (
    status <> 'final'
    or (
      final_net_g is not null
      and loss_abs_g is not null
      and final_weighed_at is not null
    )
  )
);

-- Teste complementar de absorcao usado em alguns fluxos de qualidade/laudo.
-- Pode existir vinculado a uma pesagem ou apenas ao lote.
create table if not exists absorption_tests (
  id uuid primary key default gen_random_uuid(),
  client_record_id text unique,
  client_id uuid references app_clients(id) on delete set null,
  lot_id uuid references production_lots(id) on delete set null,
  weighing_id uuid references weighings(id) on delete set null,
  monitor_id uuid references users(id) on delete set null,

  species text not null,
  product_brand text not null,
  base_type text not null default 'initial'
    check (base_type in ('initial', 'dry')),
  initial_weight_g numeric(10, 2) not null default 0,
  final_weight_g numeric(10, 2) not null default 0,
  dry_weight_g numeric(10, 2),
  absorption_g numeric(10, 2) not null default 0,
  absorption_pct numeric(8, 2),
  note text,
  tested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Laudo oficial persistido pelo backend.
-- report_json guarda o snapshot completo consolidado; os totais indexam o que
-- mais costuma ser consultado sem precisar reconstruir o JSON toda vez.
create table if not exists technical_reports (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid references production_lots(id) on delete set null,
  report_number text unique,
  status report_status not null default 'draft',

  title text not null default 'Laudo tecnico de analise de gotejamento',
  objective text,
  method text,
  conclusion text,

  total_initial_records integer not null default 0,
  total_finalized_records integer not null default 0,
  total_pending_records integer not null default 0,
  total_gross_g integer not null default 0,
  total_initial_net_g integer not null default 0,
  total_final_net_g integer not null default 0,
  total_loss_abs_g integer not null default 0,
  average_loss_pct numeric(8, 2),

  report_json jsonb not null,
  sha256_hash text,
  issued_by uuid references users(id) on delete set null,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Relacao N:N entre laudo emitido e pesagens utilizadas na consolidacao.
-- snapshot_json preserva o estado exato da amostra no momento da emissao.
create table if not exists technical_report_weighings (
  report_id uuid not null references technical_reports(id) on delete cascade,
  weighing_id uuid not null references weighings(id) on delete restrict,
  snapshot_json jsonb not null,
  primary key (report_id, weighing_id)
);

-- Lote tecnico de sincronizacao enviado/recebido pela API.
-- payload_json guarda o pacote bruto para diagnostico e rastreabilidade.
create table if not exists sync_batches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references app_clients(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  direction text not null check (direction in ('push', 'pull')),
  status sync_status not null default 'pending',
  payload_json jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Trilho de auditoria das acoes relevantes feitas via backend.
-- old_data/new_data guardam o antes e depois quando isso fizer sentido.
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  client_id uuid references app_clients(id) on delete set null,
  entity_name text not null,
  entity_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- Triggers de manutencao automatica do carimbo de alteracao.
drop trigger if exists trg_plants_updated_at on plants;
create trigger trg_plants_updated_at
before update on plants
for each row execute function set_updated_at();

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at
before update on users
for each row execute function set_updated_at();

drop trigger if exists trg_lots_updated_at on production_lots;
create trigger trg_lots_updated_at
before update on production_lots
for each row execute function set_updated_at();

drop trigger if exists trg_weighings_updated_at on weighings;
create trigger trg_weighings_updated_at
before update on weighings
for each row execute function set_updated_at();

drop trigger if exists trg_absorption_tests_updated_at on absorption_tests;
create trigger trg_absorption_tests_updated_at
before update on absorption_tests
for each row execute function set_updated_at();

drop trigger if exists trg_reports_updated_at on technical_reports;
create trigger trg_reports_updated_at
before update on technical_reports
for each row execute function set_updated_at();

-- Indices voltados aos filtros e joins mais frequentes da API, das telas e dos laudos.
create index if not exists idx_users_plant_id on users(plant_id);
create index if not exists idx_clients_user_id on app_clients(user_id);
create index if not exists idx_lots_plant_date on production_lots(plant_id, fabrication_date);
create index if not exists idx_lots_code on production_lots(lot_code);
create index if not exists idx_lots_brand_species on production_lots(product_brand, species);
create index if not exists idx_weighings_lot_id on weighings(lot_id);
create index if not exists idx_weighings_monitor_id on weighings(monitor_id);
create index if not exists idx_weighings_status on weighings(status);
create index if not exists idx_weighings_client_record_id on weighings(client_record_id);
create index if not exists idx_weighings_initial_weighed_at on weighings(initial_weighed_at);
create index if not exists idx_absorption_lot_id on absorption_tests(lot_id);
create index if not exists idx_absorption_weighing_id on absorption_tests(weighing_id);
create index if not exists idx_reports_lot_id on technical_reports(lot_id);
create index if not exists idx_reports_status on technical_reports(status);
create index if not exists idx_sync_batches_client_id on sync_batches(client_id);
create index if not exists idx_audit_entity on audit_logs(entity_name, entity_id);
create index if not exists idx_audit_created_at on audit_logs(created_at);

-- View de leitura para relatorios e listagens de pesagens.
-- Junta lote e monitor em um formato pronto para API/frontend sem duplicar SQL.
create or replace view v_weighing_report_data as
select
  w.id,
  w.client_record_id,
  l.lot_code,
  l.fabrication_date,
  w.product_brand,
  w.species,
  coalesce(u.name, w.monitor_name_snapshot) as monitor_name,
  w.sample_number,
  w.status,
  w.initial_gross_g,
  w.initial_package_g,
  w.initial_net_g,
  w.time_min,
  w.time_interpolated,
  w.initial_weighed_at,
  w.final_gross_g,
  w.final_package_g,
  w.final_net_g,
  w.loss_abs_g,
  w.loss_pct,
  w.final_weighed_at
from weighings w
join production_lots l on l.id = w.lot_id
left join users u on u.id = w.monitor_id;

-- View agregada por lote para dashboards, filtros e endpoints de resumo.
create or replace view v_lot_summary as
select
  l.id as lot_id,
  l.lot_code,
  l.fabrication_date,
  l.product_brand,
  l.species,
  count(w.id)::integer as total_records,
  count(w.id) filter (where w.status = 'final')::integer as finalized_records,
  count(w.id) filter (where w.status <> 'final')::integer as pending_records,
  coalesce(sum(w.initial_gross_g), 0)::integer as total_gross_g,
  coalesce(sum(w.initial_net_g), 0)::integer as total_initial_net_g,
  coalesce(sum(w.final_net_g), 0)::integer as total_final_net_g,
  coalesce(sum(w.loss_abs_g), 0)::integer as total_loss_abs_g,
  round(avg(w.loss_pct) filter (where w.loss_pct is not null), 2) as average_loss_pct
from production_lots l
left join weighings w on w.lot_id = l.id
group by l.id, l.lot_code, l.fabrication_date, l.product_brand, l.species;

-- Registro minimo para o sistema funcionar mesmo sem cadastro completo de plantas.
insert into plants (name, code)
values ('Planta padrao', 'DEFAULT')
on conflict (code) do nothing;
