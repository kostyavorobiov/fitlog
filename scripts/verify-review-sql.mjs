import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.FITLOG_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
`);
await db.exec(await readFile(new URL('../supabase_schema.sql', import.meta.url), 'utf8'));
const ids = { athlete: '00000000-0000-0000-0000-000000000001', other: '00000000-0000-0000-0000-000000000002', coach: '00000000-0000-0000-0000-000000000003', admin: '00000000-0000-0000-0000-000000000004' };
for (const [name,id] of Object.entries(ids)) {
  await db.query('insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)', [id,`${name}@example.com`,JSON.stringify({role: name === 'coach' ? 'coach' : 'admin'})]);
}
assert.equal((await db.query('select role from public.profiles where id=$1',[ids.athlete])).rows[0].role,'athlete');
await db.query("update public.profiles set role='admin' where id=$1",[ids.admin]);
// Simulate a permissive policy left by an older installation, then upgrade twice.
await db.exec('create policy legacy_open_update on public.profiles for update to authenticated using (true) with check (true)');
const migration = await readFile(new URL('../supabase/migrations/202610050001_secure_sync.sql', import.meta.url),'utf8');
await db.exec(migration); await db.exec(migration);
assert.equal((await db.query('select count(*)::int as n from public.profiles')).rows[0].n,4);

async function asUser(name, fn) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [ids[name] || '', JSON.stringify({email:`${name}@example.com`})]);
  await db.exec(`set role ${name === 'anon' ? 'anon' : 'authenticated'}`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
async function denied(sql, args=[]) { await assert.rejects(db.query(sql,args)); }
async function scalar(sql,args=[]) { return Object.values((await db.query(sql,args)).rows[0])[0]; }
const ex = (id,userId) => db.query("select public.save_exercise($1,$2,'Squat','legs','',false)",[id,userId]);
const workout = (id,userId,exerciseId='e1') => ({id,userId,title:'Before',scheduledDate:'2026-10-05',status:'in_progress',exercises:[{id:`${id}_ex`,exerciseId,order:1,sets:[{id:`${id}_set`,setNumber:1,weight:20,actualReps:8}]}]});
const save = (w) => db.query('select public.save_workout($1::jsonb)',[JSON.stringify(w)]);
await asUser('athlete', async () => {
  await denied("update public.profiles set role='admin' where id=$1",[ids.athlete]);
  assert.equal((await db.query("update public.profiles set first_name='Hacked' where id=$1 returning id",[ids.other])).rows.length,0);
  await denied('update public.profiles set coach_id=$1 where id=$2',[ids.coach,ids.athlete]);
});
await asUser('athlete', async () => {
  await ex('e1',ids.athlete);
  await denied("select public.save_exercise('e2',$1,'Foreign','legs','',false)",[ids.other]);
  await save(workout('w1',ids.athlete));
  const bad = workout('w1',ids.athlete); bad.title='Must roll back'; bad.exercises[0].sets[0].weight=100000;
  await assert.rejects(save(bad));
  assert.equal(await scalar("select title from public.workouts where id='w1'"),'Before');
  assert.equal(Number(await scalar("select weight from public.workout_sets where id='w1_set'")),20);
  await save(workout('w2',ids.athlete));
  const collision = workout('w1',ids.athlete); collision.exercises[0].id='w2_ex';
  await assert.rejects(save(collision));
  assert.equal(await scalar("select count(*)::int from public.workout_exercises where workout_id='w1'"),1);
  const setCollision = workout('w1',ids.athlete); setCollision.exercises[0].sets[0].id='w2_set';
  await assert.rejects(save(setCollision));
  assert.equal(await scalar('select public.delete_exercise_by_id($1)',['e1']),true);
  assert.equal(await scalar("select count(*)::int from public.workout_sets"),2);
  await denied("delete from public.exercises where id='e1'");
  await denied('select public.cleanup_unused_exercises()');
});
await asUser('other', async () => {
  assert.equal(await scalar("select public.delete_exercise_by_id('e1')"),false);
  await denied("select public.save_exercise('e1',$1,'Stolen','legs','',false)",[ids.other]);
  assert.equal(await scalar("select count(*)::int from public.workouts"),0);
  const forged = workout('forged',ids.athlete); forged.assignedByCoachId=ids.other;
  await assert.rejects(save(forged));
  assert.equal(await scalar('select public.assign_trainee_to_coach($1,$2)',[ids.other,ids.athlete]),false);
});
await asUser('coach', async () => {
  assert.equal(await scalar('select public.assign_trainee_to_coach($1,$2)',[ids.coach,ids.athlete]),true);
  assert.equal(await scalar('select count(*)::int from public.workouts'),2);
  await save({...workout('w1',ids.athlete),assignedByCoachId:ids.coach,title:'Coach edit'});
  assert.equal(await scalar('select public.unlink_trainee($1)',[ids.athlete]),true);
  assert.equal(await scalar('select count(*)::int from public.workouts'),0);
});
await asUser('athlete', async () => {
  await db.query("update public.profiles set first_name='Updated' where id=$1",[ids.athlete]);
  const empty = workout('w1',ids.athlete); empty.exercises=[];
  await save(empty);
  assert.equal(await scalar("select count(*)::int from public.workout_sets where id='w1_set'"),0);
});
await asUser('admin', async () => {
  assert.equal(await scalar('select count(*)::int from public.workouts'),2);
  // Existing admin upserts still work, without allowing new admin accounts.
  const profile=(await db.query('select * from public.profiles where id=$1',[ids.admin])).rows[0];
  await db.query(`insert into public.profiles (id,profile_code,email,role) values ($1,$2,$3,'admin')
    on conflict(id) do update set first_name='Admin updated'`,[profile.id,profile.profile_code,profile.email]);
});
await asUser('anon', async () => {
  await denied("select public.delete_exercise_by_id('e1')");
  await denied("select public.save_workout('{}')");
  await denied('select * from public.exercises');
});
console.log('PASS: rerunnable migration, data preservation, protected roles, tenant isolation, coach access/unlink, archive history, atomic rollback, child ID isolation, anonymous denial.');
await db.close();
