// Password Strength Lab. Everything runs locally: the password is never stored,
// logged, or sent anywhere. analyzePassword() is pure and unit-tested.
import { $, esc } from '../utils.js';

// A small sample of extremely common passwords (lower-cased). Real attackers use lists of millions.
const COMMON = new Set(
  ('123456 123456789 12345678 password qwerty 12345 1234567 111111 123123 abc123 password1 1234567890 000000 iloveyou ' +
    'qwerty123 1q2w3e4r admin letmein welcome monkey dragon football baseball sunshine princess master shadow ' +
    'superman batman trustno1 passw0rd p@ssw0rd p@ssword qwertyuiop asdfghjkl zxcvbnm 654321 121212 666666 ' +
    '987654321 password123 admin123 login hello charlie michael jessica secret freedom whatever iloveu').split(' ')
);
const WORDS = ['password', 'admin', 'love', 'hello', 'welcome', 'summer', 'winter', 'spring', 'autumn', 'monkey', 'dragon', 'secret',
  'master', 'login', 'qwerty', 'princess', 'sunshine', 'football', 'baseball', 'iloveyou', 'manila', 'pilipinas', 'philippines',
  'mahal', 'ganda', 'pogi', 'angel', 'baby', 'basketball', 'jesus', 'god', 'family', 'money', 'computer', 'internet'];
const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];
const LEET = { '@': 'a', 4: 'a', 3: 'e', 1: 'i', '!': 'i', 0: 'o', $: 's', 5: 's', 7: 't' };

export const SCENARIOS = [
  { label: 'Online attack, rate-limited', rate: 10, note: 'assumed 10 guesses/second against a website with throttling' },
  { label: 'Offline, slow hash (e.g. bcrypt)', rate: 1e4, note: 'assumed 10,000 guesses/second' },
  { label: 'Offline, fast hash on GPUs', rate: 1e10, note: 'assumed 10 billion guesses/second' }
];

export function charsetSize(pw) {
  let size = 0;
  const parts = [];
  if (/[a-z]/.test(pw)) { size += 26; parts.push('lowercase 26'); }
  if (/[A-Z]/.test(pw)) { size += 26; parts.push('uppercase 26'); }
  if (/[0-9]/.test(pw)) { size += 10; parts.push('digits 10'); }
  if (/[ -/:-@[-`{-~]/.test(pw)) { size += 33; parts.push('symbols/space 33'); }
  if (/[^\x00-\x7F]/.test(pw)) { size += 100; parts.push('non-ASCII ~100'); }
  return { size, parts };
}

function deleet(s) {
  return s.replace(/[@4310!$57]/g, (c) => LEET[c] || c);
}

/** Returns findings: [{ type, text, chars }] where chars = number of characters covered by the pattern. */
export function findPatterns(pw) {
  const found = [];
  const lower = pw.toLowerCase();
  const plain = deleet(lower);

  // Repeated characters (aaa, 1111)
  for (const m of pw.matchAll(/(.)\1{2,}/g)) found.push({ type: 'repeat', text: `Repeated character "${m[1]}" ×${m[0].length}`, chars: m[0].length });

  // Sequences (abc, 123, cba) of length >= 3
  let run = 1;
  for (let i = 1; i <= lower.length; i++) {
    const d = i < lower.length ? lower.charCodeAt(i) - lower.charCodeAt(i - 1) : 99;
    const prevD = i > 1 ? lower.charCodeAt(i - 1) - lower.charCodeAt(i - 2) : d;
    if (i < lower.length && Math.abs(d) === 1 && (run === 1 || d === prevD)) run++;
    else {
      if (run >= 3) found.push({ type: 'sequence', text: `Sequence "${pw.slice(i - run, i)}"`, chars: run });
      run = Math.abs(d) === 1 ? 2 : 1;
    }
  }

  // Keyboard walks of length >= 4
  for (const row of KEYBOARD_ROWS) {
    for (let len = row.length; len >= 4; len--) {
      let hit = false;
      for (let s = 0; s + len <= row.length; s++) {
        const chunk = row.slice(s, s + len);
        if (lower.includes(chunk) && !/^\d+$/.test(chunk)) {
          found.push({ type: 'keyboard', text: `Keyboard pattern "${chunk}"`, chars: len });
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
  }

  // Years 1900–2099
  for (const m of pw.matchAll(/(19|20)\d{2}/g)) found.push({ type: 'year', text: `Looks like a year (${m[0]})`, chars: 4 });

  // Dictionary words (also after undoing leetspeak)
  for (const w of WORDS) {
    if (plain.includes(w)) found.push({ type: 'word', text: `Common word "${w}"${lower.includes(w) ? '' : ' (with letter→symbol swaps)'}`, chars: w.length });
  }
  return found;
}

export function analyzePassword(pw) {
  const length = [...pw].length;
  const { size, parts } = charsetSize(pw);
  const rawBits = length && size ? length * Math.log2(size) : 0;
  const lower = pw.toLowerCase();
  const isCommon = COMMON.has(lower) || COMMON.has(deleet(lower));
  const patterns = findPatterns(pw);

  let bits;
  let method;
  if (!length) {
    bits = 0;
    method = 'Empty password.';
  } else if (isCommon) {
    bits = 10; // ~1,000 guesses: it is near the top of every attacker list
    method = 'Found in a list of the most common passwords, so attackers try it within the first ~1,000 guesses (≈10 bits).';
  } else {
    // Characters inside predictable patterns are counted as ~1 bit each instead of log2(pool).
    const covered = Math.min(length, patterns.reduce((a, p) => a + p.chars, 0));
    const free = length - covered;
    const perChar = Math.log2(size);
    bits = free * perChar + covered * 1 + patterns.length * 2;
    bits = Math.min(bits, rawBits);
    // Passphrases: attackers guess whole words, not characters. Model each word as one pick
    // from a 7,776-word Diceware-style list (log2(7776) ≈ 12.9 bits) and take the lower estimate.
    const words = pw.split(/[\s\-_.,+]+/).filter(Boolean);
    if (words.length >= 3 && words.every((w) => /^[a-zA-Z]{2,}\d?$/.test(w))) {
      const wordBits = words.length * Math.log2(7776);
      if (wordBits < bits) {
        bits = wordBits;
        method = `Looks like a ${words.length}-word passphrase. Attackers guess whole words, so it is scored as ${words.length} × log₂(7,776) = ${bits.toFixed(1)} bits (assuming each word is picked at random from a Diceware-sized list; words chosen by a person are weaker).`;
        return finish();
      }
    }
    method = `${free} unpredictable characters × log₂(${size}) = ${(free * perChar).toFixed(1)} bits` +
      (covered ? ` + ${covered} pattern characters × 1 bit + ${patterns.length} pattern(s) × 2 bits` : '') +
      ` = ${bits.toFixed(1)} bits (capped at the raw maximum of ${rawBits.toFixed(1)}).`;
  }

  return finish();

  function finish() {
  const guesses = Math.pow(2, bits);
  const times = SCENARIOS.map((s) => ({ ...s, seconds: guesses / 2 / s.rate })); // on average, half the space
  const rating = bits < 28 ? 'Very weak' : bits < 36 ? 'Weak' : bits < 60 ? 'Fair' : bits < 80 ? 'Strong' : 'Very strong';

  return { length, size, parts, rawBits, bits, method, isCommon, patterns, times, rating };
  }
}

export function formatDuration(seconds) {
  if (seconds < 1) return 'less than a second';
  const units = [['year', 31557600], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  if (seconds >= 31557600 * 1e6) return 'more than a million years';
  for (const [name, s] of units) {
    if (seconds >= s) {
      const n = Math.round(seconds / s);
      return `about ${n.toLocaleString()} ${name}${n === 1 ? '' : 's'}`;
    }
  }
  return 'less than a second';
}

export function renderPasswordLab(root) {
  root.innerHTML = `
    <section class="page-head"><h1>Password Strength Lab</h1></section>
    <div class="notice privacy" role="note">
      <strong>Privacy notice:</strong> This lab runs 100% in your browser. Your password is never transmitted over the network, saved, or logged.
      Even so, please don't type a password you actually use — test a similar one instead.
    </div>
    <section class="card">
      <label for="pw-input" class="label-lg">Try a password</label>
      <div class="pw-row">
        <input id="pw-input" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="128" placeholder="e.g. correct horse battery staple">
        <button class="btn" id="pw-toggle" type="button" aria-pressed="false">Show</button>
      </div>
      <div class="meter" aria-hidden="true"><span id="pw-meter"></span></div>
      <p id="pw-rating" class="rating" aria-live="polite"></p>
    </section>
    <div class="grid two">
      <section class="card"><h2>Estimated time to crack</h2><div id="pw-times"></div>
        <p class="hint">Average-case estimate: half of 2<sup>bits</sup> guesses ÷ guesses per second. Guess rates are illustrative assumptions; real speed depends on how the site stores passwords and the attacker's hardware.</p></section>
      <section class="card"><h2>How the score was calculated</h2><div id="pw-math"></div></section>
    </div>
    <section class="card"><h2>Patterns found &amp; advice</h2><div id="pw-patterns"></div></section>
    <p class="hint">Confidence: this is a simplified educational model. Dedicated estimators (for example, the open-source zxcvbn library) model attacker guessing more thoroughly. No estimate can know if a password already leaked in a breach.</p>`;

  const input = $('#pw-input', root);
  $('#pw-toggle', root).addEventListener('click', (e) => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? 'Hide' : 'Show';
    e.currentTarget.setAttribute('aria-pressed', String(show));
  });

  const update = () => {
    const r = analyzePassword(input.value);
    const w = Math.min(100, Math.round((r.bits / 100) * 100));
    const meter = $('#pw-meter', root);
    meter.style.width = `${w}%`;
    meter.className = `m-${r.rating.toLowerCase().replace(' ', '-')}`;
    $('#pw-rating', root).textContent = r.length ? `${r.rating} — about ${r.bits.toFixed(0)} bits of entropy` : '';
    $('#pw-times', root).innerHTML = r.length
      ? `<table class="table"><tbody>${r.times.map((t) => `<tr><th scope="row">${esc(t.label)}<div class="hint">${esc(t.note)}</div></th><td>${formatDuration(t.seconds)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">Start typing to see estimates.</p>';
    $('#pw-math', root).innerHTML = r.length
      ? `<ol class="math">
          <li>Length: <strong>${r.length}</strong> characters</li>
          <li>Character pool: ${r.parts.map(esc).join(' + ')} = <strong>${r.size}</strong></li>
          <li>Raw maximum: ${r.length} × log₂(${r.size}) = <strong>${r.rawBits.toFixed(1)} bits</strong></li>
          <li>Adjusted for patterns: ${esc(r.method)}</li>
          <li>Possible guesses ≈ 2<sup>${r.bits.toFixed(1)}</sup> ≈ <strong>${Math.pow(2, r.bits).toExponential(2)}</strong></li>
        </ol>`
      : '';
    $('#pw-patterns', root).innerHTML = r.length
      ? `${r.patterns.length || r.isCommon
          ? `<ul class="flags">${r.isCommon ? '<li class="bad">On the most-common-passwords list</li>' : ''}${r.patterns.map((p) => `<li class="bad">${esc(p.text)}</li>`).join('')}</ul>`
          : '<p class="ok-text">No common patterns detected.</p>'}
         <h3>Advice</h3><ul>${analyzeAdvice(r).map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`
      : '';
  };
  input.addEventListener('input', update);
  update();
  // Clear the field when leaving the lab.
  return () => { input.value = ''; };
}

function analyzeAdvice(r) {
  const advice = [];
  if (r.length < 12) advice.push('Make it longer: aim for at least 12–16 characters, or a passphrase of 5+ randomly chosen words.');
  if (r.isCommon) advice.push('This is one of the most common passwords. Never use it.');
  if (r.patterns.some((p) => p.type === 'word')) advice.push('Avoid common words and names, even with symbol swaps like @ for a — attackers try those too.');
  if (r.patterns.some((p) => ['sequence', 'keyboard', 'repeat'].includes(p.type))) advice.push('Avoid sequences, keyboard walks, and repeated characters.');
  if (r.patterns.some((p) => p.type === 'year')) advice.push('Avoid years and dates; they are easy to guess.');
  if (!advice.length) advice.push('Looks good. Make sure it is unique to one account and stored in a password manager.');
  return advice;
}
