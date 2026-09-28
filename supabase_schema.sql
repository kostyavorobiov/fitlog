-- ==============================================================================
-- Workout Diary (FitLog) — Complete PostgreSQL Schema for Supabase
-- Run this script in your Supabase Project -> SQL Editor
-- ==============================================================================

-- 1. PROFILES TABLE (Linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  profile_code text unique not null,
  email text unique not null,
  first_name text default '',
  last_name text default '',
  name text default '',
  avatar_url text default '',
  role text not null default 'athlete' check (role in ('athlete', 'coach', 'admin')),
  coach_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. EXERCISES TABLE
create table if not exists public.exercises (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade, -- null for global default exercises
  name text not null,
  muscle_group text not null,
  description text default '',
  is_default boolean default false,
  created_at timestamptz not null default now()
);

-- 3. WORKOUTS TABLE
create table if not exists public.workouts (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by_coach_id uuid references public.profiles(id) on delete set null,
  title text not null,
  scheduled_date text not null, -- YYYY-MM-DD format
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed')),
  completed_at timestamptz,
  notes text default '',
  duration_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. WORKOUT EXERCISES TABLE
create table if not exists public.workout_exercises (
  id text primary key,
  workout_id text not null references public.workouts(id) on delete cascade,
  exercise_id text not null references public.exercises(id) on delete cascade,
  order_index integer not null default 1,
  set_count integer default 3,
  target_reps_range text default '8-12',
  notes text default '',
  superset_group_id text
);

-- 5. WORKOUT SETS TABLE
create table if not exists public.workout_sets (
  id text primary key,
  workout_exercise_id text not null references public.workout_exercises(id) on delete cascade,
  set_number integer not null,
  target_reps_range text default '8-12',
  weight numeric(6, 2) default 0,
  actual_reps integer,
  completed_at timestamptz,
  notes text default '',
  is_warmup boolean default false
);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
create index if not exists idx_workouts_user_id on public.workouts(user_id);
create index if not exists idx_workouts_scheduled_date on public.workouts(scheduled_date);
create index if not exists idx_workout_exercises_workout_id on public.workout_exercises(workout_id);
create index if not exists idx_workout_sets_exercise_id on public.workout_sets(workout_exercise_id);
create index if not exists idx_exercises_user_id on public.exercises(user_id);
create index if not exists idx_profiles_coach_id on public.profiles(coach_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;

-- Profiles: Authenticated users can read all profiles (needed for coach/trainee lookup), and update their own
create policy "Allow all authenticated users to read profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Exercises: Read global default exercises OR user's custom exercises
create policy "Read default and own custom exercises"
  on public.exercises for select
  to authenticated
  using (user_id is null or user_id = auth.uid());

create policy "Create own custom exercises"
  on public.exercises for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Update own custom exercises"
  on public.exercises for update
  to authenticated
  using (user_id = auth.uid());

create policy "Delete own custom exercises"
  on public.exercises for delete
  to authenticated
  using (user_id = auth.uid());

-- Workouts: Athletes can read/write their own; Coaches can read/write their trainees' workouts
create policy "Read workouts"
  on public.workouts for select
  to authenticated
  using (
    user_id = auth.uid() or
    assigned_by_coach_id = auth.uid() or
    exists (
      select 1 from public.profiles
      where profiles.id = workouts.user_id and profiles.coach_id = auth.uid()
    )
  );

create policy "Insert workouts"
  on public.workouts for insert
  to authenticated
  with check (
    user_id = auth.uid() or
    exists (
      select 1 from public.profiles
      where profiles.id = workouts.user_id and profiles.coach_id = auth.uid()
    )
  );

create policy "Update workouts"
  on public.workouts for update
  to authenticated
  using (
    user_id = auth.uid() or
    assigned_by_coach_id = auth.uid() or
    exists (
      select 1 from public.profiles
      where profiles.id = workouts.user_id and profiles.coach_id = auth.uid()
    )
  );

create policy "Delete workouts"
  on public.workouts for delete
  to authenticated
  using (
    user_id = auth.uid() or
    assigned_by_coach_id = auth.uid() or
    exists (
      select 1 from public.profiles
      where profiles.id = workouts.user_id and profiles.coach_id = auth.uid()
    )
  );

-- Workout Exercises & Sets: inherit parent workout permission
create policy "Manage workout exercises"
  on public.workout_exercises for all
  to authenticated
  using (
    exists (
      select 1 from public.workouts
      where workouts.id = workout_exercises.workout_id and (
        workouts.user_id = auth.uid() or
        workouts.assigned_by_coach_id = auth.uid() or
        exists (
          select 1 from public.profiles
          where profiles.id = workouts.user_id and profiles.coach_id = auth.uid()
        )
      )
    )
  );

create policy "Manage workout sets"
  on public.workout_sets for all
  to authenticated
  using (
    exists (
      select 1 from public.workout_exercises
      join public.workouts on workouts.id = workout_exercises.workout_id
      where workout_exercises.id = workout_sets.workout_exercise_id and (
        workouts.user_id = auth.uid() or
        workouts.assigned_by_coach_id = auth.uid() or
        exists (
          select 1 from public.profiles
          where profiles.id = workouts.user_id and profiles.coach_id = auth.uid()
        )
      )
    )
  );

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER ON GOOGLE AUTH SIGNUP
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  raw_name text;
  first_n text;
  last_n text;
  cuid_code text;
  assigned_role text;
begin
  raw_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  first_n := split_part(raw_name, ' ', 1);
  last_n := nullif(substr(raw_name, length(first_n) + 2), '');

  -- Generate short clean profile code
  cuid_code := 'u_' || substr(md5(random()::text), 1, 10);

  -- Assign admin role if kvorobiov9@gmail.com
  if lower(new.email) = 'kvorobiov9@gmail.com' then
    assigned_role := 'admin';
  else
    assigned_role := coalesce(new.raw_user_meta_data->>'role', 'athlete');
  end if;

  insert into public.profiles (
    id,
    profile_code,
    email,
    first_name,
    last_name,
    name,
    avatar_url,
    role
  )
  values (
    new.id,
    cuid_code,
    new.email,
    coalesce(first_n, 'Атлет'),
    coalesce(last_n, ''),
    coalesce(raw_name, 'Атлет'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    assigned_role
  )
  on conflict (id) do update set
    email = excluded.email,
    avatar_url = coalesce(nullif(excluded.avatar_url, ''), profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
