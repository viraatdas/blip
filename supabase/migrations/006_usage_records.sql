create table usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  execution_id uuid not null references executions(id) on delete cascade,
  cost_usd numeric(10, 6) not null,
  duration_ms integer not null,
  created_at timestamptz not null default now()
);

create index idx_usage_records_user_id on usage_records(user_id);
create index idx_usage_records_created_at on usage_records(created_at);
