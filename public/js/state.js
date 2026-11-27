// Shared app state and data loaders.
import { getSupabase } from './supabaseClient.js';
import { isCourseComplete } from './checklistLogic.js';

export const state = {
  session: null,
  profile: null, // { id, username, email, role }
  modules: [], // [{ id, module_number, title, difficulty, description, myths_json, lessons: [{id, title, lesson_order}] }]
  progress: new Map(), // lesson_id -> { completed, quiz_score }
  checklist: null, // user_checklist_status row, or null if the user has none yet
  checklistLoaded: false,
  loaded: false
};

export const isAdmin = () => state.profile?.role === 'admin';

export async function loadProfile() {
  const supabase = await getSupabase();
  const [{ data, error }] = await Promise.all([
    supabase.from('profiles').select('id, username, email, role').eq('id', state.session.user.id).maybeSingle(),
    loadChecklistStatus().catch((e) => console.error('[checklist status]', e))
  ]);
  if (error) throw error;
  state.profile = data || { id: state.session.user.id, email: state.session.user.email, role: 'student' };
  return state.profile;
}

export async function loadChecklistStatus() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('user_checklist_status')
    .select('baseline_completed_at, baseline_score, final_completed_at, final_score, total_items')
    .eq('user_id', state.session.user.id)
    .maybeSingle();
  if (error) throw error;
  state.checklist = data;
  state.checklistLoaded = true;
  return data;
}

/** New users are sent to the Security Checklist until they save a baseline. */
export const needsBaseline = () => state.checklistLoaded && !state.checklist?.baseline_completed_at;

/** All modules finished (needs loadCurriculum first). */
export const courseComplete = () => isCourseComplete(state.modules, state.progress);

export async function loadCurriculum(force = false) {
  if (state.loaded && !force) return;
  const supabase = await getSupabase();
  const [mods, lessons, prog] = await Promise.all([
    supabase.from('modules').select('id, module_number, title, difficulty, description, myths_json').order('module_number'),
    supabase.from('lessons').select('id, module_id, lesson_order, title').order('lesson_order'),
    supabase.from('user_progress').select('lesson_id, completed, quiz_score').eq('user_id', state.session.user.id)
  ]);
  for (const r of [mods, lessons, prog]) if (r.error) throw r.error;
  state.modules = mods.data.map((m) => ({
    ...m,
    myths_json: Array.isArray(m.myths_json) ? m.myths_json : [],
    lessons: lessons.data.filter((l) => l.module_id === m.id)
  }));
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
  Object.assign(state, {
    session: null,
    profile: null,
    modules: [],
    progress: new Map(),
    checklist: null,
    checklistLoaded: false,
    loaded: false
  });
}
