// Module Mythbusters: myths vs. facts embedded in each curriculum module.
import { state, loadCurriculum } from '../state.js';
import { $, $$, esc } from '../utils.js';

export async function renderMyths(app, moduleNumber) {
  app.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  await loadCurriculum();
  const mod = state.modules.find((m) => m.module_number === moduleNumber);
  if (!mod) {
    app.innerHTML = `<section class="card narrow"><h1>Module not found</h1><a class="btn" href="#/dashboard">Back to dashboard</a></section>`;
    return;
  }
  const myths = mod.myths_json.filter((m) => m && m.myth && m.fact);
  const lastLesson = mod.lessons[mod.lessons.length - 1];
  const nextMod = state.modules.find((m) => m.module_number === moduleNumber + 1);
  const nextLesson = nextMod?.lessons[0];

  app.innerHTML = `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#/dashboard">Dashboard</a> / <span>Module ${mod.module_number}: ${esc(mod.title)}</span></nav>
    <article class="lesson">
      <header class="card lesson-head">
        <div class="lesson-meta"><span class="badge ${esc(mod.difficulty.toLowerCase())}">${esc(mod.difficulty)}</span><span class="myth-tag">Mythbusters</span></div>
        <h1>Module ${mod.module_number} Mythbusters</h1>
        <p class="muted">Common beliefs about ${esc(mod.title.toLowerCase())} that sound right but aren't. Decide what you think, then reveal the fact.</p>
        ${myths.length ? '<button class="btn small" id="reveal-all" type="button">Reveal all facts</button>' : ''}
      </header>
      ${
        myths.length
          ? myths
              .map(
                (m, i) => `<section class="card myth">
          <p class="myth-label">Myth ${i + 1}</p>
          <h2>${esc(m.myth)}</h2>
          <button class="btn small reveal" type="button" aria-expanded="false" aria-controls="fact-${i}">Bust this myth</button>
          <div class="fact" id="fact-${i}" hidden><p class="fact-label">Fact</p><p>${esc(m.fact)}</p></div>
        </section>`
              )
              .join('')
          : '<section class="card"><p class="muted">No myths for this module yet.</p></section>'
      }
      <nav class="lesson-nav">
        ${lastLesson ? `<a class="btn" href="#/lesson/${lastLesson.id}">← ${esc(lastLesson.title)}</a>` : '<span></span>'}
        ${nextLesson ? `<a class="btn" href="#/lesson/${nextLesson.id}">Module ${nextMod.module_number}: ${esc(nextLesson.title)} →</a>` : '<a class="btn" href="#/dashboard">Back to dashboard</a>'}
      </nav>
    </article>`;

  const reveal = (btn) => {
    btn.setAttribute('aria-expanded', 'true');
    btn.hidden = true;
    document.getElementById(btn.getAttribute('aria-controls')).hidden = false;
  };
  $$('.reveal', app).forEach((btn) => btn.addEventListener('click', () => reveal(btn)));
  $('#reveal-all', app)?.addEventListener('click', (e) => {
    $$('.reveal', app).forEach(reveal);
    e.currentTarget.hidden = true;
  });
}
