// Admin Portal: Lesson Manager (POST/PUT/DELETE /api/admin/lessons) and
// Student Roster (GET/PATCH /api/admin/users). Server routes re-verify the admin role.
import { getSupabase, adminFetch } from '../supabaseClient.js';
import { state } from '../state.js';
import { $, $$, esc, toast } from '../utils.js';

const FIELDS = [
  ['what_is_it', '1. What is it?'],
  ['why_it_matters', '2. Why does it matter?'],
  ['how_it_works', '3. How does it work?'],
  ['real_world_scenario', '4. Real-world scenario'],
  ['how_to_protect', '5. How to protect yourself']
];

export async function renderAdmin(app) {
  app.innerHTML = `
    <section class="page-head"><h1>Admin Portal</h1><p class="muted">Signed in as ${esc(state.profile.email)} (admin).</p></section>
    <div class="tabs" role="tablist">
      <button role="tab" class="active" data-tab="lessons">Lesson Manager</button>
      <button role="tab" data-tab="roster">Student Roster &amp; Analytics</button>
    </div>
    <section id="admin-body"></section>`;
  const body = $('#admin-body', app);
  const show = (t) => {
    $$('[data-tab]', app).forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    return t === 'lessons' ? lessonManager(body) : roster(body);
  };
  $$('[data-tab]', app).forEach((b) => b.addEventListener('click', () => show(b.dataset.tab).catch(fail)));
  await show('lessons');
}

function fail(err) {
  console.error(err);
  toast(err.message || String(err), 'error');
}

// ------------------------------------------------------------ Lesson Manager
async function lessonManager(body) {
  body.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  const supabase = await getSupabase();
  const { data: modules, error } = await supabase.from('modules').select('id, module_number, title').order('module_number');
  if (error) throw error;
  let moduleId = modules[0]?.id;

  body.innerHTML = `<div class="grid one-two">
    <section class="card">
      <label>Module<select id="am-module">${modules.map((m) => `<option value="${m.id}">${String(m.module_number).padStart(2, '0')} · ${esc(m.title)}</option>`).join('')}</select></label>
      <ol class="admin-lessons" id="am-list"></ol>
      <button class="btn primary block" id="am-new">+ New lesson</button>
    </section>
    <section class="card" id="am-editor"><p class="muted">Select a lesson to edit, or create a new one.</p></section>
  </div>`;

  const list = $('#am-list', body);
  const editor = $('#am-editor', body);

  async function loadList() {
    // Via the admin API: quiz answer keys aren't readable from the browser's own Supabase session.
    const { lessons: data } = await adminFetch(`/api/admin/lessons?module_id=${encodeURIComponent(moduleId)}`);
    list.innerHTML = data.length
      ? data.map((l) => `<li><button class="link-btn" data-id="${l.id}">${l.lesson_order}. ${esc(l.title)}</button></li>`).join('')
      : '<li class="muted">No lessons in this module.</li>';
    $$('[data-id]', list).forEach((b) => b.addEventListener('click', () => openEditor(data.find((l) => l.id === Number(b.dataset.id)))));
    return data;
  }

  function openEditor(lesson) {
    const isNew = !lesson?.id;
    const quiz = lesson?.quiz_json?.length ? structuredClone(lesson.quiz_json) : [blankQ(), blankQ(), blankQ()];
    editor.innerHTML = `<h2>${isNew ? 'New lesson' : `Edit: ${esc(lesson.title)}`}</h2>
      <form id="am-form" novalidate>
        <div class="grid two tight">
          <label>Title<input name="title" required maxlength="200" value="${esc(lesson?.title || '')}"></label>
          <label>Order in module<input name="lesson_order" type="number" min="1" required value="${esc(lesson?.lesson_order || '')}"></label>
        </div>
        ${FIELDS.map(([k, l]) => `<label>${l}<textarea name="${k}" rows="5" required>${esc(lesson?.[k] || '')}</textarea></label>`).join('')}
        <p class="hint">Formatting: leave a blank line between paragraphs; start a line with "- " for bullets.</p>
        <h3>6. Quiz (3–5 questions)</h3>
        <div id="am-quiz"></div>
        <button type="button" class="btn small" id="am-addq">+ Add question</button>
        <p class="form-error" id="am-err" role="alert"></p>
        <div class="wizard-nav">
          ${isNew ? '' : '<button type="button" class="btn danger" id="am-del">Delete lesson</button>'}
          <button class="btn primary" type="submit">${isNew ? 'Create lesson' : 'Save changes'}</button>
        </div>
      </form>`;

    const qWrap = $('#am-quiz', editor);
    const drawQuiz = () => {
      qWrap.innerHTML = quiz.map((q, i) => `<fieldset class="q-edit" data-q="${i}">
        <legend>Question ${i + 1} ${quiz.length > 3 ? `<button type="button" class="link-btn danger" data-rm="${i}">Remove</button>` : ''}</legend>
        <label>Question<input data-f="question" value="${esc(q.question)}" maxlength="1000"></label>
        ${Array.from({ length: Math.min(6, Math.max(4, q.options.length)) }, (_, j) => j).map((j) => `<div class="opt-edit"><input type="radio" name="ans${i}" value="${j}" ${q.answer === j ? 'checked' : ''} aria-label="Correct answer is option ${j + 1}">
          <input data-o="${j}" placeholder="Option ${j + 1}${j > 1 ? ' (optional)' : ''}" value="${esc(q.options[j] || '')}" maxlength="500"></div>`).join('')}
        <label>Explanation<input data-f="explanation" value="${esc(q.explanation)}" maxlength="2000"></label>
      </fieldset>`).join('');
      $('#am-addq', editor).hidden = quiz.length >= 5;
      $$('[data-rm]', qWrap).forEach((b) => b.addEventListener('click', () => { sync(); quiz.splice(Number(b.dataset.rm), 1); drawQuiz(); }));
    };
    const sync = () => {
      $$('[data-q]', qWrap).forEach((fs) => {
        const q = quiz[Number(fs.dataset.q)];
        q.question = $('[data-f=question]', fs).value;
        q.explanation = $('[data-f=explanation]', fs).value;
        q.options = $$('[data-o]', fs).map((o) => o.value);
        const a = $(`input[name="ans${fs.dataset.q}"]:checked`, fs);
        q.answer = a ? Number(a.value) : -1;
      });
    };
    drawQuiz();
    $('#am-addq', editor).addEventListener('click', () => { sync(); if (quiz.length < 5) quiz.push(blankQ()); drawQuiz(); });

    $('#am-form', editor).addEventListener('submit', async (e) => {
      e.preventDefault();
      sync();
      const err = $('#am-err', editor);
      err.textContent = '';
      const fd = new FormData(e.target);
      // Drop empty trailing options and remap the answer index.
      const quizOut = [];
      for (const [i, q] of quiz.entries()) {
        const kept = q.options.map((o, j) => ({ o: o.trim(), j })).filter((x) => x.o);
        const ans = kept.findIndex((x) => x.j === q.answer);
        if (!q.question.trim() || kept.length < 2 || ans < 0 || !q.explanation.trim()) {
          err.textContent = `Question ${i + 1}: needs text, at least 2 options, a selected correct option that isn't empty, and an explanation.`;
          return;
        }
        quizOut.push({ question: q.question.trim(), options: kept.map((x) => x.o), answer: ans, explanation: q.explanation.trim() });
      }
      const payload = {
        module_id: Number(moduleId),
        lesson_order: Number(fd.get('lesson_order')),
        title: fd.get('title'),
        ...Object.fromEntries(FIELDS.map(([k]) => [k, fd.get(k)])),
        quiz_json: quizOut
      };
      const btn = e.target.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        const res = isNew
          ? await adminFetch('/api/admin/lessons', { method: 'POST', body: payload })
          : await adminFetch('/api/admin/lessons', { method: 'PUT', body: { id: lesson.id, ...payload } });
        toast(isNew ? 'Lesson created' : 'Lesson saved', 'success');
        state.loaded = false; // refresh curriculum cache
        await loadList();
        openEditor(res.lesson);
      } catch (ex) {
        err.textContent = ex.message;
      } finally {
        btn.disabled = false;
      }
    });

    $('#am-del', editor)?.addEventListener('click', async () => {
      if (!confirmDelete(lesson.title)) return;
      try {
        await adminFetch(`/api/admin/lessons?id=${lesson.id}`, { method: 'DELETE' });
        toast('Lesson deleted', 'success');
        state.loaded = false;
        await loadList();
        editor.innerHTML = '<p class="muted">Lesson deleted.</p>';
      } catch (ex) {
        fail(ex);
      }
    });
  }

  $('#am-module', body).addEventListener('change', (e) => {
    moduleId = Number(e.target.value);
    editor.innerHTML = '<p class="muted">Select a lesson to edit, or create a new one.</p>';
    loadList().catch(fail);
  });
  $('#am-new', body).addEventListener('click', async () => {
    const data = await loadList();
    openEditor({ lesson_order: (data.at(-1)?.lesson_order || 0) + 1 });
  });
  await loadList();
}

// Typed confirmation instead of window.confirm (which blocks the page).
function confirmDelete(title) {
  const typed = prompt(`Type DELETE to permanently delete "${title}" and all student progress for it.`);
  return typed === 'DELETE';
}

function blankQ() {
  return { question: '', options: ['', '', '', ''], answer: 0, explanation: '' };
}

// ------------------------------------------------------------ Roster
async function roster(body) {
  body.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  const data = await adminFetch('/api/admin/users');
  const s = data.summary;
  body.innerHTML = `
    <section class="grid four stats">
      <div class="card stat"><div class="stat-num">${s.students}</div><div class="stat-label">Students</div></div>
      <div class="card stat"><div class="stat-num">${s.admins}</div><div class="stat-label">Admins</div></div>
      <div class="card stat"><div class="stat-num">${s.avg_completion_pct}<small>%</small></div><div class="stat-label">Avg. student completion</div></div>
      <div class="card stat"><div class="stat-num">${s.avg_quiz_score ?? '—'}${s.avg_quiz_score != null ? '<small>%</small>' : ''}</div><div class="stat-label">Avg. quiz score</div></div>
    </section>
    <section class="card">
      <div class="filters"><label>Search<input id="r-q" type="search" placeholder="Name or email"></label><span class="muted">${data.total_lessons} lessons in course</span></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>User</th><th>Email</th><th>Completed</th><th>Avg. score</th><th>Joined</th><th>Role</th></tr></thead>
        <tbody id="r-body"></tbody>
      </table></div>
      <p class="hint">Completion % = lessons completed ÷ total lessons × 100. Avg. score = mean of each user's best quiz score per attempted lesson.</p>
    </section>`;

  const draw = () => {
    const q = $('#r-q', body).value.trim().toLowerCase();
    const rows = data.users.filter((u) => !q || `${u.username} ${u.email}`.toLowerCase().includes(q));
    $('#r-body', body).innerHTML = rows.map((u) => `<tr>
      <td>${esc(u.username || '—')}</td><td>${esc(u.email || '')}</td>
      <td><div class="progress thin inline"><span data-w="${u.completion_pct}"></span></div> ${u.completion_pct}% <span class="hint">(${u.lessons_completed})</span></td>
      <td>${u.avg_quiz_score != null ? `${u.avg_quiz_score}%` : '—'}</td>
      <td>${u.created_at ? esc(new Date(u.created_at).toLocaleDateString()) : ''}</td>
      <td><button class="btn small role-toggle ${u.role === 'admin' ? 'danger' : ''}" data-uid="${esc(u.id)}" data-role="${u.role}" ${u.id === state.profile.id ? 'disabled title="You cannot change your own role"' : ''}>
        ${u.role === 'admin' ? 'Admin → make student' : 'Student → make admin'}</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No users.</td></tr>';
    $$('[data-w]', body).forEach((el) => (el.style.width = `${el.dataset.w}%`));
    $$('.role-toggle', body).forEach((b) => b.addEventListener('click', async () => {
      const role = b.dataset.role === 'admin' ? 'student' : 'admin';
      b.disabled = true;
      try {
        const res = await adminFetch('/api/admin/users', { method: 'PATCH', body: { user_id: b.dataset.uid, role } });
        const u = data.users.find((x) => x.id === res.user.id);
        u.role = res.user.role;
        toast(`${u.username || u.email} is now ${u.role}`, 'success');
        draw();
      } catch (ex) {
        fail(ex);
        b.disabled = false;
      }
    }));
  };
  $('#r-q', body).addEventListener('input', draw);
  draw();
}
