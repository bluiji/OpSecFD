// Boot, auth session handling, navigation, and hash router.
import { getSupabase } from './supabaseClient.js';
import { state, loadProfile, clearState, isAdmin } from './state.js';
import { $, $$, esc, toast, icons } from './utils.js';
import { renderDashboard } from './views/dashboard.js';
import { renderLesson } from './views/lesson.js';
import { renderLabs } from './views/labs.js';
import { renderReference } from './views/reference.js';
import { renderAdmin } from './views/admin.js';

const app = $('#app');
let cleanup = null; // per-view teardown (e.g., realtime channels)

const MOTTO =
  "Security isn't about knowing everything. It's about knowing what to protect, what can go wrong, and how to minimize the risks.";

// ---------------------------------------------------------------- routes
const routes = [
  { re: /^#?\/?$/, view: () => (state.session ? go('#/dashboard') : renderLanding()) },
  { re: /^#\/auth(?:\/(signin|signup))?$/, view: (m) => renderAuth(m[1] || 'signin') },
  { re: /^#\/dashboard$/, auth: true, view: () => renderDashboard(app) },
  { re: /^#\/lesson\/(\d+)$/, auth: true, view: (m) => renderLesson(app, Number(m[1])) },
  { re: /^#\/labs(?:\/([\w-]+))?$/, view: (m) => renderLabs(app, m[1]) },
  { re: /^#\/reference(?:\/([\w-]+))?$/, view: (m) => renderReference(app, m[1]) },
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

function renderAuth(mode) {
  const signup = mode === 'signup';
  app.innerHTML = `
    <section class="card narrow auth">
      <div class="tabs" role="tablist">
        <a role="tab" href="#/auth/signin" aria-selected="${!signup}" class="${!signup ? 'active' : ''}">Sign in</a>
        <a role="tab" href="#/auth/signup" aria-selected="${signup}" class="${signup ? 'active' : ''}">Sign up</a>
      </div>
      <h1>${signup ? 'Create your account' : 'Welcome back'}</h1>
      <form id="auth-form" novalidate>
        ${signup ? `<label>Username<input name="username" required minlength="3" maxlength="30" pattern="[A-Za-z0-9_.\\-]+" autocomplete="username"></label>` : ''}
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Password<input name="password" type="password" required minlength="${signup ? 8 : 1}" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
        ${signup ? '<p class="hint">Use at least 8 characters. A long passphrase is best — try it in the Password Strength Lab.</p>' : ''}
        <p class="form-error" id="auth-error" role="alert"></p>
        <button class="btn primary block" type="submit">${signup ? 'Create account' : 'Sign in'}</button>
      </form>
    </section>`;

  $('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const errEl = $('#auth-error');
    errEl.textContent = '';
    if (!form.checkValidity()) {
      errEl.textContent = signup
        ? 'Please enter a username (3–30 letters, numbers, _ . -), a valid email, and a password of at least 8 characters.'
        : 'Please enter your email and password.';
      return;
    }
    const fd = new FormData(form);
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const supabase = await getSupabase();
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email: fd.get('email').trim(),
          password: fd.get('password'),
          options: { data: { username: fd.get('username').trim() }, emailRedirectTo: location.origin }
        });
        if (error) throw error;
        if (!data.session) {
          app.innerHTML = `<section class="card narrow"><h1>Check your email</h1><p>We sent a confirmation link to <strong>${esc(fd.get('email'))}</strong>. Open it to activate your account, then sign in.</p><p class="hint">Not there? Check spam. Never forward this link to anyone.</p></section>`;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: fd.get('email').trim(),
          password: fd.get('password')
        });
        if (error) throw error;
      }
    } catch (err) {
      errEl.textContent = err.message || 'Authentication failed';
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
    if (!wasSignedIn && location.hash.startsWith('#/auth')) return go('#/dashboard');
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
  router();

  // Per Supabase guidance, avoid awaiting Supabase calls directly inside this callback.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return;
    if (event === 'TOKEN_REFRESHED') {
      state.session = session;
      return;
    }
    setTimeout(() => handleSession(session), 0);
  });
}

boot();
