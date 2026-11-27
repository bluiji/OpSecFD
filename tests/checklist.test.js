// Unit tests for the Security Checklist journey and case-study link handling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKLIST, checklistPhase, score, compareStages, isCourseComplete } from '../public/js/checklistLogic.js';
import { safeUrl } from '../public/js/utils.js';
import { myths, caseStudies } from '../supabase/seed/extras.mjs';
import { modules } from '../supabase/seed/meta.mjs';

test('checklist phases follow baseline → learning → final → done', () => {
  assert.equal(checklistPhase(null, false), 'baseline');
  assert.equal(checklistPhase(null, true), 'baseline', 'baseline still comes first');
  const base = { baseline_completed_at: '2026-01-01T00:00:00Z' };
  assert.equal(checklistPhase(base, false), 'learning');
  assert.equal(checklistPhase(base, true), 'final');
  assert.equal(checklistPhase({ ...base, final_completed_at: '2026-02-01T00:00:00Z' }, true), 'done');
});

test('course is complete only when every lesson of every module is done', () => {
  const mods = [
    { lessons: [{ id: 1 }, { id: 2 }] },
    { lessons: [{ id: 3 }] }
  ];
  const progress = new Map([[1, { completed: true }], [2, { completed: true }]]);
  assert.equal(isCourseComplete(mods, progress), false);
  progress.set(3, { completed: false });
  assert.equal(isCourseComplete(mods, progress), false);
  progress.set(3, { completed: true });
  assert.equal(isCourseComplete(mods, progress), true);
  assert.equal(isCourseComplete([], progress), false, 'no modules loaded is not complete');
  assert.equal(isCourseComplete([{ lessons: [] }], progress), false, 'empty module is not complete');
});

test('score and comparison ignore unknown keys', () => {
  assert.equal(score(['pw_manager', 'retired_item', 'mfa_email']), 2);
  const c = compareStages(['pw_manager', 'router'], ['pw_manager', 'mfa_email', 'backups', 'bogus']);
  assert.equal(c.before, 2);
  assert.equal(c.after, 3);
  assert.equal(c.total, CHECKLIST.length);
  assert.deepEqual(c.added.map((i) => i.key), ['mfa_email', 'backups']);
  assert.deepEqual(c.dropped.map((i) => i.key), ['router']);
  assert.equal(c.remaining.length, CHECKLIST.length - 3);
});

test('checklist keys are unique', () => {
  assert.equal(new Set(CHECKLIST.map((c) => c.key)).size, CHECKLIST.length);
});

test('safeUrl only allows https links', () => {
  assert.equal(safeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  for (const bad of ['javascript:alert(1)', 'http://example.com', 'data:text/html,x', '//evil.example', '', null, 'not a url']) {
    assert.equal(safeUrl(bad), null, String(bad));
  }
});

test('every module has myths and every case study has https links', () => {
  for (const [n] of modules) {
    assert.ok(myths[n]?.length >= 1, `module ${n}`);
    for (const m of myths[n]) assert.ok(m.myth && m.fact);
  }
  for (const c of caseStudies) {
    assert.ok(c.links.length >= 1, c.title);
    for (const l of c.links) assert.ok(safeUrl(l.url) && l.label, l.url);
  }
});
