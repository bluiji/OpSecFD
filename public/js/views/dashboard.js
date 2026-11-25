// Student dashboard: progress, roadmap, daily tip, curriculum accordion, synced checklist.
import { getSupabase } from '../supabaseClient.js';
import { state, loadCurriculum, stats } from '../state.js';
import { $, $$, esc, toast, pct, dayIndex, icons } from '../utils.js';

export const CHECKLIST = [
  { key: 'pw_manager', group: 'Accounts', text: 'Set up a password manager' },
  { key: 'unique_pw', group: 'Accounts', text: 'Use unique passwords for email, banking, and social media' },
  { key: 'mfa_email', group: 'Accounts', text: 'Turn on MFA for my primary email' },
  { key: 'mfa_finance', group: 'Accounts', text: 'Turn on MFA for banking and e-wallet apps' },
  { key: 'recovery', group: 'Accounts', text: 'Update recovery email/phone and save backup codes' },
  { key: 'os_updates', group: 'Devices', text: 'Enable automatic updates on phone and computer' },
  { key: 'screen_lock', group: 'Devices', text: 'Use a strong screen lock with short auto-lock' },
  { key: 'encryption', group: 'Devices', text: 'Turn on disk encryption (BitLocker / FileVault)' },
  { key: 'find_device', group: 'Devices', text: 'Enable Find My / Find My Device' },
  { key: 'router', group: 'Network', text: 'Change router admin password and update firmware' },
  { key: 'wifi_wpa', group: 'Network', text: 'Use WPA3 or WPA2-AES with a strong Wi-Fi password' },
  { key: 'privacy_social', group: 'Privacy', text: 'Run a privacy checkup on each social account' },
  { key: 'location', group: 'Privacy', text: 'Review app location permissions' },
  { key: 'self_search', group: 'Privacy', text: 'Search my own name and remove what I can' },
  { key: 'backups', group: 'Recovery', text: 'Set up 3-2-1 backups and test a restore' },
  { key: 'report_plan', group: 'Recovery', text: 'Save my bank fraud line and national cybercrime hotline' }
];

const STAGES = [
  { name: 'Beginner', modules: [1, 2, 3] },
  { name: 'Intermediate', modules: [4, 5, 6] },
  { name: 'Advanced', modules: [7, 8] },
  { name: 'Pro', modules: [] }
];

function roadmapHTML() {
  const doneOf = (nums) => {
    const ls = state.modules.filter((m) => nums.includes(m.module_number)).flatMap((m) => m.lessons);
    return { done: ls.filter((l) => state.progress.get(l.id)?.completed).length, total: ls.length };
  };
  let current = 'Pro';
  for (const s of STAGES.slice(0, 3)) {
    const d = doneOf(s.modules);
    if (d.done < d.total) {
      current = s.name;
      break;
    }
  }
  return `<div class="roadmap" aria-label="Beginner to Pro roadmap">
    ${STAGES.map((s) => {
      const d = s.modules.length ? doneOf(s.modules) : null;
      const p = d ? pct(d.done, d.total) : stats().done === stats().total && stats().total ? 100 : 0;
      const cls = p === 100 ? 'done' : s.name === current ? 'current' : '';
      return `<div class="stage ${cls}">
        <div class="stage-dot">${p === 100 ? icons.check : ''}</div>
        <div class="stage-name">${s.name}</div>
        <div class="stage-bar"><span data-w="${p}"></span></div>
        <div class="stage-meta">${d ? `${d.done}/${d.total} lessons` : p === 100 ? 'Unlocked' : 'Finish all modules'}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function moduleAccordion() {
  return state.modules
    .map((m) => {
      const done = m.lessons.filter((l) => state.progress.get(l.id)?.completed).length;
      const id = `mod-${m.id}`;
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
        </div>
      </div>`;
    })
    .join('');
}

function checklistHTML(checked) {
  const groups = [...new Set(CHECKLIST.map((c) => c.group))];
  return groups
    .map(
      (g) => `<fieldset class="check-group"><legend>${g}</legend>
        ${CHECKLIST.filter((c) => c.group === g)
          .map(
            (c) => `<label class="check-item"><input type="checkbox" data-key="${c.key}" ${checked.has(c.key) ? 'checked' : ''}><span>${esc(c.text)}</span></label>`
          )
          .join('')}
      </fieldset>`
    )
    .join('');
}

export async function renderDashboard(app) {
  app.innerHTML = `<div class="loading"><div class="spinner"></div><p>Loading your dashboard…</p></div>`;
  const supabase = await getSupabase();
  const uid = state.session.user.id;

  const [, tipsRes, checkRes] = await Promise.all([
    loadCurriculum(true),
    supabase.from('daily_tips').select('tip_text, category').order('id'),
    supabase.from('user_checklists').select('item_key, is_checked').eq('user_id', uid)
  ]);
  if (tipsRes.error) throw tipsRes.error;
  if (checkRes.error) throw checkRes.error;

  const tips = tipsRes.data;
  const tip = tips.length ? tips[dayIndex() % tips.length] : null;
  const checked = new Set(checkRes.data.filter((r) => r.is_checked).map((r) => r.item_key));
  const s = stats();
  const overall = pct(s.done, s.total);

  app.innerHTML = `
    <section class="dash-head">
      <div>
        <h1>Hi, ${esc(state.profile?.username || 'there')}</h1>
        <p class="muted">Pick up where you left off, or try a lab.</p>
      </div>
      <a class="btn primary" href="${nextLessonHref()}">Continue learning</a>
    </section>

    <section class="grid four stats">
      <div class="card stat"><div class="stat-num">${overall}%</div><div class="stat-label">Course progress</div>
        <div class="progress" role="progressbar" aria-valuenow="${overall}" aria-valuemin="0" aria-valuemax="100"><span data-w="${overall}"></span></div></div>
      <div class="card stat"><div class="stat-num">${s.done}<small>/${s.total}</small></div><div class="stat-label">Lessons completed</div></div>
      <div class="card stat"><div class="stat-num">${s.modulesDone}<small>/${state.modules.length}</small></div><div class="stat-label">Modules completed</div></div>
      <div class="card stat"><div class="stat-num">${s.avg ?? '—'}${s.avg != null ? '<small>%</small>' : ''}</div><div class="stat-label">Average quiz score</div></div>
    </section>

    <section class="card"><h2>Beginner → Pro roadmap</h2>${roadmapHTML()}</section>

    ${tip ? `<section class="card tip"><div class="tip-label">${icons.shield} Daily OpSec Tip <span class="badge">${esc(tip.category || 'General')}</span></div><p>${esc(tip.tip_text)}</p></section>` : ''}

    <div class="grid two-one">
      <section class="card"><h2>Curriculum</h2><div class="accordion">${moduleAccordion()}</div></section>
      <section class="card">
        <h2>Security checklist</h2>
        <p class="muted small">Synced to your account in real time. <span id="check-count"></span></p>
        <div class="progress thin"><span id="check-bar"></span></div>
        <form id="checklist">${checklistHTML(checked)}</form>
      </section>
    </div>`;

  $$('[data-w]', app).forEach((el) => (el.style.width = `${el.dataset.w}%`));

  // Accordion
  $$('.acc-head', app).forEach((btn) =>
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      document.getElementById(btn.getAttribute('aria-controls')).hidden = open;
    })
  );
  const firstIncomplete = state.modules.find((m) => m.lessons.some((l) => !state.progress.get(l.id)?.completed));
  if (firstIncomplete) $(`[aria-controls="mod-${firstIncomplete.id}"]`, app)?.click();

  // Checklist
  const updateCount = () => {
    const n = $$('#checklist input:checked', app).length;
    $('#check-count', app).textContent = `${n} of ${CHECKLIST.length} done.`;
    $('#check-bar', app).style.width = `${pct(n, CHECKLIST.length)}%`;
  };
  updateCount();
  $('#checklist', app).addEventListener('change', async (e) => {
    const box = e.target;
    if (!box.dataset.key) return;
    updateCount();
    const { error } = await supabase
      .from('user_checklists')
      .upsert(
        { user_id: uid, item_key: box.dataset.key, is_checked: box.checked, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,item_key' }
      );
    if (error) {
      box.checked = !box.checked;
      updateCount();
      toast(`Could not save: ${error.message}`, 'error');
    }
  });

  // Realtime: reflect changes made in other tabs/devices.
  const channel = supabase
    .channel(`checklist-${uid}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_checklists', filter: `user_id=eq.${uid}` },
      (payload) => {
        const row = payload.new;
        const box = row?.item_key && $(`#checklist input[data-key="${CSS.escape(row.item_key)}"]`, app);
        if (box && box.checked !== row.is_checked) {
          box.checked = row.is_checked;
          updateCount();
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

function nextLessonHref() {
  for (const m of state.modules) for (const l of m.lessons) if (!state.progress.get(l.id)?.completed) return `#/lesson/${l.id}`;
  return '#/labs';
}
