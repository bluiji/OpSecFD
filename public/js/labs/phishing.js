// Phishing Detector: a simulated inbox. All brands and domains are fictional (.example is reserved, RFC 2606).
import { $, $$, esc } from '../utils.js';

// Body text supports [[link text|real url]] tokens.
export const EMAILS = [
  {
    id: 1, fromName: 'NorthBank Security', from: 'alerts@northbank-secure-verify.example', replyTo: 'support@nb-helpdesk.example',
    subject: 'URGENT: Unusual sign-in — account will be locked in 2 hours', date: 'Today 07:12',
    body: 'Dear Valued Customer,\n\nWe detected an unusual sign-in attempt on your account. To avoid permanent suspension, verify your identity within 2 hours.\n\n[[Verify My Account|http://northbank.example.account-check.example/login]]\n\nNorthBank Security Team',
    verdict: 'phishing',
    flags: [
      'Sender domain is northbank-secure-verify.example, not northbank.example.',
      'Reply-To goes to a different domain (nb-helpdesk.example).',
      'The link\'s real domain is account-check.example; "northbank.example" is only a subdomain label.',
      'Extreme urgency (2 hours) and a threat of suspension.',
      'Generic greeting: "Dear Valued Customer".'
    ]
  },
  {
    id: 2, fromName: 'ParcelGo', from: 'no-reply@parcelgo.example', replyTo: 'no-reply@parcelgo.example',
    subject: 'Your order #48213 has shipped', date: 'Today 09:40',
    body: 'Hi Jamie,\n\nYour package from Bookshelf Store has shipped and is expected Thursday.\n\nTrack it any time in the ParcelGo app or at [[parcelgo.example/track|https://parcelgo.example/track/48213]].\n\nNo action is needed.',
    verdict: 'safe',
    flags: [
      'Sender and link both use the real domain parcelgo.example over HTTPS.',
      'Uses your name and refers to an order you placed.',
      'No pressure, no request for payment or credentials.',
      'Tip: even with a good-looking email, opening the app directly is the safest habit.'
    ]
  },
  {
    id: 3, fromName: 'Maria Lopez (CEO)', from: 'maria.lopez.ceo@freemail.example', replyTo: 'maria.lopez.ceo@freemail.example',
    subject: 'Quick favor — are you at your desk?', date: 'Yesterday 16:55',
    body: 'Hi,\n\nI\'m in a meeting and can\'t talk. I need you to buy 5 gift cards for a client today. Keep this between us for now; I\'ll explain later.\n\nReply with the card codes as soon as you have them.\n\nMaria\nSent from my phone',
    verdict: 'phishing',
    flags: [
      'Executive using a free personal email address instead of the company domain.',
      'Gift-card request is a classic scam: codes are untraceable once shared.',
      'Asks for secrecy and urgency, and says she cannot talk (to prevent verification).',
      'Correct response: verify by calling the real person on a known number.'
    ]
  },
  {
    id: 4, fromName: 'CloudDrive', from: 'storage@clouddrive-alerts.example', replyTo: 'storage@clouddrive-alerts.example',
    subject: 'Your storage is 100% full — files will be deleted', date: 'Yesterday 11:03',
    body: 'Your CloudDrive storage is full. Your photos and documents will be deleted in 24 hours unless you upgrade.\n\n[[Keep my files (free upgrade)|https://clouddrive.example-storage-upgrade.example/keep]]\n\nThank you for choosing CloudDrive.',
    verdict: 'phishing',
    flags: [
      'Sender domain is clouddrive-alerts.example, not clouddrive.example.',
      'Real link domain is example-storage-upgrade.example.',
      'Threat of deleting your files plus a 24-hour deadline.',
      'A "free upgrade" that requires logging in through an email link.'
    ]
  },
  {
    id: 5, fromName: 'Campus IT Services', from: 'it-notices@university.example', replyTo: 'it-notices@university.example',
    subject: 'Scheduled maintenance this Saturday', date: 'Mon 08:00',
    body: 'Hello,\n\nThe student portal will be unavailable Saturday from 01:00 to 05:00 for planned maintenance. You do not need to do anything.\n\nIT staff will never ask for your password. Status updates: [[status.university.example|https://status.university.example]]\n\nCampus IT Services',
    verdict: 'safe',
    flags: [
      'Sender and link use the organization\'s own domain.',
      'Informational only: no link to log in, no request for data.',
      'Reminds you that IT will never ask for your password — a good sign.'
    ]
  },
  {
    id: 6, fromName: 'PayWallet Support', from: 'support@paywallet.example', replyTo: 'claims@paywa11et-refunds.example',
    subject: 'Refund of 2,450.00 pending — confirm details', date: 'Sun 21:18',
    body: 'Good day!\n\nYou are eligible for a refund of 2,450.00. To receive it, confirm your account by entering your MPIN and the one-time code we will send you.\n\n[[Claim refund|https://paywa11et-refunds.example/claim]]\n\nPayWallet',
    verdict: 'phishing',
    flags: [
      'The From address may look right, but Reply-To and the link use paywa11et (ones instead of Ls).',
      'Legitimate services never ask for your PIN/MPIN or one-time code.',
      'Unexpected money is bait to make you act fast.',
      'Note: From addresses can be spoofed, so always check links and requests, not just the sender.'
    ]
  }
];

function bodyHTML(text) {
  return esc(text)
    .split(/\n\n/)
    .map((p) =>
      `<p>${p
        .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_, t, u) => `<a href="#" class="sim-link" data-url="${u}">${t}</a>`)
        .replace(/\n/g, '<br>')}</p>`
    )
    .join('');
}

export function renderPhishingLab(root) {
  const answers = new Map();
  let current = EMAILS[0].id;

  root.innerHTML = `
    <section class="page-head"><h1>Phishing Detector</h1>
      <p class="muted">Open each email, inspect the sender details, and hover (or focus) links to see where they really go. Then decide: Safe or Phishing? Links in this simulator never open.</p></section>
    <div class="inbox card">
      <aside class="inbox-list" aria-label="Inbox"><div class="inbox-score" id="ph-score"></div><ul id="ph-list"></ul></aside>
      <section class="inbox-reader" id="ph-reader" aria-live="polite"></section>
    </div>
    <div class="statusbar" id="ph-status" aria-live="polite">Hover over a link to preview its destination</div>`;

  const status = $('#ph-status', root);

  function renderList() {
    $('#ph-list', root).innerHTML = EMAILS.map((m) => {
      const a = answers.get(m.id);
      const mark = a == null ? '' : a === m.verdict ? '<span class="pill ok">✓</span>' : '<span class="pill bad">✗</span>';
      return `<li><button class="mail-item ${m.id === current ? 'active' : ''}" data-id="${m.id}">
        <span class="mail-from">${esc(m.fromName)} ${mark}</span><span class="mail-subj">${esc(m.subject)}</span><span class="mail-date">${esc(m.date)}</span></button></li>`;
    }).join('');
    const done = answers.size;
    const right = EMAILS.filter((m) => answers.get(m.id) === m.verdict).length;
    $('#ph-score', root).innerHTML = `<strong>${right}/${done}</strong> correct · ${EMAILS.length - done} left${done === EMAILS.length ? ` · <button class="btn small" id="ph-reset">Restart</button>` : ''}`;
    $('#ph-reset', root)?.addEventListener('click', () => { answers.clear(); current = EMAILS[0].id; renderList(); renderReader(); });
    $$('.mail-item', root).forEach((b) => b.addEventListener('click', () => { current = Number(b.dataset.id); renderList(); renderReader(); }));
  }

  function renderReader() {
    const m = EMAILS.find((e) => e.id === current);
    const a = answers.get(m.id);
    $('#ph-reader', root).innerHTML = `
      <h2 class="mail-subject">${esc(m.subject)}</h2>
      <dl class="mail-headers">
        <dt>From</dt><dd><strong>${esc(m.fromName)}</strong> &lt;${esc(m.from)}&gt;</dd>
        <dt>Reply-To</dt><dd>${esc(m.replyTo)}</dd>
        <dt>To</dt><dd>you@mail.example</dd>
        <dt>Date</dt><dd>${esc(m.date)}</dd>
      </dl>
      <div class="mail-body">${bodyHTML(m.body)}</div>
      <div class="verdict-actions">
        <button class="btn ok" data-v="safe" ${a ? 'disabled' : ''}>Mark as Safe</button>
        <button class="btn danger" data-v="phishing" ${a ? 'disabled' : ''}>Report Phishing</button>
      </div>
      <div id="ph-feedback">${a ? feedbackHTML(m, a) : ''}</div>`;

    $$('.sim-link', root).forEach((l) => {
      const show = () => (status.innerHTML = `Link goes to: <code>${esc(l.dataset.url)}</code>`);
      const hide = () => (status.textContent = 'Hover over a link to preview its destination');
      l.addEventListener('mouseenter', show);
      l.addEventListener('focus', show);
      l.addEventListener('mouseleave', hide);
      l.addEventListener('blur', hide);
      l.addEventListener('click', (e) => {
        e.preventDefault();
        show();
        status.classList.add('flash');
        setTimeout(() => status.classList.remove('flash'), 600);
      });
    });
    $$('[data-v]', root).forEach((b) =>
      b.addEventListener('click', () => {
        answers.set(m.id, b.dataset.v);
        renderList();
        renderReader();
      })
    );
  }

  function feedbackHTML(m, a) {
    const ok = a === m.verdict;
    return `<div class="feedback ${ok ? 'ok' : 'bad'}">
      <strong>${ok ? 'Correct!' : 'Not quite.'} This email is ${m.verdict === 'phishing' ? 'PHISHING' : 'SAFE'}.</strong>
      <ul>${m.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>`;
  }

  renderList();
  renderReader();
}
