create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  key_id text unique not null,
  key_prefix text not null,
  name text,
  secret_salt text not null,
  secret_hash text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index idx_api_keys_user_id on api_keys(user_id);
create index idx_api_keys_key_id on api_keys(key_id);
create index idx_api_keys_secret_hash on api_keys(secret_hash);
