import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

function load(file, name, injected) {
  const code = stripTypeScriptTypes(fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8')
    .replace(/^import .*;\n/gm,'').replace(/export /g,''));
  const context=vm.createContext({console:{warn(){}},...injected});
  vm.runInContext(`${code}\nglobalThis.Subject=${name}`,context);
  return context.Subject;
}
function deferred() { let resolve; const promise=new Promise((r)=>resolve=r); return {promise,resolve}; }
function fixture(id='w1', userId='u1') {
  return {id,userId,title:'Workout',scheduledDate:'2026-10-05',status:'planned',exercises:[{id:`${id}_e`,exerciseId:'e1',exerciseName:'Squat',muscleGroup:'legs',sets:[{id:`${id}_s`,weight:20,actualReps:null,completedAt:null}]}]};
}
function storage(cloud={}) {return load('src/services/storageService.ts','StorageService',{CloudStorageService:{saveWorkout:async()=>true,saveExercise:async()=>true,...cloud}});}

test('refresh accepts remote edits, additions, removals and remote workout deletion',()=>{
  const S=storage(); S.setWorkoutsForUser('u1',[fixture()]);
  const remote=fixture(); remote.exercises[0].sets[0].weight=80;remote.exercises.push({id:'extra',exerciseId:'e2',sets:[]});
  S.setWorkoutsForUser('u1',[remote]);
  assert.equal(S.getWorkoutById('w1').exercises.length,2);
  assert.equal(S.getWorkoutById('w1').exercises[0].sets[0].weight,80);
  remote.exercises=[];S.setWorkoutsForUser('u1',[remote]);assert.equal(S.getWorkoutById('w1').exercises.length,0);
  S.setWorkoutsForUser('u2',[fixture('other','u2')]);S.setWorkoutsForUser('u1',[]);
  assert.equal(S.getWorkouts('u1').length,0);assert.equal(S.getWorkouts('u2').length,1);
});
test('pending/failed edits survive refresh; acknowledged edits eventually accept cloud changes',async()=>{
  const gate=deferred(); const S=storage({saveWorkout:()=>gate.promise});
  const edited=fixture();edited.title='Local edit';const saving=S.saveWorkout(edited,false);
  S.setWorkoutsForUser('u1',[fixture()]);assert.equal(S.getWorkoutById('w1').title,'Local edit');
  gate.resolve(false);assert.equal(await saving,false);S.setWorkoutsForUser('u1',[]);assert.equal(S.getWorkouts('u1').length,1);
});
test('a response started before a successful save cannot overwrite that save',async()=>{
  const S=storage(); S.setWorkoutsForUser('u1',[fixture()]);
  const stale=[fixture()];S.markWorkoutsFetched(stale,S.getWorkoutRevision());
  const edited=fixture();edited.title='New title';await S.saveWorkout(edited,false);
  S.setWorkoutsForUser('u1',stale);assert.equal(S.getWorkoutById('w1').title,'New title');
  const remote=fixture();remote.title='Newer on phone';S.setWorkoutsForUser('u1',[remote]);
  assert.equal(S.getWorkoutById('w1').title,'Newer on phone');
});
test('migration waits for workouts and only remaps the target user',async()=>{
  let copies=0; const saves=[];const S=storage({saveExercise:async()=>{copies++;return true;},saveWorkout:async(w)=>{saves.push(w);return true;}});
  S.saveExercise({id:'global_ex_1',userId:null,isDefault:true,name:'Bench',muscleGroup:'chest'});
  await S.migrateGlobalExercisesToUser('u1');assert.equal(copies,0);
  const w=fixture();w.exercises[0].exerciseId='global_ex_1';
  const other=fixture('other','u2');other.assignedByCoachId='u1';other.exercises[0].exerciseId='global_ex_1';
  S.setWorkoutsForUser('u1',[w]);S.setWorkoutsForUser('u2',[other]);
  await Promise.all([S.migrateGlobalExercisesToUser('u1'),S.migrateGlobalExercisesToUser('u1')]);
  assert.equal(copies,1);assert.equal(S.getExercises('u1').length,1);
  assert.notEqual(S.getWorkoutById('w1').exercises[0].exerciseId,'global_ex_1');
  assert.equal(S.getWorkoutById('other').exercises[0].exerciseId,'global_ex_1');assert.equal(saves.length,1);
});
test('migration retries a failed exercise save without remapping to a missing row',async()=>{
  let ok=false; const S=storage({saveExercise:async()=>ok});
  S.saveExercise({id:'global_ex_1',userId:null,isDefault:true,name:'Bench'});
  const w=fixture();w.exercises[0].exerciseId='global_ex_1';S.setWorkoutsForUser('u1',[w]);
  await S.migrateGlobalExercisesToUser('u1');assert.equal(S.getExercises('u1').length,0);
  assert.equal(S.getWorkoutById('w1').exercises[0].exerciseId,'global_ex_1');
  ok=true;await S.migrateGlobalExercisesToUser('u1');assert.equal(S.getExercises('u1').length,1);
});
test('archiving a catalog exercise preserves completed history and respects denial',async()=>{
  let ok=false;const S=storage({deleteExercise:async()=>ok});S.setWorkoutsForUser('u1',[fixture()]);
  S.saveExercise({id:'e1',name:'Squat',userId:'u1'});
  assert.equal(await S.deleteExercise('e1'),false);assert.equal(S.getExercises('u1').length,1);
  ok=true;assert.equal(await S.deleteExercise('e1'),true);assert.equal(S.getExercises('u1').length,0);
  assert.equal(S.getWorkoutById('w1').exercises[0].sets.length,1);
});
for (const [label,file,name] of [['web','src/services/cloudStorageService.ts','CloudStorageService'],['mobile','mobile/src/services/workoutService.ts','WorkoutService']]) {
  test(`${label}: serial RPC saves return each result and snapshot payloads`,async()=>{
    const gate=deferred();const calls=[];const cache=new Map();
    const S=load(file,name,{isSupabaseConfigured:()=>true,StorageService:{},MobileStorage:{
      getItem:async(k,d)=>cache.get(k)||d,setItem:async(k,v)=>{cache.set(k,v);return true;}
    },supabase:{rpc:async(fn,{p_workout})=>{
      assert.equal(fn,'save_workout');calls.push(p_workout);
      if(calls.length===1){await gate.promise;return {error:{message:'invalid set'},data:null};}
      return {error:null,data:true};
    }}});
    const first=fixture();const second=fixture();second.title='Second';
    const a=S.saveWorkout(first);const b=S.saveWorkout(second);first.title='Mutated';
    await new Promise((r)=>setImmediate(r));assert.equal(calls.length,1);assert.equal(calls[0].title,'Workout');
    gate.resolve();assert.equal(await a,false);assert.equal(await b,true);assert.equal(calls[1].title,'Second');
    assert.match(calls[1].exercises[0].notes,/^\[meta:ex=Squat/);
  });
}

test('a failed catalog fetch does not mark migration complete',async()=>{
  let online=false;let copied=0;
  const global={id:'global_ex_1',userId:null,isDefault:true,name:'Bench'};
  const w=fixture();w.exercises[0].exerciseId=global.id;
  const S=storage({fetchExercises:async()=>online?[global]:null,fetchWorkouts:async()=>[w],saveExercise:async()=>{copied++;return true;}});
  await S.syncWithCloud('u1');assert.equal(copied,0);
  online=true;await S.syncWithCloud('u1');assert.equal(copied,1);
});

test('mobile unmount flushes the pending 500ms edit exactly once',()=>{
  // Execute the actual cleanup effect, with a deterministic timer and service boundary.
  const source=fs.readFileSync(new URL('../mobile/src/screens/WorkoutEditorScreen.tsx',import.meta.url),'utf8');
  const cleanupCode=source.slice(source.indexOf('  // Clean up autoSave timer'),source.indexOf('  // Central update & persist helper'));
  let cleanup;const saves=[];const cleared=[];const timer={current:123};const w=fixture();
  vm.runInNewContext(cleanupCode,{
    useEffect:(fn)=>{cleanup=fn();},autoSaveTimerRef:timer,workoutRef:{current:w},
    clearTimeout:(id)=>cleared.push(id),WorkoutService:{saveWorkout:(value)=>{saves.push(value);return Promise.resolve(true);}}
  });
  cleanup();cleanup();assert.deepEqual(cleared,[123]);assert.equal(saves.length,1);assert.equal(saves[0],w);
});

test('a read begun during a pending save cannot restore the old server snapshot',async()=>{
  const gate=deferred();const S=storage({saveWorkout:()=>gate.promise});
  const edited=fixture();edited.title='Saving';const saving=S.saveWorkout(edited,false);
  const stale=[fixture()];S.markWorkoutsFetched(stale,S.getWorkoutRevision(),S.getPendingWorkoutIds());
  gate.resolve(true);await saving;S.setWorkoutsForUser('u1',stale);
  assert.equal(S.getWorkoutById('w1').title,'Saving');
});

test('migration retries an exercise remap whose workout save failed',async()=>{
  let ok=false;let saves=0;const S=storage({saveWorkout:async()=>{saves++;return ok;}});
  S.saveExercise({id:'global_ex_1',userId:null,isDefault:true,name:'Bench'});
  const w=fixture();w.exercises[0].exerciseId='global_ex_1';S.setWorkoutsForUser('u1',[w]);
  await S.migrateGlobalExercisesToUser('u1');assert.equal(saves,1);
  ok=true;await S.migrateGlobalExercisesToUser('u1');assert.equal(saves,2);assert.equal(S.getPendingWorkoutIds().length,0);
});
