-- Make agent_id optional on executions so users can run without creating an agent
alter table executions alter column agent_id drop not null;
