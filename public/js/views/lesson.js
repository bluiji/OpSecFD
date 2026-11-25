// Lesson page: six-part format + interactive quiz that upserts into user_progress.
import { getSupabase } from '../supabaseClient.js';
import { state, loadCurriculum } from '../state.js';
import { $, $$, esc, richText, toast, icons } from '../utils.js';

export const PASS_MARK = 60; // percent needed to mark a lesson complete

const SECTIONS = [
  ['what_is_it', 'What is it?'],
  ['why_it_matters', 'Why does it matter?'],
  ['how_it_works', 'How does it work?'],
  ['real_world_scenario', 'Real-world scenario'],
  ['how_to_protect', 'How to protect yourself']
];

export async function renderLesson(app, lessonId) {
  app.innerHTML = `<div class="loading"><div class="spinner"></div><p>Loading lesson…</p></div>`;
  const supabase = await getSupabase();
  const [, res] = await Promise.all([
    loadCurriculum(),
    supabase.from('lessons').select('*').eq('id', lessonId).maybeSingle()
  ]);
  if (res.error) throw res.error;
  const lesson = res.data;
  if (!lesson) {
    app.innerHTML = `<section class="card narrow"><h1>Lesson not found</h1><a class="btn" href="#/dashboard">Back to dashboard</a></section>`;
    return;
  }

  const mod = state.modules.find((m) => m.id === lesson.module_id);
  const siblings = mod?.lessons || [];
  const idx = siblings.findIndex((l) => l.id === lesson.id);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1] || nextModuleFirst(mod);
  const quiz = Array.isArray(lesson.quiz_json) ? lesson.quiz_json : [];
  const prior = state.progress.get(lesson.id);

  app.innerHTML = `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#/dashboard">Dashboard</a> / <span>Module ${esc(mod?.module_number ?? '?')}: ${esc(mod?.title ?? '')}</span></nav>
    <article class="lesson">
      <header class="lesson-head card">
        <div class="lesson-meta">
          <span class="badge ${esc((mod?.difficulty || '').toLowerCase())}">${esc(mod?.difficulty || '')}</span>
          <span class="muted">Lesson ${idx + 1} of ${siblings.length}</span>
          ${prior?.completed ? `<span class="pill ok">${icons.check} Completed · best ${prior.quiz_score}%</span>` : ''}
        </div>
        <h1>${esc(lesson.title)}</h1>
        <ol class="lesson-steps" aria-label="Lesson sections">
          ${[...SECTIONS.map((s) => s[1]), 'Test your knowledge'].map((t, i) => `<li><a href="#sec-${i + 1}" data-jump="sec-${i + 1}">${i + 1}. ${t}</a></li>`).join('')}
        </ol>
      </header>
      ${SECTIONS.map(
        ([key, label], i) => `<section class="card lesson-sec" id="sec-${i + 1}">
          <h2><span class="sec-num">${i + 1}</span>${label}</h2>
          <div class="prose">${richText(lesson[key]) || '<p class="muted">Content coming soon.</p>'}</div>
        </section>`
      ).join('')}
      <section class="card lesson-sec" id="sec-6">
        <h2><span class="sec-num">6</span>Test your knowledge</h2>
        ${quiz.length ? quizHTML(quiz) : '<p class="muted">No quiz for this lesson yet.</p>'}
        <div id="quiz-result" aria-live="polite"></div>
      </section>
      <nav class="lesson-nav">
        ${prev ? `<a class="btn" href="#/lesson/${prev.id}">← ${esc(prev.title)}</a>` : '<span></span>'}
        ${next ? `<a class="btn" href="#/lesson/${next.id}">${esc(next.title)} →</a>` : '<a class="btn" href="#/dashboard">Back to dashboard</a>'}
      </nav>
    </article>`;

  // In-page section links (the hash is used by the router, so scroll manually).
  $$('[data-jump]', app).forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById(a.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    })
  );

  const form = $('#quiz', app);
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const answers = quiz.map((_, i) => {
      const sel = form.querySelector(`input[name="q${i}"]:checked`);
      return sel ? Number(sel.value) : null;
    });
    if (answers.some((a) => a === null)) {
      toast('Please answer every question first', 'error');
      return;
    }
    const correct = answers.filter((a, i) => a === quiz[i].answer).length;
    const score = Math.round((correct / quiz.length) * 100);

    // Per-question feedback
    quiz.forEach((q, i) => {
      const box = $(`#qfb-${i}`, app);
      const ok = answers[i] === q.answer;
      box.className = `q-feedback ${ok ? 'ok' : 'bad'}`;
      box.innerHTML = `<strong>${ok ? 'Correct.' : `Not quite. The answer is: ${esc(q.options[q.answer])}.`}</strong> ${esc(q.explanation || '')}`;
      $$(`input[name="q${i}"]`, form).forEach((inp) => {
        inp.disabled = true;
        const lbl = inp.closest('label');
        if (Number(inp.value) === q.answer) lbl.classList.add('right');
        else if (inp.checked) lbl.classList.add('wrong');
      });
    });
    form.querySelector('button[type=submit]').hidden = true;

    const passed = score >= PASS_MARK;
    const prev = state.progress.get(lesson.id);
    const best = Math.max(score, prev?.quiz_score ?? 0);
    const completed = passed || !!prev?.completed;
    const result = $('#quiz-result', app);
    result.innerHTML = `<div class="quiz-score ${passed ? 'ok' : 'bad'}">
        <div class="big">${score}%</div>
        <div><strong>${correct} of ${quiz.length} correct.</strong> Calculation: ${correct} ÷ ${quiz.length} × 100 = ${score}%.
        ${passed ? 'Lesson completed!' : `You need ${PASS_MARK}% to complete this lesson.`}</div>
        <button class="btn small" id="retake" type="button">Retake quiz</button>
      </div>`;
    $('#retake', app).addEventListener('click', () => renderLesson(app, lessonId));

    const supabase = await getSupabase();
    const row = {
      user_id: state.session.user.id,
      lesson_id: lesson.id,
      completed,
      quiz_score: best,
      completed_at: new Date().toISOString()
    };
    const { error } = await supabase.from('user_progress').upsert(row, { onConflict: 'user_id,lesson_id' });
    if (error) {
      toast(`Score not saved: ${error.message}`, 'error');
      return;
    }
    state.progress.set(lesson.id, { lesson_id: lesson.id, completed, quiz_score: best });
    toast(passed ? 'Progress saved' : 'Score saved — try again to complete', passed ? 'success' : 'info');
  });
}

function quizHTML(quiz) {
  return `<form id="quiz" class="quiz">
    ${quiz
      .map(
        (q, i) => `<fieldset class="q">
          <legend><span class="q-num">Q${i + 1}.</span> ${esc(q.question)}</legend>
          ${(q.options || [])
            .map(
              (o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}" required><span>${esc(o)}</span></label>`
            )
            .join('')}
          <div class="q-feedback" id="qfb-${i}"></div>
        </fieldset>`
      )
      .join('')}
    <button class="btn primary" type="submit">Submit answers</button>
  </form>`;
}

function nextModuleFirst(mod) {
  if (!mod) return null;
  const nextMod = state.modules.find((m) => m.module_number === mod.module_number + 1);
  return nextMod?.lessons[0] || null;
}
