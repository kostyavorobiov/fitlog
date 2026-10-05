-- FitLog: apply the entire file in Supabase SQL Editor to an existing database.
-- Transactional and rerunnable. No existing workout/profile data is removed.
begin;

create schema if not exists fitlog_private;
revoke all on schema fitlog_private from public, anon, authenticated;
grant usage on schema fitlog_private to authenticated;

create or replace function fitlog_private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function fitlog_private.can_manage_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    p_user_id = auth.uid() or fitlog_private.is_admin() or exists (
      select 1 from public.profiles trainee join public.profiles coach on coach.id = trainee.coach_id
      where trainee.id = p_user_id and coach.id = auth.uid() and coach.role in ('coach', 'admin')
    )
  );
$$;
revoke all on function fitlog_private.is_admin(), fitlog_private.can_manage_user(uuid) from public, anon;
grant execute on function fitlog_private.is_admin(), fitlog_private.can_manage_user(uuid) to authenticated;

-- RLS cannot protect individual columns. This invoker trigger protects privileged
-- fields on direct API writes; trusted definer functions/SQL Editor can manage them.
create or replace function fitlog_private.guard_profile()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      -- ON CONFLICT also invokes INSERT triggers; UPDATE guard checks the existing row.
      if new.id = auth.uid() and exists (select 1 from public.profiles where id = new.id) then return new; end if;
      if new.id is distinct from auth.uid() or new.role = 'admin' or new.coach_id is not null
        or new.email is distinct from (auth.jwt()->>'email') then
        raise exception 'Invalid profile creation' using errcode = '42501';
      end if;
    elsif new.id is distinct from old.id or new.email is distinct from old.email
      or new.profile_code is distinct from old.profile_code
      or new.coach_id is distinct from old.coach_id
      or (new.role is distinct from old.role and (new.role = 'admin' or old.role = 'admin')) then
      raise exception 'Protected profile fields must be managed by trusted server operations' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists fitlog_guard_profile on public.profiles;
create trigger fitlog_guard_profile before insert or update on public.profiles
for each row execute function fitlog_private.guard_profile();

-- Replace policies on FitLog tables, including permissive policies from older revisions.
do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('profiles','exercises','workouts','workout_exercises','workout_sets')
  loop execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename); end loop;
end $$;
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
revoke all on public.profiles, public.exercises, public.workouts, public.workout_exercises, public.workout_sets from public, anon;
revoke all on public.profiles, public.exercises, public.workouts, public.workout_exercises, public.workout_sets from authenticated;
grant select, insert, update on public.profiles, public.exercises to authenticated;
grant select, insert, update, delete on public.workouts, public.workout_exercises, public.workout_sets to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy workouts_access on public.workouts for all to authenticated
using (fitlog_private.can_manage_user(user_id)) with check (fitlog_private.can_manage_user(user_id));
create policy workout_exercises_access on public.workout_exercises for all to authenticated
using (exists (select 1 from public.workouts w where w.id = workout_id))
with check (exists (select 1 from public.workouts w where w.id = workout_id));
create policy workout_sets_access on public.workout_sets for all to authenticated
using (exists (select 1 from public.workout_exercises we where we.id = workout_exercise_id))
with check (exists (select 1 from public.workout_exercises we where we.id = workout_exercise_id));

create policy exercises_read on public.exercises for select to authenticated using (
  user_id is null or is_default or fitlog_private.can_manage_user(user_id)
  or user_id = (select coach_id from public.profiles where id = auth.uid())
  or exists (select 1 from public.workout_exercises we where we.exercise_id = exercises.id)
);
create policy exercises_insert on public.exercises for insert to authenticated with check (
  fitlog_private.is_admin() or (not is_default and fitlog_private.can_manage_user(user_id))
);
create policy exercises_update on public.exercises for update to authenticated using (
  fitlog_private.is_admin() or (not is_default and fitlog_private.can_manage_user(user_id))
) with check (
  fitlog_private.is_admin() or (not is_default and fitlog_private.can_manage_user(user_id))
);

-- A catalog deletion must never cascade into recorded performance history.
do $$ declare c record; begin
  for c in select conname from pg_constraint
    where conrelid = 'public.workout_exercises'::regclass and confrelid = 'public.exercises'::regclass and contype = 'f'
  loop execute format('alter table public.workout_exercises drop constraint %I', c.conname); end loop;
end $$;
alter table public.workout_exercises add constraint workout_exercises_exercise_id_fkey
foreign key (exercise_id) references public.exercises(id) on delete restrict;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare full_name text;
begin
  full_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  insert into public.profiles (id, profile_code, email, first_name, last_name, name, avatar_url, role)
  values (new.id, 'u_' || substr(md5(new.id::text), 1, 16), new.email,
    coalesce(new.raw_user_meta_data->>'first_name', split_part(full_name, ' ', 1)),
    coalesce(new.raw_user_meta_data->>'last_name', nullif(substr(full_name, length(split_part(full_name, ' ', 1)) + 2), ''), ''),
    full_name, coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    case when new.raw_user_meta_data->>'role' = 'coach' then 'coach' else 'athlete' end)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.assign_trainee_to_coach(p_coach_id uuid, p_trainee_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_coach_id = p_trainee_id then return false; end if;
  if not (auth.uid() = p_coach_id or auth.uid() = p_trainee_id or fitlog_private.is_admin()) then return false; end if;
  if not exists (select 1 from public.profiles where id = p_coach_id and role in ('coach','admin')) then return false; end if;
  update public.profiles set coach_id = p_coach_id, updated_at = now()
  where id = p_trainee_id and role = 'athlete'
    and (coach_id is null or coach_id = p_coach_id or fitlog_private.is_admin());
  return found;
end;
$$;
create or replace function public.unlink_trainee(p_trainee_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  update public.profiles set coach_id = null, updated_at = now()
  where id = p_trainee_id and (id = auth.uid() or coach_id = auth.uid() or fitlog_private.is_admin());
  return found;
end;
$$;
create or replace function public.get_profile_by_id(p_user_id uuid)
returns setof public.profiles language sql security invoker set search_path = '' as $$
  select * from public.profiles where id = p_user_id;
$$;
create or replace function public.get_coach_trainees(p_coach_id uuid)
returns setof public.profiles language sql security invoker set search_path = '' as $$
  select * from public.profiles where coach_id = p_coach_id
    and (p_coach_id = auth.uid() or fitlog_private.is_admin());
$$;
create or replace function public.save_exercise(p_id text, p_user_id uuid, p_name text,
  p_muscle_group text, p_description text, p_is_default boolean)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.exercises (id,user_id,name,muscle_group,description,is_default)
  values (p_id,p_user_id,p_name,p_muscle_group,coalesce(p_description,''),coalesce(p_is_default,false))
  on conflict (id) do update set user_id=excluded.user_id, name=excluded.name,
    muscle_group=excluded.muscle_group, description=excluded.description, is_default=excluded.is_default;
  return true;
end;
$$;
create or replace function public.delete_exercise_by_id(p_exercise_id text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.exercises set description = '__FITLOG_DELETED__' where id = p_exercise_id;
  return found;
end;
$$;
create or replace function public.cleanup_unused_exercises()
returns integer language plpgsql security definer set search_path = '' as $$
declare deleted_count integer;
begin
  if not fitlog_private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  delete from public.exercises e where (e.is_default or e.user_id is null)
    and not exists (select 1 from public.workout_exercises we where we.exercise_id = e.id);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- All writes below execute in the RPC transaction with the caller's RLS permissions.
-- An invalid set or a forbidden child ID aborts the entire workout save.
create or replace function public.save_workout(p_workout jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  workout_id_value text := p_workout->>'id';
  ex jsonb;
  item jsonb;
  ex_ids text[] := '{}';
  set_ids text[];
  all_set_ids text[] := '{}';
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if coalesce(workout_id_value, '') = '' or jsonb_typeof(p_workout->'exercises') is distinct from 'array' then
    raise exception 'Invalid workout payload';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(workout_id_value, 0));
  insert into public.workouts (id,user_id,assigned_by_coach_id,title,scheduled_date,status,completed_at,notes,duration_minutes,created_at,updated_at)
  values (workout_id_value,(p_workout->>'userId')::uuid,(p_workout->>'assignedByCoachId')::uuid,
    coalesce(nullif(p_workout->>'title',''),'Тренування'),p_workout->>'scheduledDate',p_workout->>'status',
    (p_workout->>'completedAt')::timestamptz,coalesce(p_workout->>'notes',''),(p_workout->>'durationMinutes')::integer,
    coalesce((p_workout->>'createdAt')::timestamptz,now()),now())
  on conflict (id) do update set user_id=excluded.user_id, assigned_by_coach_id=excluded.assigned_by_coach_id,
    title=excluded.title,scheduled_date=excluded.scheduled_date,status=excluded.status,completed_at=excluded.completed_at,
    notes=excluded.notes,duration_minutes=excluded.duration_minutes,updated_at=now();

  for ex in select value from jsonb_array_elements(p_workout->'exercises') loop
    if coalesce(ex->>'id','') = '' or (ex->>'id') = any(ex_ids)
      or jsonb_typeof(ex->'sets') is distinct from 'array' then raise exception 'Invalid or duplicate workout exercise'; end if;
    if not exists (select 1 from public.exercises where id = ex->>'exerciseId') then
      raise exception 'Exercise unavailable' using errcode = '42501';
    end if;
    ex_ids := array_append(ex_ids, ex->>'id');
    insert into public.workout_exercises (id,workout_id,exercise_id,order_index,set_count,target_reps_range,notes,superset_group_id)
    values (ex->>'id',workout_id_value,ex->>'exerciseId',coalesce((ex->>'order')::integer,array_length(ex_ids,1)),
      jsonb_array_length(ex->'sets'),coalesce(ex->>'targetRepsRange','8-12'),coalesce(ex->>'notes',''),ex->>'supersetGroupId')
    on conflict (id) do update set exercise_id=excluded.exercise_id,order_index=excluded.order_index,set_count=excluded.set_count,
      target_reps_range=excluded.target_reps_range,notes=excluded.notes,superset_group_id=excluded.superset_group_id
    where public.workout_exercises.workout_id = workout_id_value;
    if not found then raise exception 'Workout exercise belongs to another workout' using errcode = '42501'; end if;
    set_ids := '{}';
    for item in select value from jsonb_array_elements(ex->'sets') loop
      if coalesce(item->>'id','') = '' or (item->>'id') = any(all_set_ids) then raise exception 'Invalid or duplicate set'; end if;
      set_ids := array_append(set_ids,item->>'id');
      all_set_ids := array_append(all_set_ids,item->>'id');
      insert into public.workout_sets (id,workout_exercise_id,set_number,target_reps_range,weight,actual_reps,completed_at,notes,is_warmup)
      values (item->>'id',ex->>'id',coalesce((item->>'setNumber')::integer,array_length(set_ids,1)),
        coalesce(item->>'targetRepsRange','8-12'),coalesce((item->>'weight')::numeric,0),(item->>'actualReps')::integer,
        (item->>'completedAt')::timestamptz,coalesce(item->>'notes',''),coalesce((item->>'isWarmup')::boolean,false))
      on conflict (id) do update set set_number=excluded.set_number,target_reps_range=excluded.target_reps_range,
        weight=excluded.weight,actual_reps=excluded.actual_reps,completed_at=excluded.completed_at,notes=excluded.notes,is_warmup=excluded.is_warmup
      where public.workout_sets.workout_exercise_id = ex->>'id';
      if not found then raise exception 'Set belongs to another exercise' using errcode = '42501'; end if;
    end loop;
    delete from public.workout_sets where workout_exercise_id = ex->>'id' and not (id = any(set_ids));
  end loop;
  delete from public.workout_exercises where workout_id = workout_id_value and not (id = any(ex_ids));
  return true;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.assign_trainee_to_coach(uuid,uuid), public.unlink_trainee(uuid),
  public.get_profile_by_id(uuid), public.get_coach_trainees(uuid),
  public.save_exercise(text,uuid,text,text,text,boolean), public.delete_exercise_by_id(text),
  public.cleanup_unused_exercises(), public.save_workout(jsonb) from public, anon;
grant execute on function public.assign_trainee_to_coach(uuid,uuid), public.unlink_trainee(uuid),
  public.get_profile_by_id(uuid), public.get_coach_trainees(uuid),
  public.save_exercise(text,uuid,text,text,text,boolean), public.delete_exercise_by_id(text),
  public.cleanup_unused_exercises(), public.save_workout(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
