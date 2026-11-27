// Reference Hub: real-world case studies with links to the original reporting.
// (The glossary was removed; myths now live inside each module.)
import { getSupabase } from '../supabaseClient.js';
import { esc, safeUrl } from '../utils.js';

export function caseCardHTML(c) {
  const links = (Array.isArray(c.links_json) ? c.links_json : [])
    .map((l) => ({ label: l?.label, url: safeUrl(l?.url) }))
    .filter((l) => l.url && l.label);
  return `<article class="card case">
    <h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p>
    <p><strong>OpSec failure:</strong> ${esc(c.failure)}</p><p><strong>Lesson:</strong> ${esc(c.lesson)}</p>
    ${
      links.length
        ? `<div class="case-links"><p class="case-links-label">Read more</p><ul>${links
            .map(
              (l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}<span class="ext" aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></li>`
            )
            .join('')}</ul></div>`
        : ''
    }
  </article>`;
}

export async function renderReference(app) {
  app.innerHTML = `
    <section class="page-head"><h1>Reference Hub: Case Studies</h1><p class="muted">Lessons from real incidents, with links to the original reporting and official advisories.</p></section>
    <section id="ref-body"><div class="loading"><div class="spinner"></div></div></section>`;
  const body = app.querySelector('#ref-body');
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('case_studies')
    .select('title, summary, failure, lesson, links_json')
    .order('sort_order')
    .order('id');
  if (error) throw error;
  body.innerHTML = `<p class="hint">Summaries are based on public reporting. Details are simplified for teaching. Links open the original source in a new tab.</p>
    ${data.length ? `<div class="grid two">${data.map(caseCardHTML).join('')}</div>` : '<p class="muted">No case studies yet.</p>'}`;
}
