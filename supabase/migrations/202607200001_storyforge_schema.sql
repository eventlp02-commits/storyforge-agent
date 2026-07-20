create extension if not exists pgcrypto;

create type public.run_status as enum ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled');
create type public.stage_status as enum ('queued', 'running', 'waiting', 'completed', 'failed', 'skipped', 'cancelled');
create type public.asset_status as enum ('planned', 'prompt-only', 'generating', 'done', 'deferred', 'cancelled');
create type public.artifact_status as enum ('current', 'stale', 'archived');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  concept text not null,
  inferred_config jsonb not null default '{}'::jsonb,
  status public.run_status not null default 'queued',
  current_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.run_status not null default 'queued',
  mode text not null check (mode in ('demo', 'live', 'quality')),
  skill_version text not null,
  model_config jsonb not null default '{}'::jsonb,
  budget jsonb not null default '{}'::jsonb,
  usage jsonb not null default '{"tokens":0,"costUsd":0,"images":0,"videoSeconds":0}'::jsonb,
  idempotency_key text not null,
  trigger_run_id text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

alter table public.projects
  add constraint projects_current_run_fk foreign key (current_run_id) references public.runs(id) on delete set null;

create table public.stage_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null,
  status public.stage_status not null default 'queued',
  attempt integer not null default 1 check (attempt between 1 and 3),
  parallel_group text,
  duration_ms integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12,6) not null default 0,
  error_code text,
  error_message text,
  idempotency_key text not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id, idempotency_key)
);

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid not null references public.runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  version integer not null check (version > 0),
  status public.artifact_status not null default 'current',
  source_stage text not null,
  content jsonb not null,
  parent_artifact_id uuid references public.artifacts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, type, version)
);

create table public.shots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid not null references public.runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  shot_code text not null,
  sort_order integer not null,
  start_seconds numeric(10,3) not null check (start_seconds >= 0),
  end_seconds numeric(10,3) not null check (end_seconds > start_seconds),
  scene text not null,
  purpose text not null,
  framing text not null,
  camera text not null,
  action text not null,
  dialogue text,
  sound text not null,
  transition text not null,
  asset_ids text[] not null default '{}',
  prompt text not null,
  generation_status text not null default 'ready',
  created_at timestamptz not null default now(),
  unique (run_id, shot_code)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid not null references public.runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_code text not null,
  name text not null,
  type text not null,
  status public.asset_status not null default 'planned',
  prompt text not null,
  storage_path text,
  thumbnail_path text,
  variant_of text,
  shot_codes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, asset_code)
);

create table public.run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sequence bigint not null,
  type text not null,
  stage text,
  title text not null,
  detail text not null,
  metrics jsonb,
  sanitized boolean not null default true,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (run_id, sequence),
  unique (run_id, idempotency_key),
  check (sanitized = true)
);

create table public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.runs(id) on delete cascade,
  provider text not null check (provider in ('openai')),
  ciphertext bytea not null,
  iv bytea not null,
  auth_tag bytea not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (run_id, provider),
  check (expires_at <= created_at + interval '1 hour 1 minute')
);

create index projects_user_updated_idx on public.projects(user_id, updated_at desc);
create index runs_project_created_idx on public.runs(project_id, created_at desc);
create index stage_runs_run_stage_idx on public.stage_runs(run_id, stage, attempt desc);
create index artifacts_project_type_idx on public.artifacts(project_id, type, version desc);
create index shots_run_order_idx on public.shots(run_id, sort_order);
create index assets_run_type_idx on public.assets(run_id, type);
create index run_events_run_sequence_idx on public.run_events(run_id, sequence);
create index credentials_expiry_idx on public.provider_credentials(expires_at);

create function public.touch_updated_at() returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_touch_updated_at before update on public.projects for each row execute function public.touch_updated_at();
create trigger assets_touch_updated_at before update on public.assets for each row execute function public.touch_updated_at();

create function public.delete_expired_provider_credentials() returns integer language plpgsql security definer set search_path = public as $$
declare deleted_count integer;
begin
  delete from public.provider_credentials where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke all on function public.delete_expired_provider_credentials() from public, anon, authenticated;

alter table public.projects enable row level security;
alter table public.runs enable row level security;
alter table public.stage_runs enable row level security;
alter table public.artifacts enable row level security;
alter table public.shots enable row level security;
alter table public.assets enable row level security;
alter table public.run_events enable row level security;
alter table public.provider_credentials enable row level security;

create policy projects_owner_all on public.projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy runs_owner_all on public.runs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy stage_runs_owner_all on public.stage_runs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy artifacts_owner_all on public.artifacts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy shots_owner_all on public.shots for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy assets_owner_all on public.assets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy run_events_owner_select on public.run_events for select using (user_id = auth.uid());
create policy credentials_owner_select on public.provider_credentials for select using (user_id = auth.uid());
create policy credentials_owner_insert on public.provider_credentials for insert with check (user_id = auth.uid());
create policy credentials_owner_update on public.provider_credentials for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy credentials_owner_delete on public.provider_credentials for delete using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit)
values ('storyforge-assets', 'storyforge-assets', false, 52428800)
on conflict (id) do nothing;

create policy storyforge_storage_select on storage.objects for select to authenticated
using (bucket_id = 'storyforge-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storyforge_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'storyforge-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storyforge_storage_update on storage.objects for update to authenticated
using (bucket_id = 'storyforge-assets' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'storyforge-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storyforge_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'storyforge-assets' and (storage.foldername(name))[1] = auth.uid()::text);

alter publication supabase_realtime add table public.runs;
alter publication supabase_realtime add table public.stage_runs;
alter publication supabase_realtime add table public.artifacts;
alter publication supabase_realtime add table public.shots;
alter publication supabase_realtime add table public.assets;
alter publication supabase_realtime add table public.run_events;
