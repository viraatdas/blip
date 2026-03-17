create table agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  dockerfile text,
  claude_md text,
  mcp_config jsonb,
  settings jsonb not null default '{}',
  env_vars jsonb,
  anthropic_api_key text,  -- encrypted at rest
  e2b_template_id text,
  template_status text not null default 'pending' check (template_status in ('pending', 'building', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_agents_user_id on agents(user_id);
