alter table public.modules
  add column if not exists manifest jsonb,
  add column if not exists version integer not null default 1,
  add column if not exists source text not null default 'supabase-ota',
  add column if not exists quiz_id text,
  add column if not exists review_items jsonb not null default '[]'::jsonb;

alter table public.quiz_attempts
  drop constraint if exists quiz_attempts_attempt_number_check;

alter table public.quiz_attempts
  add constraint quiz_attempts_attempt_number_positive
  check (attempt_number >= 1),
  add column if not exists learning_format_used text not null default 'text'
  check (learning_format_used in ('text', 'audio', 'visual', 'kinesthetic'));

comment on column public.modules.manifest is
  'Canonical curriculum manifest shared by OTA and nearby transfer sources.';
comment on column public.quiz_attempts.learning_format_used is
  'Presentation format selected for the completed attempt; no raw correct answers are synced.';
