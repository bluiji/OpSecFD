// Shared app state and data loaders.
import { getSupabase } from './supabaseClient.js';

export const state = {
  session: null,
  profile: null, // { id, username, email, role }
  modules: [], // [{ id, module_number, title, difficulty, description, lessons: [{id, title, lesson_order}] }]
  progress: new Map(), // lesson_id -> { completed, quiz_score }
  loaded: false
};

export const isAdmin = () => state.profile?.role === 'admin';

export async function loadProfile() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, email, role')
    .eq('id', state.session.user.id)
    .maybeSingle();
  if (error) throw error;
  state.profile = data || { id: state.session.user.id, email: state.session.user.email, role: 'student' };
  return state.profile;
}

export async function loadCurriculum(force = false) {
  if (state.loaded && !force) return;
  const supabase = await getSupabase();
  const [mods, lessons, prog] = await Promise.all([
    supabase.from('modules').select('id, module_number, title, difficulty, description').order('module_number'),
    supabase.from('lessons').select('id, module_id, lesson_order, title').order('lesson_order'),
    supabase.from('user_progress').select('lesson_id, completed, quiz_score').eq('user_id', state.session.user.id)
  ]);
  for (const r of [mods, lessons, prog]) if (r.error) throw r.error;
  state.modules = mods.data.map((m) => ({ ...m, lessons: lessons.data.filter((l) => l.module_id === m.id) }));
  state.progress = new Map(prog.data.map((p) => [p.lesson_id, p]));
  state.loaded = true;
}

export function stats() {
  const all = state.modules.flatMap((m) => m.lessons);
  const done = all.filter((l) => state.progress.get(l.id)?.completed).length;
  const modulesDone = state.modules.filter(
    (m) => m.lessons.length && m.lessons.every((l) => state.progress.get(l.id)?.completed)
  ).length;
  const scores = [...state.progress.values()].map((p) => p.quiz_score).filter(Number.isInteger);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  return { total: all.length, done, modulesDone, avg };
}

export function clearState() {
  Object.assign(state, { session: null, profile: null, modules: [], progress: new Map(), loaded: false });
}
