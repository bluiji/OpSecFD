// Boot, auth session handling, navigation, and hash router.
import { getSupabase } from './supabaseClient.js';
import { state, loadProfile, clearState, isAdmin, needsBaseline } from './state.js';
import { $, $$, esc, toast, icons } from './utils.js';
import { renderDashboard } from './views/dashboard.js';
import { renderLesson } from './views/lesson.js';
import { renderLabs } from './views/labs.js';
import { renderReference } from './views/reference.js';
import { renderAdmin } from './views/admin.js';
import { renderChecklist } from './views/checklist.js';
import { renderMyths } from './views/myths.js';

// Where Supabase sends users back from auth emails. Add these to
// Supabase → Authentication → URL Configuration → Redirect URLs.
const RECOVERY_REDIRECT = () => `${location.origin}/?auth=recovery`;
const SIGNIN_REDIRECT = () => `${location.origin}/`;

/** Signed-in home: the checklist until a baseline is saved, then the dashboard. */
const home = () => (needsBaseline() ? '#/checklist' : '#/dashboard');

const app = $('#app');
let cleanup = null; // per-view teardown (e.g., realtime channels)

const MOTTO =
  "Security isn't about knowing everything. It's about knowing what to protect, what can go wrong, and how to minimize the risks.";

// ---------------------------------------------------------------- routes
const routes = [
  { re: /^#?\/?$/, view: () => (state.session ? go(home()) : renderLanding()) },
  { re: /^#\/auth\/reset$/, view: () => renderResetPassword() },
  { re: /^#\/auth(?:\/(signin|signup|forgot))?$/, view: (m) => renderAuth(m[1] || 'signin') },
  { re: /^#\/dashboard$/, auth: true, view: () => renderDashboard(app) },
  { re: /^#\/checklist$/, auth: true, view: () => renderChecklist(app) },
  { re: /^#\/lesson\/(\d+)$/, auth: true, view: (m) => renderLesson(app, Number(m[1])) },
  { re: /^#\/module\/(\d+)\/myths$/, auth: true, view: (m) => renderMyths(app, Number(m[1])) },
  { re: /^#\/labs(?:\/([\w-]+))?$/, view: (m) => renderLabs(app, m[1]) },
  // Old #/reference/glossary and #/reference/myths links land on the case studies.
  { re: /^#\/reference(?:\/[\w-]+)?$/, view: () => renderReference(app) },
  { re: /^#\/admin$/, auth: true, admin: true, view: () => renderAdmin(app) }
];

export function go(hash) {
  if (location.hash === hash) router();
  else location.hash = hash;
}

async function router() {
  if (typeof cleanup === 'function') {
    try { cleanup(); } catch { /* ignore */ }
  }
  cleanup = null;
  const hash = location.hash || '#/';
  const route = routes.find((r) => r.re.test(hash));
  updateNav(hash);
  if (!route) return renderNotFound();
  if (route.auth && !state.session) return go('#/auth/signin');
  if (route.admin && !isAdmin()) {
    app.innerHTML = `<section class="card narrow"><h1>Admins only</h1><p>Your account does not have the admin role.</p><a class="btn" href="#/dashboard">Back to dashboard</a></section>`;
    return;
  }
  try {
    const result = await route.view(hash.match(route.re));
    if (typeof result === 'function') cleanup = result;
    app.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<section class="card narrow"><h1>Something went wrong</h1><p>${esc(err.message || err)}</p><button class="btn" id="retry">Try again</button></section>`;
    $('#retry')?.addEventListener('click', router);
  }
}

// ---------------------------------------------------------------- nav
function updateNav(hash) {
  const signedIn = !!state.session;
  $('#nav-dashboard').hidden = !signedIn;
  $('#nav-checklist').hidden = !signedIn;
  $('#nav-admin').hidden = !isAdmin();
  $('#nav-signin').hidden = signedIn;
  $('#nav-signout').hidden = !signedIn;
  $('#nav-user').textContent = signedIn ? state.profile?.username || state.session.user.email : '';
  $('#nav-user').hidden = !signedIn;
  $('#nav-role').hidden = !isAdmin();
  $$('.nav-links a[data-match]').forEach((a) => {
    a.classList.toggle('active', hash.startsWith(a.dataset.match));
    if (hash.startsWith(a.dataset.match)) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  $('.nav-links').classList.remove('open');
  $('#nav-toggle').setAttribute('aria-expanded', 'false');
}

// ---------------------------------------------------------------- views
function renderLanding() {
  app.innerHTML = `
    <section class="hero">
      <div class="hero-icon">${icons.shield}</div>
      <h1>OpSec <span class="accent">for Dummies</span></h1>
      <p class="motto">&ldquo;${esc(MOTTO)}&rdquo;</p>
      <p class="lead">A free, practical course that teaches ordinary people how to protect their information, devices, accounts, and identity — through plain-language lessons and hands-on simulations.</p>
      <div class="hero-actions">
        <a class="btn primary" href="#/auth/signup">Create free account</a>
        <a class="btn" href="#/labs">Try the labs (no account needed)</a>
      </div>
    </section>
    <section class="grid three">
      <article class="card feature"><h3>${icons.lock} 8 progressive modules</h3><p>From "What is OpSec?" to incident response. Every lesson follows the same six steps and ends with a quiz.</p></article>
      <article class="card feature"><h3>${icons.target} Interactive labs</h3><p>Spot phishing emails, test password strength locally, build a threat model, and find the risks in everyday scenes.</p></article>
      <article class="card feature"><h3>${icons.shield} Track your progress</h3><p>Your progress, quiz scores, and personal security checklist sync to your account.</p></article>
    </section>
    <section class="card">
      <h2>The roadmap</h2>
      <ol class="roadmap-list">
        <li><span class="badge beginner">Beginner</span> Modules 1–3: OpSec basics, social engineering, accounts &amp; identity</li>
        <li><span class="badge intermediate">Intermediate</span> Modules 4–6: devices, networks, privacy &amp; anonymity</li>
        <li><span class="badge advanced">Advanced</span> Modules 7–8: practical OpSec and incident response</li>
      </ol>
    </section>`;
}

/** Password input with an accessible show/hide toggle (wired up by wirePasswordToggles). */
function passwordField({ label, name = 'password', autocomplete, minlength = 1, id }) {
  return `<label for="${id}">${label}</label>
    <div class="pw-field">
      <input id="${id}" name="${name}" type="password" required minlength="${minlength}" autocomplete="${autocomplete}" spellcheck="false" autocapitalize="off">
      <button type="button" class="pw-toggle" data-toggle-password="${id}" aria-controls="${id}" aria-pressed="false" aria-label="Show password">${icons.eyeSm}</button>
    </div>`;
}

function wirePasswordToggles(root) {
  $$('[data-toggle-password]', root).forEach((btn) =>
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.togglePassword);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.innerHTML = show ? icons.eyeOff : icons.eyeSm;
      input.focus({ preventScroll: true });
    })
  );
}

function checkEmailCard(title, email, extra = '') {
  return `<section class="card narrow"><h1>${title}</h1><p>We sent an email to <strong>${esc(email)}</strong>. ${extra}</p>
    <p class="hint">Not there after a few minutes? Check spam or promotions. Never forward these links to anyone.</p>
    <a class="btn" href="#/auth/signin">Back to sign in</a></section>`;
}

function renderAuth(mode) {
  const signup = mode === 'signup';
  const forgot = mode === 'forgot';
  app.innerHTML = `
    <section class="card narrow auth">
      <div class="tabs" role="tablist">
        <a role="tab" href="#/auth/signin" aria-selected="${!signup}" class="${!signup ? 'active' : ''}">Log in</a>
        <a role="tab" href="#/auth/signup" aria-selected="${signup}" class="${signup ? 'active' : ''}">Sign up</a>
      </div>
      <h1>${signup ? 'Create your account' : forgot ? 'Reset your password' : 'Welcome back'}</h1>
      ${forgot ? '<p class="muted">Enter your account email and we\'ll send you a link to choose a new password.</p>' : ''}
      <form id="auth-form" novalidate>
        ${signup ? `<label>Username<input name="username" required minlength="3" maxlength="30" pattern="[A-Za-z0-9_.\\-]+" autocomplete="username"></label>` : ''}
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        ${forgot ? '' : passwordField({ label: 'Password', id: 'auth-password', minlength: signup ? 8 : 1, autocomplete: signup ? 'new-password' : 'current-password' })}
        ${signup ? '<p class="hint">Use at least 8 characters. A long passphrase is best — try it in the Password Strength Lab.</p>' : ''}
        ${!signup && !forgot ? '<p class="auth-links"><a href="#/auth/forgot">Forgot password?</a></p>' : ''}
        <p class="form-error" id="auth-error" role="alert"></p>
        <button class="btn primary block" type="submit">${signup ? 'Create account' : forgot ? 'Send reset link' : 'Log in'}</button>
        ${!signup && !forgot ? '<button class="btn block subtle" type="button" id="magic-link">Email me a sign-in link instead</button>' : ''}
        ${forgot ? '<p class="auth-links"><a href="#/auth/signin">Back to log in</a></p>' : ''}
      </form>
    </section>`;

  const form = $('#auth-form');
  const errEl = $('#auth-error');
  wirePasswordToggles(form);

  const emailValue = () => form.elements.email.value.trim();

  $('#magic-link')?.addEventListener('click', async (e) => {
    errEl.textContent = '';
    if (!form.elements.email.checkValidity()) {
      errEl.textContent = 'Enter your email address first.';
      return form.elements.email.focus();
    }
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email: emailValue(),
        options: { shouldCreateUser: false, emailRedirectTo: SIGNIN_REDIRECT() }
      });
      if (error) throw error;
      app.innerHTML = checkEmailCard('Check your email', emailValue(), 'Open the link in this browser to sign in. It expires after a short time.');
    } catch (err) {
      errEl.textContent = err.message || 'Could not send the sign-in link';
    } finally {
      btn.disabled = false;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    if (!form.checkValidity()) {
      errEl.textContent = signup
        ? 'Please enter a username (3–30 letters, numbers, _ . -), a valid email, and a password of at least 8 characters.'
        : forgot
          ? 'Please enter a valid email address.'
          : 'Please enter your email and password.';
      return;
    }
    const fd = new FormData(form);
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const supabase = await getSupabase();
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(emailValue(), { redirectTo: RECOVERY_REDIRECT() });
        if (error) throw error;
        // Same message whether or not the account exists, so the form can't be used to find accounts.
        app.innerHTML = checkEmailCard('Check your email', emailValue(), 'If an account exists for this address, the email has a link to choose a new password.');
      } else if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email: emailValue(),
          password: fd.get('password'),
          options: { data: { username: fd.get('username').trim() }, emailRedirectTo: SIGNIN_REDIRECT() }
        });
        if (error) throw error;
        if (!data.session) {
          app.innerHTML = checkEmailCard('Confirm your email', emailValue(), 'Open the confirmation link to activate your account. You\'ll start with a quick Security Checklist.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: emailValue(), password: fd.get('password') });
        if (error) throw error;
      }
    } catch (err) {
      errEl.textContent = err.message || 'Authentication failed';
    } finally {
      btn.disabled = false;
    }
  });
}

/** Shown after the user follows a password-reset email link. */
function renderResetPassword() {
  if (!state.session) {
    app.innerHTML = `<section class="card narrow"><h1>Reset link expired</h1>
      <p>This password reset link is invalid or has expired. Request a new one.</p>
      <a class="btn primary" href="#/auth/forgot">Send a new link</a></section>`;
    return;
  }
  app.innerHTML = `
    <section class="card narrow auth">
      <h1>Choose a new password</h1>
      <form id="reset-form" novalidate>
        ${passwordField({ label: 'New password', id: 'new-password', minlength: 8, autocomplete: 'new-password' })}
        ${passwordField({ label: 'Confirm new password', name: 'confirm', id: 'confirm-password', minlength: 8, autocomplete: 'new-password' })}
        <p class="hint">At least 8 characters. A long passphrase is best.</p>
        <p class="form-error" id="reset-error" role="alert"></p>
        <button class="btn primary block" type="submit">Update password</button>
      </form>
    </section>`;
  const form = $('#reset-form');
  wirePasswordToggles(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('#reset-error');
    errEl.textContent = '';
    const pw = form.elements.password.value;
    if (!form.checkValidity()) return (errEl.textContent = 'Use at least 8 characters.');
    if (pw !== form.elements.confirm.value) return (errEl.textContent = 'The passwords don\'t match.');
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast('Password updated', 'success');
      go(home());
    } catch (err) {
      errEl.textContent = err.message || 'Could not update your password';
    } finally {
      btn.disabled = false;
    }
  });
}

function renderNotFound() {
  app.innerHTML = `<section class="card narrow"><h1>Page not found</h1><a class="btn" href="#/">Go home</a></section>`;
}

// ---------------------------------------------------------------- boot
async function handleSession(session) {
  const wasSignedIn = !!state.session;
  if (session) {
    const sameUser = wasSignedIn && state.session.user.id === session.user.id;
    state.session = session;
    if (sameUser) return; // e.g. SIGNED_IN re-fired on tab focus: don't re-render mid-lesson
    try {
      await loadProfile();
    } catch (err) {
      console.error(err);
      toast('Could not load your profile', 'error');
    }
    if (!wasSignedIn && location.hash.startsWith('#/auth') && location.hash !== '#/auth/reset') return go(home());
  } else {
    clearState();
    if (wasSignedIn) return go('#/');
  }
  router();
}

async function boot() {
  $('#nav-toggle').addEventListener('click', () => {
    const open = $('.nav-links').classList.toggle('open');
    $('#nav-toggle').setAttribute('aria-expanded', String(open));
  });
  // Read auth-email redirect details before supabase-js consumes the URL.
  //   ?auth=recovery            → came from a password-reset email
  //   #error=...&error_description=... → the email link was invalid or expired
  const params = new URLSearchParams(location.search);
  const isRecovery = params.get('auth') === 'recovery';
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const linkError = hashParams.get('error_description') || (hashParams.get('error') ? 'This link is invalid or has expired.' : null);
  if (linkError) history.replaceState(null, '', `${location.pathname}${location.search}#/auth/signin`);

  window.addEventListener('hashchange', router);

  let supabase;
  try {
    supabase = await getSupabase();
  } catch (err) {
    app.innerHTML = `<section class="card narrow"><h1>Configuration error</h1><p>${esc(err.message)}</p><p class="hint">Set SUPABASE_URL and SUPABASE_ANON_KEY in your Vercel project's environment variables, then redeploy.</p></section>`;
    return;
  }

  $('#nav-signout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    toast('Signed out');
  });

  const { data } = await supabase.auth.getSession();
  state.session = data.session;
  if (state.session) await loadProfile().catch((e) => console.error(e));
  if (isRecovery) history.replaceState(null, '', `${location.pathname}#/auth/reset`);
  router();
  if (linkError) {
    const errEl = $('#auth-error');
    if (errEl) errEl.textContent = `${linkError.replace(/\.?\s*$/, '.')} Request a new email below.`;
    else toast(linkError, 'error');
  }

  // Per Supabase guidance, avoid awaiting Supabase calls directly inside this callback.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return;
    if (event === 'PASSWORD_RECOVERY') {
      setTimeout(async () => {
        state.session = session;
        await loadProfile().catch((e) => console.error(e));
        go('#/auth/reset');
      }, 0);
      return;
    }
    if (event === 'TOKEN_REFRESHED') {
      state.session = session;
      return;
    }
    setTimeout(() => handleSession(session), 0);
  });
}

boot();
