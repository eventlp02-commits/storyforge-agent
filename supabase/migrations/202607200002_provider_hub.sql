alter table public.provider_credentials
  drop constraint if exists provider_credentials_provider_check;

alter table public.provider_credentials
  add constraint provider_credentials_provider_check
  check (provider ~ '^(llm|image|video):[a-zA-Z0-9._-]+$');

alter table public.shots
  add column if not exists media_url text,
  add column if not exists provider_job_id text,
  add column if not exists media_provider text;
