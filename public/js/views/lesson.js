// Lesson page: six-part format + interactive quiz.
// The browser only gets questions and options (public.lesson_quiz). Answers are
// graded, and progress saved, by /api/quiz/submit on the server.
import { getSupabase, apiFetch } from '../supabaseClient.js';
import { state, loadCurriculum, needsBaseline, courseComplete } from '../state.js';
import { $, $$, esc, richText, toast, icons } from '../utils.js';

const LESSON_COLUMNS = 'id, module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect';

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
  const [, res, quizRes] = await Promise.all([
    loadCurriculum(),
    supabase.from('lessons').select(LESSON_COLUMNS).eq('id', lessonId).maybeSingle(),
    supabase.rpc('lesson_quiz', { p_lesson_id: lessonId })
  ]);
  if (res.error) throw res.error;
  if (quizRes.error) throw quizRes.error;
  const lesson = res.data;
  if (!lesson) {
    app.innerHTML = `<section class="card narrow"><h1>Lesson not found</h1><a class="btn" href="#/dashboard">Back to dashboard</a></section>`;
    return;
  }

  const mod = state.modules.find((m) => m.id === lesson.module_id);
  const siblings = mod?.lessons || [];
  const idx = siblings.findIndex((l) => l.id === lesson.id);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];
  // After a module's last lesson, its Mythbusters come next (then the next module).
  const afterModule = !next && mod?.myths_json.length
    ? { href: `#/module/${mod.module_number}/myths`, title: `Module ${mod.module_number} Mythbusters` }
    : null;
  const nextAny = next || nextModuleFirst(mod);
  const quiz = Array.isArray(quizRes.data) ? quizRes.data : [];
  const prior = state.progress.get(lesson.id);

  app.innerHTML = `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#/dashboard">Dashboard</a> / <span>Module ${esc(mod?.module_number ?? '?')}: ${esc(mod?.title ?? '')}</span></nav>
    <article class="lesson">
      ${needsBaseline() ? `<div class="notice start"><strong>Before you start:</strong> take the two-minute <a href="#/checklist">Security Checklist</a> to record your current habits, so you can measure your progress at the end of the course.</div>` : ''}
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
        ${
          afterModule
            ? `<a class="btn" href="${afterModule.href}">${esc(afterModule.title)} →</a>`
            : nextAny
              ? `<a class="btn" href="#/lesson/${nextAny.id}">${esc(nextAny.title)} →</a>`
              : '<a class="btn" href="#/dashboard">Back to dashboard</a>'
        }
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
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    let graded;
    try {
      graded = await apiFetch('/api/quiz/submit', { method: 'POST', body: { lesson_id: lesson.id, answers } });
    } catch (err) {
      submitBtn.disabled = false;
      toast(`Could not submit: ${err.message}`, 'error');
      return;
    }
    const { correct, total, score, passed, pass_mark: passMark, results, best, completed } = graded;

    // Per-question feedback (answers and explanations arrive only after submitting)
    quiz.forEach((q, i) => {
      const r = results[i];
      const box = $(`#qfb-${i}`, app);
      box.className = `q-feedback ${r.correct ? 'ok' : 'bad'}`;
      box.innerHTML = `<strong>${r.correct ? 'Correct.' : `Not quite. The answer is: ${esc(q.options[r.answer])}.`}</strong> ${esc(r.explanation)}`;
      $$(`input[name="q${i}"]`, form).forEach((inp) => {
        inp.disabled = true;
        const lbl = inp.closest('label');
        if (Number(inp.value) === r.answer) lbl.classList.add('right');
        else if (inp.checked) lbl.classList.add('wrong');
      });
    });
    submitBtn.hidden = true;

    const result = $('#quiz-result', app);
    result.innerHTML = `<div class="quiz-score ${passed ? 'ok' : 'bad'}">
        <div class="big">${score}%</div>
        <div><strong>${correct} of ${total} correct.</strong> Calculation: ${correct} ÷ ${total} × 100 = ${score}%.
        ${passed ? 'Lesson completed!' : `You need ${passMark}% to complete this lesson.`}</div>
        <button class="btn small" id="retake" type="button">Retake quiz</button>
      </div>`;
    $('#retake', app).addEventListener('click', () => renderLesson(app, lessonId));

    const wasComplete = courseComplete();
    state.progress.set(lesson.id, { lesson_id: lesson.id, completed, quiz_score: best });
    toast(passed ? 'Progress saved' : 'Score saved — try again to complete', passed ? 'success' : 'info');

    // This quiz finished the whole course: send them back to the checklist.
    if (!wasComplete && courseComplete()) {
      result.insertAdjacentHTML(
        'beforeend',
        `<section class="card banner celebrate" role="status">
          <h2>You finished all 8 modules!</h2>
          <p>Now that you understand the real-world risks and why OpSec matters, revisit your Security Checklist to review, update, and lock in your security practices.</p>
          <a class="btn primary" href="#/checklist">Review and lock in my practices</a>
        </section>`
      );
    }
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
