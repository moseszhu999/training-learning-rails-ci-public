-- Public-safe synthetic prerequisite schema for isolated PR #339 replay.
-- It contains no production data and only the canonical owner shapes required by
-- the selected exercise and W3A migration chain.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END;
$$;

create table if not exists auth.users (
  id uuid primary key,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    jsonb_build_object(
      'sub', nullif(current_setting('request.jwt.claim.sub', true), ''),
      'role', nullif(current_setting('request.jwt.claim.role', true), '')
    )
  );
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt()->>'role',
    nullif(current_setting('request.jwt.claim.role', true), '')
  );
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student',
  display_name text not null default '',
  employee_or_student_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_isolated_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(
    id, role, display_name, employee_or_student_number
  ) values (
    new.id,
    'student',
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    coalesce(new.raw_user_meta_data->>'employee_or_student_number', '')
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists isolated_auth_user_profile on auth.users;
create trigger isolated_auth_user_profile
after insert on auth.users
for each row execute function public.handle_isolated_auth_user();

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  invitation_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_memberships (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(class_id, student_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_teacher_for_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.classes c
    where c.id = p_class_id and c.teacher_id = auth.uid()
  );
$$;

create or replace function public.is_approved_member(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.class_memberships m
    where m.class_id = p_class_id
      and m.student_id = auth.uid()
      and m.status = 'approved'
  );
$$;

create or replace function public.can_access_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_teacher_for_class(p_class_id)
      or public.is_approved_member(p_class_id);
$$;

create table if not exists public.trainingos_courses (
  id uuid primary key default gen_random_uuid(),
  course_code text not null unique,
  course_name text not null,
  status text not null default 'active',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete cascade,
  title text not null default '',
  prompt text not null default '',
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.source_assets (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.material_units (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  course_key text not null,
  source_filename text not null default '',
  chapter_title text not null default '',
  title text not null,
  sequence_no integer not null,
  unit_kind text not null default 'instruction',
  default_teaching_minutes integer not null default 35,
  default_practice_minutes integer not null default 20,
  status text not null default 'draft',
  source_outline text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(class_id, course_key, sequence_no)
);

create table if not exists public.unit_exercises (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  unit_id uuid not null references public.material_units(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  title text not null,
  prompt text not null default '',
  exercise_scope text not null default 'immediate',
  source_kind text not null default 'teacher_existing',
  source_filename text not null default '',
  review_state text not null default 'approved',
  sort_order integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(unit_id, source_filename, title)
);

create table if not exists public.jhc_process_node_confirmations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  node_key text not null,
  status text not null default 'pending_confirmation',
  system_check jsonb not null default '{}'::jsonb,
  confirmation_digest text,
  request_digest text,
  execution_id uuid,
  version_no integer not null default 1,
  created_by uuid not null references public.profiles(id) on delete restrict,
  confirmed_by uuid references public.profiles(id) on delete restrict,
  confirmed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(class_id, node_key)
);

create table if not exists public.trainingos_agent_executions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete restrict,
  workflow_type text not null default '',
  workflow_key text not null default '',
  status text not null default 'draft',
  version_no integer not null default 1,
  input_digest text,
  output_digest text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jhc_process_node_confirmations
  add constraint isolated_confirmation_execution_fk
  foreign key (execution_id)
  references public.trainingos_agent_executions(id)
  on delete restrict;

create table if not exists public.trainingos_curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.trainingos_courses(id) on delete cascade,
  shared_structure_key text not null,
  version_code text not null,
  version_name text not null,
  locale text not null default 'ja-JP',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trainingos_class_catalog (
  id uuid primary key default gen_random_uuid(),
  source_class_id uuid not null references public.classes(id) on delete cascade,
  curriculum_version_id uuid not null references public.trainingos_curriculum_versions(id) on delete restrict,
  class_code text not null,
  class_name text not null,
  organization_name text not null default '',
  locale text not null default 'ja-JP',
  status text not null default 'active',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
grant select on public.profiles, public.classes, public.class_memberships to authenticated;
grant select on public.trainingos_courses, public.questions, public.material_units, public.unit_exercises to authenticated;
