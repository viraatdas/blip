create extension if not exists pgmq;
select pgmq.create('execution_jobs');

-- Wrapper functions for supabase-js rpc calls
create or replace function pgmq_send(queue_name text, message jsonb)
returns bigint as $$
  select pgmq.send(queue_name, message);
$$ language sql;

create or replace function pgmq_read(queue_name text, vt integer, qty integer)
returns setof pgmq.message_record as $$
  select * from pgmq.read(queue_name, vt, qty);
$$ language sql;

create or replace function pgmq_archive(queue_name text, msg_id bigint)
returns boolean as $$
  select pgmq.archive(queue_name, msg_id);
$$ language sql;
