// Small DOM and formatting helpers. All untrusted text goes through esc().

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders lesson text: blank line = paragraph, "- " lines = bullet list.
 * Input is escaped first, so stored content cannot inject HTML.
 */
export function richText(text) {
  if (!text) return '';
  const blocks = String(text).replace(/\r\n/g, '\n').split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const lines = block.split('\n').filter((l) => l.trim());
      if (!lines.length) return '';
      const isList = lines.every((l) => /^\s*-\s+/.test(l));
      if (isList) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*-\s+/, ''))}</li>`).join('')}</ul>`;
      // Mixed block: leading text then bullets
      const firstBullet = lines.findIndex((l) => /^\s*-\s+/.test(l));
      if (firstBullet > 0 && lines.slice(firstBullet).every((l) => /^\s*-\s+/.test(l))) {
        return `<p>${lines.slice(0, firstBullet).map(esc).join('<br>')}</p><ul>${lines
          .slice(firstBullet)
          .map((l) => `<li>${inline(l.replace(/^\s*-\s+/, ''))}</li>`)
          .join('')}</ul>`;
      }
      return `<p>${lines.map(esc).join('<br>')}</p>`;
    })
    .join('');
}

// Escapes, then bolds text before the first " — " or ": " in list items like "Step 1 — ..."
function inline(s) {
  const e = esc(s);
  const m = /^([^:—,]{2,30})(\s—\s|:\s)(.+)$/.exec(e);
  return m ? `<strong>${m[1]}</strong>${m[2]}${m[3]}` : e;
}

/** Only plain https links are rendered, so a bad database value cannot become a javascript: URL. */
export function safeUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}
export function $$(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

let toastTimer;
export function toast(message, type = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 3500);
}

export const icons = {
  shield: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>`,
  unlock: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 017.5-2"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`,
  key: `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/></svg>`,
  target: `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>`,
  eyeSm: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 19c-7 0-11-7-11-7a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 7 11 7a18.5 18.5 0 01-2.16 3.19"/><path d="M14.12 14.12a3 3 0 11-4.24-4.24"/><path d="M1 1l22 22"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`
};

export function pct(n, d) {
  return d ? Math.round((n / d) * 100) : 0;
}

/** Day-of-year index, used to rotate the daily tip. */
export function dayIndex(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000);
}
