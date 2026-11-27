// Security Checklist page: a two-stage journey.
//   1. "Before you start" baseline — audit current habits, then save (locked).
//   2. "After finishing all modules" re-evaluation — review, update, and lock in.
import { getSupabase } from '../supabaseClient.js';
import { state, loadCurriculum, loadChecklistStatus, courseComplete, stats } from '../state.js';
import { CHECKLIST, checklistPhase, score, compareStages } from '../checklistLogic.js';
import { $, $$, esc, toast, pct, icons } from '../utils.js';

function itemsHTML(checked, { disabled = false } = {}) {
  const groups = [...new Set(CHECKLIST.map((c) => c.group))];
  return groups
    .map(
      (g) => `<fieldset class="check-group"><legend>${esc(g)}</legend>
        ${CHECKLIST.filter((c) => c.group === g)
          .map(
            (c) => `<label class="check-item"><input type="checkbox" data-key="${c.key}" ${checked.has(c.key) ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span>${esc(c.text)}</span></label>`
          )
          .join('')}
      </fieldset>`
    )
    .join('');
}

function stepper(phase) {
  const s1 = phase === 'baseline' ? 'current' : 'done';
  const s2 = phase === 'final' ? 'current' : phase === 'done' ? 'done' : '';
  return `<ol class="journey" aria-label="Checklist stages">
    <li class="${s1}"><span class="journey-dot">${s1 === 'done' ? icons.check : '1'}</span><div><strong>Before you start</strong><small>Baseline audit</small></div></li>
    <li class="journey-line ${s1 === 'done' ? 'done' : ''}" aria-hidden="true"></li>
    <li class="${s2}"><span class="journey-dot">${s2 === 'done' ? icons.check : '2'}</span><div><strong>After all 8 modules</strong><small>Review and lock in</small></div></li>
  </ol>`;
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
}

export async function renderChecklist(app) {
  app.innerHTML = `<div class="loading"><div class="spinner"></div><p>Loading your checklist…</p></div>`;
  const supabase = await getSupabase();
  const uid = state.session.user.id;

  const [, , rowsRes] = await Promise.all([
    loadCurriculum(true),
    loadChecklistStatus(),
    supabase.from('user_checklists').select('stage, item_key, is_checked').eq('user_id', uid)
  ]);
  if (rowsRes.error) throw rowsRes.error;

  const checkedIn = (stage) => new Set(rowsRes.data.filter((r) => r.stage === stage && r.is_checked).map((r) => r.item_key));
  const baseline = checkedIn('baseline');
  let final = checkedIn('final');
  const hasFinalRows = rowsRes.data.some((r) => r.stage === 'final');
  const status = state.checklist;
  const phase = checklistPhase(status, courseComplete());
  const s = stats();

  // First visit to the re-evaluation: start from the baseline answers.
  if ((phase === 'final' || phase === 'done') && !hasFinalRows && baseline.size) {
    const rows = [...baseline].map((item_key) => ({ user_id: uid, stage: 'final', item_key, is_checked: true }));
    const { error } = await supabase.from('user_checklists').upsert(rows, { onConflict: 'user_id,stage,item_key' });
    if (error) toast(`Could not copy your baseline: ${error.message}`, 'error');
    else final = new Set(baseline);
  }

  const editStage = phase === 'baseline' ? 'baseline' : phase === 'final' || phase === 'done' ? 'final' : null;
  const editing = editStage === 'baseline' ? baseline : final;

  let body = '';
  if (phase === 'baseline') {
    body = `
      <section class="card banner start">
        <h2>${icons.shield} Before you start: where are you today?</h2>
        <p>Tick every practice you <strong>already</strong> follow. Be honest; there's no grade. This is your starting point, and you'll compare against it after the course.</p>
        <p class="hint">Your answers save as you go. When you're done, save your baseline to lock it in and start Module 1.</p>
      </section>
      <section class="card">
        <div class="check-head"><h2>Your current habits</h2><span class="muted" id="check-count"></span></div>
        <div class="progress thin"><span id="check-bar"></span></div>
        <form id="checklist">${itemsHTML(editing)}</form>
        <div class="actions"><button class="btn primary" id="save-stage" type="button">Save my baseline and start Module 1</button></div>
      </section>`;
  } else if (phase === 'learning') {
    const total = status.total_items || CHECKLIST.length;
    body = `
      <section class="card banner">
        <h2>Baseline saved: ${status.baseline_score} of ${total} practices</h2>
        <p>Saved on ${esc(fmtDate(status.baseline_completed_at))}. Work through all 8 modules, then come back here to review and lock in your security practices.</p>
        <div class="progress" role="progressbar" aria-label="Modules completed" aria-valuenow="${s.modulesDone}" aria-valuemin="0" aria-valuemax="${state.modules.length}"><span data-w="${pct(s.modulesDone, state.modules.length)}"></span></div>
        <p class="small muted">${s.modulesDone} of ${state.modules.length} modules completed</p>
        <a class="btn primary" href="#/dashboard">Continue the course</a>
      </section>
      <section class="card locked">
        <h2>${icons.lock} Re-evaluation unlocks after all 8 modules</h2>
        <p class="muted">Your baseline answers are shown below for reference.</p>
        <form>${itemsHTML(baseline, { disabled: true })}</form>
      </section>`;
  } else {
    const done = phase === 'done';
    body = `
      <section class="card banner celebrate">
        <h2>${done ? `${icons.check} Practices locked in` : 'You finished all 8 modules!'}</h2>
        ${
          done
            ? `<p>Saved on ${esc(fmtDate(status.final_completed_at))}. Keep this list up to date as your habits change.</p>`
            : `<p>Now that you understand the real-world risks and why OpSec matters, review your answers from the start of the course. Tick everything you do <strong>now</strong>, set up anything you're still missing, then lock in your security practices.</p>`
        }
      </section>
      <section class="card" id="compare"></section>
      <section class="card">
        <div class="check-head"><h2>Your security practices now</h2><span class="muted" id="check-count"></span></div>
        <div class="progress thin"><span id="check-bar"></span></div>
        <form id="checklist">${itemsHTML(editing)}</form>
        <div class="actions"><button class="btn primary" id="save-stage" type="button">${done ? 'Update my locked-in practices' : 'Lock in my security practices'}</button></div>
      </section>`;
  }

  app.innerHTML = `
    <section class="page-head"><h1>Security Checklist</h1>
      <p class="muted">A personal audit of the habits that protect your accounts, devices, network, privacy, and recovery.</p></section>
    ${stepper(phase)}
    ${body}`;

  $$('[data-w]', app).forEach((el) => (el.style.width = `${el.dataset.w}%`));
  if (!editStage) return;

  const current = () => new Set($$('#checklist input:checked', app).map((i) => i.dataset.key));
  const update = () => {
    const n = score(current());
    $('#check-count', app).textContent = `${n} of ${CHECKLIST.length} done`;
    $('#check-bar', app).style.width = `${pct(n, CHECKLIST.length)}%`;
    const cmp = $('#compare', app);
    if (cmp) {
      const c = compareStages(baseline, current());
      const diff = c.after - c.before;
      cmp.innerHTML = `<h2>Before vs. now</h2>
        <div class="compare">
          <div><div class="stat-num">${c.before}<small>/${c.total}</small></div><div class="stat-label">Before the course</div></div>
          <div class="arrow" aria-hidden="true">→</div>
          <div><div class="stat-num">${c.after}<small>/${c.total}</small></div><div class="stat-label">Now</div></div>
          <div><span class="pill ${diff > 0 ? 'ok' : diff < 0 ? 'bad' : ''}">${diff > 0 ? '+' : ''}${diff} practice${Math.abs(diff) === 1 ? '' : 's'}</span></div>
        </div>
        ${c.added.length ? `<p class="small"><strong>New since you started:</strong> ${c.added.map((i) => esc(i.text)).join('; ')}.</p>` : ''}
        ${c.remaining.length ? `<p class="small muted"><strong>Still to do:</strong> ${c.remaining.map((i) => esc(i.text)).join('; ')}.</p>` : '<p class="small ok-text">Every practice on the list is in place. Well done.</p>'}`;
    }
  };
  update();

  $('#checklist', app).addEventListener('change', async (e) => {
    const box = e.target;
    if (!box.dataset.key) return;
    update();
    const { error } = await supabase.from('user_checklists').upsert(
      { user_id: uid, stage: editStage, item_key: box.dataset.key, is_checked: box.checked, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,stage,item_key' }
    );
    if (error) {
      box.checked = !box.checked;
      update();
      toast(`Could not save: ${error.message}`, 'error');
    }
  });

  $('#save-stage', app).addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const now = new Date().toISOString();
    const n = score(current());
    const row =
      editStage === 'baseline'
        ? { user_id: uid, baseline_completed_at: now, baseline_score: n, total_items: CHECKLIST.length, updated_at: now }
        : { user_id: uid, final_completed_at: now, final_score: n, total_items: CHECKLIST.length, updated_at: now };
    const { error } = await supabase.from('user_checklist_status').upsert(row, { onConflict: 'user_id' });
    btn.disabled = false;
    if (error) return toast(`Could not save: ${error.message}`, 'error');
    await loadChecklistStatus();
    if (editStage === 'baseline') {
      toast('Baseline saved. Time for Module 1!', 'success');
      const first = state.modules[0]?.lessons[0];
      location.hash = first ? `#/lesson/${first.id}` : '#/dashboard';
    } else {
      toast('Security practices locked in', 'success');
      renderChecklist(app);
    }
  });

  // Realtime: reflect changes made in other tabs or devices.
  const channel = supabase
    .channel(`checklist-${uid}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_checklists', filter: `user_id=eq.${uid}` },
      (payload) => {
        const row = payload.new;
        if (!row?.item_key || row.stage !== editStage) return;
        const box = $(`#checklist input[data-key="${CSS.escape(row.item_key)}"]`, app);
        if (box && box.checked !== row.is_checked) {
          box.checked = row.is_checked;
          update();
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
