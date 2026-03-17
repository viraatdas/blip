create table executions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  prompt text not null,
  session_id text,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  sandbox_id text,
  result_text text,
  cost_usd numeric(10, 6),
  turns integer,
  duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_executions_agent_id on executions(agent_id);
create index idx_executions_user_id on executions(user_id);
create index idx_executions_session_id on executions(session_id);
create index idx_executions_status on executions(status);
