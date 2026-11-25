// Reference Hub: filterable glossary (Supabase), mythbusters, and case studies.
import { getSupabase } from '../supabaseClient.js';
import { state } from '../state.js';
import { $, $$, esc } from '../utils.js';

export const MYTHS = [
  ['Incognito mode makes me anonymous.', 'Private browsing only stops your browser from saving history and cookies after you close the window. Websites, your ISP, and school or work networks can still see your activity.'],
  ['A VPN makes me completely anonymous.', 'A VPN hides your traffic from the local network and your ISP and changes your visible IP address, but the VPN provider can see your connection metadata, and logins, cookies, and fingerprinting can still identify you.'],
  ['The padlock means the website is safe.', 'HTTPS means the connection is encrypted and the site controls that domain. Scammers can get certificates for their own look-alike domains, so always check the domain itself.'],
  ['I\'m not important enough to be hacked.', 'Many attacks are automated and target anyone reachable — mass phishing and credential stuffing don\'t pick victims by importance.'],
  ['Macs and iPhones can\'t get malware.', 'They have strong built-in protections, but malware, phishing, and malicious profiles exist for every platform. Updates and caution still matter.'],
  ['Changing my password every month is best.', 'Current NIST guidance (SP 800-63B) recommends long, unique passwords and changing them when there\'s evidence of compromise, rather than forced periodic changes that lead to weak patterns.'],
  ['Antivirus means I\'m fully protected.', 'Antivirus is one layer. It doesn\'t stop you from typing your password into a phishing site or sharing an OTP with a scammer.'],
  ['If I delete a post, it\'s gone.', 'Screenshots, reposts, archives, and backups can keep copies after you delete the original.'],
  ['MFA by text message is useless.', 'SMS is the weakest MFA option because of SIM swaps and phishing, but it is still much better than a password alone. Upgrade to an authenticator app or passkey when you can.'],
  ['Strong passwords need to be complicated gibberish.', 'Length matters most. A passphrase of four or more random, unrelated words is strong and easier to remember.']
];

export const CASES = [
  {
    title: 'Fitness heatmap reveals sensitive sites (2018)',
    what: 'In January 2018, analysts pointed out that Strava\'s public global heatmap — built from users\' recorded workouts — showed activity patterns around military bases in remote areas, revealing their layouts and patrol routes.',
    failure: 'Individually harmless workout data, shared under default settings, became sensitive when aggregated.',
    lesson: 'Check privacy defaults on fitness and location apps; aggregated data can reveal what individual data points do not.'
  },
  {
    title: 'Twitter phone spear-phishing (2020)',
    what: 'On July 15, 2020, attackers phoned Twitter employees and talked some of them into giving up credentials, then used internal tools to take over high-profile accounts and post a cryptocurrency scam.',
    failure: 'Social engineering of staff with access to powerful internal tools.',
    lesson: 'Verify callers independently, use phishing-resistant MFA, and limit who can access powerful tools.'
  },
  {
    title: 'Colonial Pipeline ransomware (2021)',
    what: 'In May 2021, a ransomware attack led Colonial Pipeline to shut down its U.S. fuel pipeline for several days. The company\'s CEO later told the U.S. Senate that attackers got in through a legacy VPN account protected only by a password, without MFA.',
    failure: 'An old, unused account with a single factor remained active.',
    lesson: 'Turn on MFA everywhere and remove accounts you no longer use.'
  },
  {
    title: 'Photo metadata reveals a location (2012)',
    what: 'In December 2012, a photo published online of John McAfee, who was avoiding authorities, still contained EXIF GPS metadata that indicated he was in Guatemala.',
    failure: 'The original image file was shared with location metadata intact.',
    lesson: 'Strip location data from photos before sharing, and assume original files contain more than you can see.'
  },
  {
    title: 'Support desks social-engineered (2012)',
    what: 'Technology journalist Mat Honan described how attackers combined information obtained from Amazon and Apple customer support to take over his Apple ID, remotely erase his iPhone, iPad, and MacBook, and hijack his Twitter account. Many personal photos were lost because he had no backup.',
    failure: 'Linked accounts with weak recovery processes, and no backups.',
    lesson: 'Secure recovery options, use MFA, compartmentalize important accounts, and keep backups.'
  },
  {
    title: 'Third-party vendor access (Target, 2013)',
    what: 'Attackers used network credentials stolen from a heating and air-conditioning vendor to get into Target\'s network, then stole payment card data from about 40 million cards during the 2013 holiday season.',
    failure: 'Third-party access was not well separated from sensitive systems.',
    lesson: 'Limit access on a need-to-know basis and separate (compartmentalize) systems.'
  }
];

export async function renderReference(app, tab = 'glossary') {
  if (!['glossary', 'myths', 'cases'].includes(tab)) tab = 'glossary';
  app.innerHTML = `
    <section class="page-head"><h1>Reference Hub</h1><p class="muted">Quick definitions, common myths, and lessons from real incidents.</p></section>
    <div class="tabs" role="tablist">
      <a role="tab" href="#/reference/glossary" class="${tab === 'glossary' ? 'active' : ''}">Security Glossary</a>
      <a role="tab" href="#/reference/myths" class="${tab === 'myths' ? 'active' : ''}">OpSec Mythbusters</a>
      <a role="tab" href="#/reference/cases" class="${tab === 'cases' ? 'active' : ''}">Case Studies</a>
    </div>
    <section id="ref-body"></section>`;
  const body = $('#ref-body', app);

  if (tab === 'myths') {
    body.innerHTML = `<div class="grid two">${MYTHS.map(([m, f]) => `<article class="card myth">
      <p class="myth-label">Myth</p><h3>${esc(m)}</h3><p class="fact-label">Fact</p><p>${esc(f)}</p></article>`).join('')}</div>`;
    return;
  }

  if (tab === 'cases') {
    body.innerHTML = `<p class="hint">Summaries are based on public reporting. Details are simplified for teaching.</p>
      <div class="grid two">${CASES.map((c) => `<article class="card case">
        <h3>${esc(c.title)}</h3><p>${esc(c.what)}</p>
        <p><strong>OpSec failure:</strong> ${esc(c.failure)}</p><p><strong>Lesson:</strong> ${esc(c.lesson)}</p></article>`).join('')}</div>`;
    return;
  }

  if (!state.session) {
    body.innerHTML = `<div class="card narrow"><p>Sign in to browse the full glossary.</p><a class="btn primary" href="#/auth/signin">Sign in</a></div>`;
    return;
  }
  body.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('glossary_terms').select('term, definition, category').order('term');
  if (error) throw error;
  const cats = [...new Set(data.map((d) => d.category).filter(Boolean))].sort();

  body.innerHTML = `<div class="card filters">
      <label>Search<input id="g-q" type="search" placeholder="e.g. phishing, VPN"></label>
      <label>Category<select id="g-cat"><option value="">All categories</option>${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
      <span class="muted" id="g-count"></span>
    </div>
    <dl class="glossary" id="g-list"></dl>`;

  const draw = () => {
    const q = $('#g-q', body).value.trim().toLowerCase();
    const cat = $('#g-cat', body).value;
    const rows = data.filter((d) => (!cat || d.category === cat) && (!q || d.term.toLowerCase().includes(q) || d.definition.toLowerCase().includes(q)));
    $('#g-count', body).textContent = `${rows.length} of ${data.length} terms`;
    $('#g-list', body).innerHTML = rows.length
      ? rows.map((d) => `<div class="g-item card"><dt>${esc(d.term)} <span class="badge">${esc(d.category || '')}</span></dt><dd>${esc(d.definition)}</dd></div>`).join('')
      : '<p class="muted">No matching terms.</p>';
  };
  $$('#g-q, #g-cat', body).forEach((el) => el.addEventListener('input', draw));
  draw();
}
