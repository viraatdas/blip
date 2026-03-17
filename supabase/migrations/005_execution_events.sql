create table execution_events (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references executions(id) on delete cascade,
  seq integer not null,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_execution_events_execution_id on execution_events(execution_id);
create unique index idx_execution_events_unique_seq on execution_events(execution_id, seq);
