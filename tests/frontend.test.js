// Unit tests for pure frontend logic (no browser needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePassword, formatDuration } from '../public/js/labs/password.js';
import { ASSETS, buildPlan } from '../public/js/labs/threatModel.js';
import { EMAILS } from '../public/js/labs/phishing.js';
import { esc, richText } from '../public/js/utils.js';

test('common passwords are very weak', () => {
  for (const pw of ['password', '123456', 'P@ssw0rd', 'qwerty123']) {
    assert.equal(analyzePassword(pw).rating, 'Very weak', pw);
  }
});

test('patterns reduce entropy below the raw maximum', () => {
  const r = analyzePassword('Summer2025!');
  assert.ok(r.bits < r.rawBits);
  assert.ok(r.patterns.some((p) => p.type === 'year'));
  assert.ok(r.patterns.some((p) => p.type === 'word'));
});

test('passphrases are scored per word, not per character', () => {
  const r = analyzePassword('tangerine-violin-gravel-orbit');
  assert.ok(Math.abs(r.bits - 4 * Math.log2(7776)) < 0.01, `got ${r.bits}`);
});

test('random 16-char mixed password is strong', () => {
  const r = analyzePassword('k9#Vq2!mZx7$Lp4w');
  assert.ok(['Strong', 'Very strong'].includes(r.rating), r.rating);
});

test('crack time math: half the keyspace / rate', () => {
  const r = analyzePassword('k9#Vq2!mZx7$Lp4w');
  const fast = r.times.find((t) => t.rate === 1e10);
  assert.ok(Math.abs(fast.seconds - Math.pow(2, r.bits) / 2 / 1e10) < 1e-6 * fast.seconds);
  assert.equal(formatDuration(0.2), 'less than a second');
  assert.equal(formatDuration(3600), 'about 1 hour');
});

test('threat plan puts ticked weaknesses first', () => {
  const email = ASSETS.find((a) => a.id === 'email');
  const plan = buildPlan(email, ['stuff'], ['stuff:1']);
  assert.equal(plan.high.length, 1);
  assert.match(plan.high[0].fix, /MFA/);
  assert.ok(plan.recommended.length >= 1);
});

test('phishing emails only use reserved .example domains', () => {
  for (const m of EMAILS) {
    const domains = [m.from, m.replyTo, ...[...m.body.matchAll(/\|([^\]]+)\]\]/g)].map((x) => x[1])];
    for (const d of domains) assert.match(new URL(d.includes('://') ? d : `mailto:${d}`).href, /\.example/);
  }
});

test('richText escapes HTML and renders lists', () => {
  assert.equal(esc('<img src=x onerror=1>'), '&lt;img src=x onerror=1&gt;');
  const html = richText('Hello <b>x</b>\n\n- one\n- two');
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('<ul><li>one</li><li>two</li></ul>'));
});
