// Threat Modeling Simulator: asset → threats → weaknesses → prioritized plan.
import { $, $$, esc } from '../utils.js';

// Each threat lists weaknesses (things the user may currently do) with the fix for each,
// plus baseline mitigations recommended regardless.
export const ASSETS = [
  {
    id: 'email', name: 'Primary email account', why: 'It can reset passwords for almost every other account.',
    threats: [
      { id: 'phish', name: 'Phishing for my password', weak: [
        ['I sometimes log in through links in emails or texts', 'Always open the site or app directly; never log in from a message link.'],
        ['I don\'t use a password manager', 'Use a password manager — it won\'t auto-fill on fake domains.']
      ], base: ['Switch to phishing-resistant MFA (passkey or security key) where offered.'] },
      { id: 'stuff', name: 'Reused password from another site\'s breach', weak: [
        ['My email password is used on other sites', 'Give your email a unique, long password today.'],
        ['I don\'t have MFA on my email', 'Turn on MFA (authenticator app or passkey) for your email.']
      ], base: ['Check your address on a breach-notification service such as Have I Been Pwned.'] },
      { id: 'recovery', name: 'Takeover through account recovery', weak: [
        ['My recovery phone/email is old or I don\'t know what it is', 'Review and update recovery options; remove old ones.'],
        ['My security answers are real facts others could find', 'Replace security answers with random ones stored in your password manager.']
      ], base: ['Save backup codes offline.', 'Ask your mobile carrier about a SIM lock or port-out PIN.'] }
    ]
  },
  {
    id: 'phone', name: 'Smartphone', why: 'It holds your messages, photos, banking apps, and receives your login codes.',
    threats: [
      { id: 'theft', name: 'Theft or loss', weak: [
        ['I use no lock, a pattern, or a 4-digit PIN', 'Use a 6+ digit PIN or passphrase with biometrics.'],
        ['Find My / Find My Device is off', 'Turn on Find My (iPhone) or Find My Device (Android) and remote erase.']
      ], base: ['Hide message previews on the lock screen.', 'Back up photos and data regularly.'] },
      { id: 'malware', name: 'Malicious or spyware apps', weak: [
        ['I install apps from outside the official store', 'Install apps only from the official app store.'],
        ['I rarely review app permissions', 'Review camera, mic, location, and contacts permissions; revoke what isn\'t needed.'],
        ['Others sometimes know my passcode or use my phone unattended', 'Change your passcode and check for unknown apps or device-admin profiles.']
      ], base: ['Keep the OS and apps updated automatically.'] },
      { id: 'sim', name: 'SIM swap to steal my codes', weak: [
        ['SMS is my only second factor for banking/email', 'Move important accounts to an authenticator app or passkey where supported.'],
        ['My phone number is public on social media', 'Remove your number from public profiles.']
      ], base: ['Set a SIM PIN and ask your carrier about account locks.'] }
    ]
  },
  {
    id: 'router', name: 'Home Wi-Fi router', why: 'Every device in your home passes traffic through it.',
    threats: [
      { id: 'takeover', name: 'Router takeover by internet scans or malware', weak: [
        ['The admin password is the default on the sticker', 'Change the router admin password to a unique one.'],
        ['I have never updated the firmware', 'Update firmware, or replace the router if it no longer gets updates.'],
        ['Remote management is on (or I don\'t know)', 'Disable remote administration unless you need it.']
      ], base: ['Disable WPS and UPnP if you don\'t need them.'] },
      { id: 'neighbors', name: 'Unwanted people on my Wi-Fi', weak: [
        ['My Wi-Fi password is short or widely shared', 'Use a long Wi-Fi passphrase and change it after sharing widely.'],
        ['I use WEP, WPA (v1), or an open network', 'Switch to WPA3, or WPA2-AES if WPA3 isn\'t available.']
      ], base: ['Create a guest network for visitors and smart devices.'] }
    ]
  },
  {
    id: 'social', name: 'Social media accounts', why: 'Takeovers are used to scam your friends and family, and posts reveal personal details.',
    threats: [
      { id: 'takeover', name: 'Account takeover', weak: [
        ['No MFA on my social accounts', 'Enable MFA on every social account.'],
        ['I\'ve shared login codes with people who asked', 'Never share codes; sign out all sessions and change your password.']
      ], base: ['Review active sessions and remove unknown devices.'] },
      { id: 'oversharing', name: 'Oversharing / stalking', weak: [
        ['My posts and friends list are public', 'Limit past and future posts to friends; hide your friends list.'],
        ['I post my location in real time', 'Post after you leave a place; turn off location tags.'],
        ['Anyone can tag me without approval', 'Require tag review/approval.']
      ], base: ['Search your own name to see what strangers can find.'] }
    ]
  },
  {
    id: 'money', name: 'Bank & e-wallet accounts', why: 'Direct access to your money; transfers can be hard to reverse.',
    threats: [
      { id: 'otp', name: 'Scammers tricking me into sharing OTPs or PINs', weak: [
        ['I\'d trust a caller who says they\'re from my bank', 'Hang up and call the number on your card or the official app.'],
        ['I tap links in "account problem" texts', 'Never use message links for banking; open the official app.']
      ], base: ['Turn on transaction alerts.', 'Save your provider\'s official fraud hotline now.'] },
      { id: 'scam', name: 'Investment, job, or marketplace scams', weak: [
        ['I have sent money to people I only know online', 'Pause and verify with someone you trust before sending money.'],
        ['I pay sellers outside the marketplace\'s payment system', 'Keep payments inside platforms with buyer protection.']
      ], base: ['Remember: never pay a fee to receive money, a prize, or a job.'] }
    ]
  },
  {
    id: 'laptop', name: 'Laptop / computer', why: 'Stores your files and stays signed in to many accounts.',
    threats: [
      { id: 'ransom', name: 'Ransomware or malware', weak: [
        ['I use pirated software or "cracks"', 'Remove pirated software; use official or free legitimate alternatives.'],
        ['Automatic updates are off', 'Turn on automatic OS and browser updates.'],
        ['I have no backups (or only on a drive that stays plugged in)', 'Set up 3-2-1 backups with one copy offline or versioned.']
      ], base: ['Keep built-in antivirus (e.g. Microsoft Defender) turned on.'] },
      { id: 'theft', name: 'Theft or someone using it unattended', weak: [
        ['Disk encryption is off (or I don\'t know)', 'Turn on BitLocker/Device Encryption (Windows) or FileVault (macOS).'],
        ['I leave it unlocked when I step away', 'Lock the screen every time (Windows+L / Ctrl+Cmd+Q).']
      ], base: ['Use a strong login password and short auto-lock.'] }
    ]
  }
];

export function buildPlan(asset, threatIds, weakKeys) {
  const high = [];
  const recommended = [];
  for (const t of asset.threats.filter((x) => threatIds.includes(x.id))) {
    t.weak.forEach(([w, fix], i) => {
      if (weakKeys.includes(`${t.id}:${i}`)) high.push({ threat: t.name, weakness: w, fix });
    });
    t.base.forEach((fix) => recommended.push({ threat: t.name, fix }));
  }
  return { high, recommended };
}

export function renderThreatLab(root) {
  const st = { step: 1, asset: null, threats: [], weak: [] };

  const render = () => {
    const steps = ['Choose an asset', 'Pick threats', 'Check weaknesses', 'Your plan'];
    root.innerHTML = `
      <section class="page-head"><h1>Threat Modeling Simulator</h1>
        <p class="muted">Answer honestly — nothing leaves your browser. You'll get a plan with the most important fixes first.</p></section>
      <ol class="wizard-steps">${steps.map((s, i) => `<li class="${i + 1 === st.step ? 'current' : i + 1 < st.step ? 'done' : ''}">${i + 1}. ${s}</li>`).join('')}</ol>
      <section class="card" id="tm-body"></section>`;
    const body = $('#tm-body', root);

    if (st.step === 1) {
      body.innerHTML = `<h2>What do you want to protect?</h2><div class="grid three choice-grid">
        ${ASSETS.map((a) => `<button class="choice" data-asset="${a.id}"><strong>${esc(a.name)}</strong><span>${esc(a.why)}</span></button>`).join('')}</div>`;
      $$('[data-asset]', body).forEach((b) => b.addEventListener('click', () => {
        st.asset = ASSETS.find((a) => a.id === b.dataset.asset);
        st.threats = []; st.weak = []; st.step = 2; render();
      }));
    }

    if (st.step === 2) {
      body.innerHTML = `<h2>Which threats worry you for your ${esc(st.asset.name.toLowerCase())}?</h2>
        <form id="tm-form">${st.asset.threats.map((t) => `<label class="check-item"><input type="checkbox" value="${t.id}" ${st.threats.includes(t.id) ? 'checked' : ''}><span>${esc(t.name)}</span></label>`).join('')}
        <p class="form-error" id="tm-err" role="alert"></p>
        <div class="wizard-nav"><button type="button" class="btn" id="back">Back</button><button class="btn primary">Next</button></div></form>`;
      $('#back', body).addEventListener('click', () => { st.step = 1; render(); });
      $('#tm-form', body).addEventListener('submit', (e) => {
        e.preventDefault();
        st.threats = $$('input:checked', body).map((i) => i.value);
        if (!st.threats.length) return ($('#tm-err', body).textContent = 'Pick at least one threat.');
        st.step = 3; render();
      });
    }

    if (st.step === 3) {
      const ts = st.asset.threats.filter((t) => st.threats.includes(t.id));
      body.innerHTML = `<h2>Which of these are true for you right now?</h2><p class="muted">Tick every weakness that applies. Leave it blank if none do.</p>
        <form id="tm-form">${ts.map((t) => `<fieldset class="check-group"><legend>${esc(t.name)}</legend>
          ${t.weak.map(([w], i) => `<label class="check-item"><input type="checkbox" value="${t.id}:${i}" ${st.weak.includes(`${t.id}:${i}`) ? 'checked' : ''}><span>${esc(w)}</span></label>`).join('')}</fieldset>`).join('')}
        <div class="wizard-nav"><button type="button" class="btn" id="back">Back</button><button class="btn primary">Generate plan</button></div></form>`;
      $('#back', body).addEventListener('click', () => { st.step = 2; render(); });
      $('#tm-form', body).addEventListener('submit', (e) => {
        e.preventDefault();
        st.weak = $$('input:checked', body).map((i) => i.value);
        st.step = 4; render();
      });
    }

    if (st.step === 4) {
      const plan = buildPlan(st.asset, st.threats, st.weak);
      const text = planText(st.asset, plan);
      body.innerHTML = `<h2>Mitigation plan: ${esc(st.asset.name)}</h2>
        <p class="muted">${esc(st.asset.why)}</p>
        <h3 class="prio high">Fix first (${plan.high.length})</h3>
        ${plan.high.length ? `<ol class="plan">${plan.high.map((p) => `<li><strong>${esc(p.fix)}</strong><div class="hint">Because: ${esc(p.weakness)} → ${esc(p.threat)}</div></li>`).join('')}</ol>` : '<p class="ok-text">You didn\'t report any current weaknesses for these threats. Nice.</p>'}
        <h3 class="prio">Also recommended (${plan.recommended.length})</h3>
        <ul class="plan">${plan.recommended.map((p) => `<li>${esc(p.fix)} <span class="hint">(${esc(p.threat)})</span></li>`).join('')}</ul>
        <p class="hint">Revisit this plan when something changes: a new device, job, relationship, or a breach notice.</p>
        <div class="wizard-nav"><button class="btn" id="restart">Model another asset</button><button class="btn primary" id="copy">Copy plan</button></div>`;
      $('#restart', body).addEventListener('click', () => { st.step = 1; render(); });
      $('#copy', body).addEventListener('click', async (e) => {
        try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied'; }
        catch { e.target.textContent = 'Copy failed'; }
      });
    }
  };
  render();
}

function planText(asset, plan) {
  return [`Threat model plan: ${asset.name}`, '', 'Fix first:', ...plan.high.map((p, i) => `${i + 1}. ${p.fix}`),
    '', 'Also recommended:', ...plan.recommended.map((p) => `- ${p.fix}`)].join('\n');
}
