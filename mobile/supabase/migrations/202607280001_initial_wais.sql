create extension if not exists pgcrypto;

create type public.wais_role as enum ('student', 'teacher', 'guardian', 'admin');
create type public.learning_style as enum (
  'visual',
  'auditory',
  'reading',
  'kinesthetic',
  'balanced'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.wais_role not null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  grade_level integer check (grade_level between 1 and 12),
  section text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  primary_style public.learning_style not null,
  scores jsonb not null default '{}'::jsonb,
  assessment_version integer not null default 1,
  completed_at timestamptz not null,
  guardian_acknowledged_at timestamptz,
  cloud_sync_allowed boolean not null default false,
  ai_diagnostics_allowed boolean not null default false,
  notice_version text not null default '2026-07'
);

create table public.modules (
  id text primary key,
  title text not null,
  subject text not null,
  grade_level integer not null check (grade_level between 1 and 12),
  quarter integer not null check (quarter between 1 and 4),
  competency_code text not null,
  summary text not null default '',
  content_style_tags public.learning_style[] not null default '{}',
  storage_path text,
  package_sha256 text,
  package_size_bytes bigint check (package_size_bytes is null or package_size_bytes >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.teacher_students (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, student_id)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  module_id text not null references public.modules(id) on delete restrict,
  score integer not null check (score >= 0),
  total_items integer not null check (total_items > 0 and score <= total_items),
  mastery_level text not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  attempt_number integer not null check (attempt_number between 1 and 2),
  weak_topic text not null default '',
  strong_topic text not null default '',
  response_timing jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (student_id, client_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    'student',
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'WAIS Student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.learning_profiles enable row level security;
alter table public.modules enable row level security;
alter table public.teacher_students enable row level security;
alter table public.quiz_attempts enable row level security;

create policy "profiles read self or linked teacher"
on public.profiles for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.teacher_students ts
    where ts.teacher_id = auth.uid() and ts.student_id = profiles.id
  )
);

create policy "profiles update self"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "learning profiles read self or linked teacher"
on public.learning_profiles for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.teacher_students ts
    where ts.teacher_id = auth.uid() and ts.student_id = learning_profiles.user_id
  )
);

create policy "learning profiles write self"
on public.learning_profiles for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "published modules readable for dataset download"
on public.modules for select
to anon, authenticated
using (published or created_by = auth.uid());

create policy "teachers create modules"
on public.modules for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('teacher', 'admin')
  )
);

create policy "module owners update modules"
on public.modules for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "teacher links visible to participants"
on public.teacher_students for select
using (teacher_id = auth.uid() or student_id = auth.uid());

create policy "teachers manage their links"
on public.teacher_students for all
using (teacher_id = auth.uid())
with check (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('teacher', 'admin')
  )
);

create policy "attempts read self or linked teacher"
on public.quiz_attempts for select
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.teacher_students ts
    where ts.teacher_id = auth.uid() and ts.student_id = quiz_attempts.student_id
  )
);

create policy "students insert own attempts with consent"
on public.quiz_attempts for insert
with check (
  student_id = auth.uid()
  and exists (
    select 1 from public.learning_profiles lp
    where lp.user_id = auth.uid() and lp.cloud_sync_allowed
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'module-packages',
  'module-packages',
  false,
  104857600,
  array['application/pdf']
)
on conflict (id) do nothing;

create policy "published module packages downloadable for setup"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'module-packages'
  and exists (
    select 1 from public.modules m
    where m.storage_path = name and (m.published or m.created_by = auth.uid())
  )
);

create policy "teachers upload module packages"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'module-packages'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('teacher', 'admin')
  )
);
