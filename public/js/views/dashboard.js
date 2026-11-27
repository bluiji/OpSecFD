// Student dashboard: progress, checklist journey prompts, daily tip, and curriculum accordion.
import { getSupabase } from '../supabaseClient.js';
import { state, loadCurriculum, loadChecklistStatus, stats, courseComplete } from '../state.js';
import { checklistPhase, CHECKLIST } from '../checklistLogic.js';
import { $, $$, esc, pct, dayIndex, icons } from '../utils.js';

function moduleAccordion() {
  return state.modules
    .map((m) => {
      const done = m.lessons.filter((l) => state.progress.get(l.id)?.completed).length;
      const id = `mod-${m.id}`;
      const myths = m.myths_json.length;
      return `<div class="acc-item">
        <h3><button class="acc-head" aria-expanded="false" aria-controls="${id}">
          <span class="mod-num">${String(m.module_number).padStart(2, '0')}</span>
          <span class="mod-title">${esc(m.title)}</span>
          <span class="badge ${esc(m.difficulty.toLowerCase())}">${esc(m.difficulty)}</span>
          <span class="mod-count">${done}/${m.lessons.length}</span>
          <span class="chev" aria-hidden="true">▾</span>
        </button></h3>
        <div class="acc-body" id="${id}" hidden>
          <p class="muted">${esc(m.description || '')}</p>
          <ol class="lesson-list">
            ${m.lessons
              .map((l) => {
                const p = state.progress.get(l.id);
                const badge = p?.completed
                  ? `<span class="pill ok">${icons.check} Completed${Number.isInteger(p.quiz_score) ? ` · ${p.quiz_score}%` : ''}</span>`
                  : p
                    ? `<span class="pill warn">Attempted · ${p.quiz_score}%</span>`
                    : `<span class="pill">Not started</span>`;
                return `<li><a href="#/lesson/${l.id}">${esc(l.title)}</a>${badge}</li>`;
              })
              .join('') || '<li class="muted">No lessons yet.</li>'}
          </ol>
          ${myths ? `<a class="myth-link" href="#/module/${m.module_number}/myths"><span class="myth-tag">Mythbusters</span> ${myths} myth${myths === 1 ? '' : 's'} vs. facts for this module</a>` : ''}
        </div>
      </div>`;
    })
    .join('');
}

/** Pre-lesson and post-completion prompts for the Security Checklist. */
function journeyBanner(phase) {
  const st = state.checklist;
  const total = st?.total_items || CHECKLIST.length;
  if (phase === 'baseline') {
    return `<section class="card banner start">
      <h2>${icons.shield} Before you start: take the Security Checklist</h2>
      <p>Spend two minutes ticking the security habits you already have. It sets your baseline, so you can see how much you've improved by the end of the course.</p>
      <a class="btn primary" href="#/checklist">Start the checklist</a>
    </section>`;
  }
  if (phase === 'final') {
    return `<section class="card banner celebrate">
      <h2>You finished all 8 modules!</h2>
      <p>Now that you understand the real-world risks and why OpSec matters, go back to your Security Checklist. Review your starting answers, update them, and lock in your security practices.</p>
      <a class="btn primary" href="#/checklist">Review and lock in my practices</a>
    </section>`;
  }
  if (phase === 'done') {
    return `<section class="card banner done">
      <h2>${icons.check} Security practices locked in: ${st.final_score} of ${total}</h2>
      <p class="muted">Up from ${st.baseline_score} when you started. <a href="#/checklist">Review your checklist</a> any time.</p>
    </section>`;
  }
  return `<section class="card banner slim">
    <p><strong>Checklist baseline:</strong> ${st.baseline_score} of ${total} practices. Finish all 8 modules to unlock your re-evaluation. <a href="#/checklist">View checklist</a></p>
  </section>`;
}

export async function renderDashboard(app) {
  app.innerHTML = `<div class="loading"><div class="spinner"></div><p>Loading your dashboard…</p></div>`;
  const supabase = await getSupabase();

  const [, , tipsRes] = await Promise.all([
    loadCurriculum(true),
    loadChecklistStatus(),
    supabase.from('daily_tips').select('tip_text, category').order('id')
  ]);
  if (tipsRes.error) throw tipsRes.error;

  const tips = tipsRes.data;
  const tip = tips.length ? tips[dayIndex() % tips.length] : null;
  const s = stats();
  const overall = pct(s.done, s.total);
  const phase = checklistPhase(state.checklist, courseComplete());

  app.innerHTML = `
    <section class="dash-head">
      <div>
        <h1>Hi, ${esc(state.profile?.username || 'there')}</h1>
        <p class="muted">Pick up where you left off, or try a lab.</p>
      </div>
      <a class="btn primary" href="${phase === 'baseline' ? '#/checklist' : nextLessonHref()}">${phase === 'baseline' ? 'Start with the checklist' : 'Continue learning'}</a>
    </section>

    ${journeyBanner(phase)}

    <section class="grid four stats">
      <div class="card stat"><div class="stat-num">${overall}%</div><div class="stat-label">Course progress</div>
        <div class="progress" role="progressbar" aria-label="Course progress" aria-valuenow="${overall}" aria-valuemin="0" aria-valuemax="100"><span data-w="${overall}"></span></div></div>
      <div class="card stat"><div class="stat-num">${s.done}<small>/${s.total}</small></div><div class="stat-label">Lessons completed</div></div>
      <div class="card stat"><div class="stat-num">${s.modulesDone}<small>/${state.modules.length}</small></div><div class="stat-label">Modules completed</div></div>
      <div class="card stat"><div class="stat-num">${s.avg ?? '—'}${s.avg != null ? '<small>%</small>' : ''}</div><div class="stat-label">Average quiz score</div></div>
    </section>

    ${tip ? `<section class="card tip"><div class="tip-label">${icons.shield} Daily OpSec Tip <span class="badge">${esc(tip.category || 'General')}</span></div><p>${esc(tip.tip_text)}</p></section>` : ''}

    <section class="card"><h2>Curriculum</h2><div class="accordion">${moduleAccordion()}</div></section>`;

  $$('[data-w]', app).forEach((el) => (el.style.width = `${el.dataset.w}%`));

  $$('.acc-head', app).forEach((btn) =>
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      document.getElementById(btn.getAttribute('aria-controls')).hidden = open;
    })
  );
  const firstIncomplete = state.modules.find((m) => m.lessons.some((l) => !state.progress.get(l.id)?.completed));
  if (firstIncomplete) $(`[aria-controls="mod-${firstIncomplete.id}"]`, app)?.click();
}

function nextLessonHref() {
  for (const m of state.modules) for (const l of m.lessons) if (!state.progress.get(l.id)?.completed) return `#/lesson/${l.id}`;
  return '#/checklist';
}
