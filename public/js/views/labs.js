// Labs hub. All labs run 100% client-side.
import { icons } from '../utils.js';
import { renderPhishingLab } from '../labs/phishing.js';
import { renderPasswordLab } from '../labs/password.js';
import { renderThreatLab } from '../labs/threatModel.js';
import { renderSpotRiskLab } from '../labs/spotRisk.js';

const LABS = [
  { id: 'phishing', title: 'Phishing Detector', icon: icons.mail, desc: 'Inspect a simulated inbox. Check senders and hover over links, then flag each email Safe or Phishing.', render: renderPhishingLab },
  { id: 'password', title: 'Password Strength Lab', icon: icons.key, desc: 'Estimate entropy and crack time with transparent math. Runs entirely in your browser.', render: renderPasswordLab },
  { id: 'threat-model', title: 'Threat Modeling Simulator', icon: icons.target, desc: 'Pick an asset, choose realistic threats and weaknesses, and get a prioritized mitigation plan.', render: renderThreatLab },
  { id: 'spot-the-risk', title: 'Privacy Checkup & Spot the Risk', icon: icons.eye, desc: 'Find the security mistakes in everyday scenes, then score your own privacy habits.', render: renderSpotRiskLab }
];

export function renderLabs(app, id) {
  const lab = LABS.find((l) => l.id === id);
  if (lab) {
    app.innerHTML = `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/labs">Labs</a> / <span>${lab.title}</span></nav><div id="lab-root"></div>`;
    return lab.render(app.querySelector('#lab-root'));
  }
  app.innerHTML = `
    <section class="page-head"><h1>Interactive Security Labs</h1>
      <p class="muted">Practice in a safe, simulated environment. Nothing you type in these labs is sent over the network.</p></section>
    <section class="grid two">
      ${LABS.map((l) => `<a class="card lab-card" href="#/labs/${l.id}"><div class="lab-icon">${l.icon}</div><h2>${l.title}</h2><p>${l.desc}</p><span class="link">Open lab →</span></a>`).join('')}
    </section>`;
}
