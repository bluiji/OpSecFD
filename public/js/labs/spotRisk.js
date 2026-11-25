// Privacy Checkup & Spot the Risk: click the mistakes in everyday scenes, then self-assess.
import { $, $$, esc, pct } from '../utils.js';

export const SCENES = [
  {
    id: 'cafe', title: 'Coffee shop', setup: 'You are working from a busy café for the afternoon.',
    items: [
      { t: 'Laptop connected to "FREE_Cafe_WiFi_5G" (not the name on the café\'s sign)', risk: true, why: 'Could be an evil-twin hotspot. Confirm the network name with staff or use your mobile hotspot.' },
      { t: 'Phone left unlocked on the table while ordering at the counter', risk: true, why: 'Anyone can grab it and open your apps. Lock it and keep it with you.' },
      { t: 'Person at the next table can see your screen while you open online banking', risk: true, why: 'Shoulder surfing. Sit with your back to a wall or use a privacy filter.' },
      { t: 'Your browser shows HTTPS on your webmail', risk: false, why: 'Good: the connection is encrypted. (HTTPS alone doesn\'t prove a site is real, but here it\'s your bookmarked webmail.)' },
      { t: 'You ignore a pop-up asking you to install a "Wi-Fi accelerator" app', risk: false, why: 'Correct choice: unexpected installers are a common malware trick.' },
      { t: 'A sticky note with your laptop password is stuck under the keyboard', risk: true, why: 'Written passwords near the device defeat the lock. Use a password manager.' }
    ]
  },
  {
    id: 'post', title: 'Social media post', setup: 'A friend is about to post: "First day at my new job! 🎉" with a photo.',
    items: [
      { t: 'The company ID badge, with name and barcode, is clearly visible', risk: true, why: 'Badges can be copied or used for impersonation. Hide or blur them.' },
      { t: 'The post is set to Public', risk: true, why: 'Strangers and scammers can see it. Limit to friends.' },
      { t: 'Location tag shows the exact office building', risk: true, why: 'Reveals where you\'ll be every weekday. Skip precise location tags.' },
      { t: 'Caption mentions "out for a trip to Cebu all next week!"', risk: true, why: 'Announces your home will be empty. Post travel after you return.' },
      { t: 'The photo shows a generic smile in front of a plant', risk: false, why: 'Nothing sensitive here — sharing positive moments is fine.' },
      { t: 'Only first name is used in the caption', risk: false, why: 'Sharing less identifying info is a good habit.' }
    ]
  },
  {
    id: 'home', title: 'Home office', setup: 'You set up a new home workspace.',
    items: [
      { t: 'Router still uses the admin password printed on its sticker', risk: true, why: 'Default credentials are widely known. Change it.' },
      { t: 'Smart TV and visitors use the same Wi-Fi as your work laptop', risk: true, why: 'Use a guest network to separate untrusted devices.' },
      { t: 'Laptop has FileVault/BitLocker turned on', risk: false, why: 'Good: data is protected if the laptop is stolen.' },
      { t: 'Bank statements are thrown in the regular trash', risk: true, why: 'Shred documents with account numbers and personal details.' },
      { t: 'Video-call background shows a whiteboard with a client\'s password', risk: true, why: 'Check what\'s visible on camera before calls.' },
      { t: 'Backups run nightly to an external drive that you then unplug', risk: false, why: 'Good: an offline copy can survive ransomware.' }
    ]
  },
  {
    id: 'travel', title: 'Airport', setup: 'You are waiting for a flight.',
    items: [
      { t: 'You post a photo of your boarding pass with the barcode visible', risk: true, why: 'Boarding pass barcodes can contain your name and booking reference, which can expose or change your booking.' },
      { t: 'You charge your phone at a public USB port with a cable you found there', risk: true, why: 'Use your own adapter and cable, or a charge-only cable.' },
      { t: 'Bluetooth and AirDrop are set to "Everyone"', risk: true, why: 'Strangers can send you files or messages. Set to Contacts Only or turn off.' },
      { t: 'You use your mobile data instead of the airport Wi-Fi for banking', risk: false, why: 'Good: avoids an untrusted shared network.' },
      { t: 'Your bag tag shows only your last name and phone number', risk: false, why: 'Reasonable: enough to return the bag without exposing your home address.' },
      { t: 'You leave your laptop on the seat while you get coffee', risk: true, why: 'Theft happens in seconds. Keep devices with you.' }
    ]
  }
];

export const CHECKUP = [
  ['Is multi-factor authentication on for your primary email?', 'Turn on MFA for your email first — it protects everything else.'],
  ['Do you use a different password for every important account?', 'Set up a password manager and replace reused passwords.'],
  ['Are your social media posts visible to friends only?', 'Run each platform\'s privacy checkup and limit old posts.'],
  ['Have you reviewed which apps can access your location in the last 3 months?', 'Switch "Always" location access to "While using" or "Never".'],
  ['Do your phone and computer install updates automatically?', 'Enable automatic updates and restart when prompted.'],
  ['Is your phone protected by a PIN/passcode of 6+ digits or a passphrase?', 'Use a longer PIN or passphrase with biometrics.'],
  ['Do you have a backup of your important files that is not always connected?', 'Follow the 3-2-1 rule with one offline or versioned copy.'],
  ['Do you know how to report fraud to your bank/e-wallet and your national cybercrime hotline?', 'Save those numbers now (see Module 8: Reporting Cybercrime).']
];

export function renderSpotRiskLab(root) {
  root.innerHTML = `
    <section class="page-head"><h1>Privacy Checkup &amp; Spot the Risk</h1>
      <p class="muted">Part 1: click every security mistake in each scene. Part 2: score your own habits.</p></section>
    <div class="tabs" role="tablist">${SCENES.map((s, i) => `<button role="tab" class="${i === 0 ? 'active' : ''}" data-scene="${s.id}">${esc(s.title)}</button>`).join('')}<button role="tab" data-scene="checkup">My privacy checkup</button></div>
    <section class="card" id="sr-body"></section>`;

  const body = $('#sr-body', root);
  const found = new Map(SCENES.map((s) => [s.id, new Set()]));

  const showScene = (id) => {
    $$('[data-scene]', root).forEach((b) => b.classList.toggle('active', b.dataset.scene === id));
    if (id === 'checkup') return showCheckup();
    const s = SCENES.find((x) => x.id === id);
    const clicked = found.get(id);
    const total = s.items.filter((i) => i.risk).length;
    const got = s.items.filter((i, idx) => i.risk && clicked.has(idx)).length;
    body.innerHTML = `<h2>${esc(s.title)}</h2><p>${esc(s.setup)}</p>
      <p class="score-line"><strong>${got} of ${total}</strong> risks found${got === total ? ' — all found!' : ''}</p>
      <div class="scene-grid">${s.items.map((it, idx) => {
        const c = clicked.has(idx);
        const cls = c ? (it.risk ? 'risk' : 'safe') : '';
        return `<button class="scene-item ${cls}" data-i="${idx}" aria-pressed="${c}">
          <span>${esc(it.t)}</span>${c ? `<span class="why"><strong>${it.risk ? 'Risk!' : 'This one\'s OK.'}</strong> ${esc(it.why)}</span>` : ''}</button>`;
      }).join('')}</div>
      <div class="wizard-nav"><button class="btn" id="reveal">Reveal all</button><button class="btn" id="reset">Reset</button></div>`;
    $$('.scene-item', body).forEach((b) => b.addEventListener('click', () => { clicked.add(Number(b.dataset.i)); showScene(id); }));
    $('#reveal', body).addEventListener('click', () => { s.items.forEach((_, i) => clicked.add(i)); showScene(id); });
    $('#reset', body).addEventListener('click', () => { clicked.clear(); showScene(id); });
  };

  const showCheckup = () => {
    body.innerHTML = `<h2>My privacy checkup</h2><p class="muted">Answer honestly. Nothing is saved or sent.</p>
      <form id="ck">${CHECKUP.map(([q], i) => `<fieldset class="q"><legend>${i + 1}. ${esc(q)}</legend>
        <label class="opt inline"><input type="radio" name="c${i}" value="1" required> Yes</label>
        <label class="opt inline"><input type="radio" name="c${i}" value="0"> No / not sure</label></fieldset>`).join('')}
        <p class="form-error" id="ck-err" role="alert"></p>
        <button class="btn primary">See my score</button></form><div id="ck-result" aria-live="polite"></div>`;
    $('#ck', body).addEventListener('submit', (e) => {
      e.preventDefault();
      const vals = CHECKUP.map((_, i) => e.target.querySelector(`input[name="c${i}"]:checked`)?.value);
      if (vals.some((v) => v == null)) return ($('#ck-err', body).textContent = 'Please answer every question.');
      $('#ck-err', body).textContent = '';
      const yes = vals.filter((v) => v === '1').length;
      const score = pct(yes, CHECKUP.length);
      const todo = CHECKUP.filter((_, i) => vals[i] === '0').map(([, tip]) => tip);
      $('#ck-result', body).innerHTML = `<div class="quiz-score ${score >= 75 ? 'ok' : 'bad'}"><div class="big">${score}%</div>
        <div><strong>${yes} of ${CHECKUP.length} habits in place</strong> (${yes} ÷ ${CHECKUP.length} × 100 = ${score}%).</div></div>
        ${todo.length ? `<h3>Your next steps</h3><ol class="plan">${todo.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : '<p class="ok-text">Every habit is in place. Review again in a few months.</p>'}`;
    });
  };

  $$('[data-scene]', root).forEach((b) => b.addEventListener('click', () => showScene(b.dataset.scene)));
  showScene(SCENES[0].id);
}
