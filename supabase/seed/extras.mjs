// Mythbusters (embedded in each module via modules.myths_json) and Reference Hub case studies.

// Keyed by module_number.
export const myths = {
  1: [
    { myth: "I'm not important enough to be hacked.", fact: "Many attacks are automated and target anyone reachable. Mass phishing and credential stuffing don't pick victims by importance; your email, money, and contacts are worth something to a scammer." },
    { myth: 'OpSec is only for spies, soldiers, and journalists.', fact: 'OpSec is a simple habit: know what to protect, who might want it, and how it could leak. The same thinking protects your bank account, your home address, and your family.' },
    { myth: "I have nothing to hide, so privacy doesn't matter.", fact: "Privacy isn't about hiding wrongdoing. Your birthday, address, and pet's name can be enough to guess security answers, reset accounts, or impersonate you." }
  ],
  2: [
    { myth: 'Only gullible people fall for scams.', fact: 'Social engineering works by creating urgency, fear, or trust, and it catches smart, busy people every day. A pause-and-verify habit matters more than intelligence.' },
    { myth: 'A message from a friend or family member is safe.', fact: "Accounts get hijacked and names are easy to fake. If a 'friend' suddenly asks for money, codes, or a link click, confirm through a different channel, such as calling them." },
    { myth: 'My bank may call and ask for my OTP to verify me.', fact: 'Banks and e-wallets do not ask you to read out a one-time code. Anyone asking for it is trying to log in as you. Hang up and call the number on your card.' }
  ],
  3: [
    { myth: 'Strong passwords need to be complicated gibberish.', fact: 'Length matters most. A passphrase of four or more random, unrelated words is strong and easier to remember, and a password manager can handle the rest.' },
    { myth: 'Changing my password every month is best.', fact: "Current NIST guidance (SP 800-63B) recommends long, unique passwords that you change when there's evidence of compromise, rather than forced periodic changes that lead to weak patterns." },
    { myth: 'MFA by text message is useless.', fact: 'SMS is the weakest MFA option because of SIM swaps and phishing, but it is still much better than a password alone. Upgrade to an authenticator app or passkey when you can.' }
  ],
  4: [
    { myth: "Macs and iPhones can't get malware.", fact: 'They have strong built-in protections, but malware, phishing, and malicious profiles exist for every platform. Updates and caution still matter.' },
    { myth: "Antivirus means I'm fully protected.", fact: "Antivirus is one layer. It doesn't stop you from typing your password into a phishing site or sharing an OTP with a scammer." },
    { myth: 'Updates only add features, so I can put them off.', fact: 'Many updates fix security holes that attackers already know about. Delaying them leaves a known, published weakness open on your device.' }
  ],
  5: [
    { myth: 'The padlock means the website is safe.', fact: 'HTTPS means the connection is encrypted and the site controls that domain. Scammers can get certificates for their own look-alike domains, so always check the domain itself.' },
    { myth: 'A VPN makes me completely anonymous.', fact: 'A VPN hides your traffic from the local network and your ISP and changes your visible IP address, but the VPN provider can see your connection metadata, and logins, cookies, and fingerprinting can still identify you.' },
    { myth: 'Public Wi-Fi with a password is private.', fact: "Everyone who knows the café's password is on the same network, and anyone can set up a look-alike hotspot. Prefer mobile data for sensitive tasks and confirm the network name with staff." }
  ],
  6: [
    { myth: 'Incognito mode makes me anonymous.', fact: 'Private browsing only stops your browser from saving history and cookies after you close the window. Websites, your ISP, and school or work networks can still see your activity.' },
    { myth: "If I delete a post, it's gone.", fact: 'Screenshots, reposts, archives, and backups can keep copies after you delete the original.' },
    { myth: 'A private account keeps everything private.', fact: 'Your profile photo, name, and bio are often still public, and any follower can screenshot or share your posts. Only post what you would be comfortable seeing in public.' }
  ],
  7: [
    { myth: 'Good OpSec means being suspicious of everything.', fact: 'Good OpSec is proportional. A threat model helps you spend effort on the risks that are likely and harmful, instead of worrying about everything equally.' },
    { myth: 'Encryption alone keeps my communications secret.', fact: 'Encryption protects content, but metadata (who, when, where, how often) can still reveal a lot, and an unlocked or infected phone exposes the messages themselves.' },
    { myth: 'One very secure email account for everything is safest.', fact: 'Putting everything in one place means one breach exposes everything. Compartmentalize: separate addresses for banking, shopping, and social media limit the damage.' }
  ],
  8: [
    { myth: "If I'd been hacked, I would know.", fact: 'Many compromises are silent. Attackers often read email, set forwarding rules, or wait. Check login alerts, active sessions, and mail rules regularly.' },
    { myth: 'Paying a ransom guarantees I get my files back.', fact: 'Paying offers no guarantee of a working key, can mark you as a target for repeat attacks, and funds criminals. Tested offline backups are the real protection.' },
    { myth: 'Cloud sync is the same as a backup.', fact: "Sync copies deletions and encrypted files to every device too. A real backup keeps older versions or offline copies that ransomware and mistakes can't reach." }
  ]
};

// Links were checked to resolve (HTTP 200, matching headline) on 2026-11-26.
export const caseStudies = [
  {
    title: 'Fitness heatmap reveals sensitive sites (2018)',
    summary: "In January 2018, analysts pointed out that Strava's public global heatmap, built from users' recorded workouts, showed activity patterns around military bases in remote areas, revealing their layouts and patrol routes.",
    failure: 'Individually harmless workout data, shared under default settings, became sensitive when aggregated.',
    lesson: 'Check privacy defaults on fitness and location apps; aggregated data can reveal what individual data points do not.',
    links: [
      { label: 'The Guardian: Strava gives away location of secret US army bases', url: 'https://www.theguardian.com/world/2018/jan/28/fitness-tracking-app-gives-away-location-of-secret-us-army-bases' },
      { label: 'BBC News: Fitness app Strava lights up staff at military bases', url: 'https://www.bbc.com/news/technology-42853072' }
    ]
  },
  {
    title: 'Twitter phone spear-phishing (2020)',
    summary: 'On July 15, 2020, attackers phoned Twitter employees and talked some of them into giving up credentials, then used internal tools to take over high-profile accounts and post a cryptocurrency scam.',
    failure: 'Social engineering of staff with access to powerful internal tools.',
    lesson: 'Verify callers independently, use phishing-resistant MFA, and limit who can access powerful tools.',
    links: [
      { label: "Krebs on Security: Who's behind Wednesday's epic Twitter hack?", url: 'https://krebsonsecurity.com/2020/07/whos-behind-wednesdays-epic-twitter-hack/' }
    ]
  },
  {
    title: 'Colonial Pipeline ransomware (2021)',
    summary: "In May 2021, a ransomware attack led Colonial Pipeline to shut down its U.S. fuel pipeline for several days. The company's CEO later told the U.S. Senate that attackers got in through a legacy VPN account protected only by a password, without MFA.",
    failure: 'An old, unused account with a single factor remained active.',
    lesson: 'Turn on MFA everywhere and remove accounts you no longer use.',
    links: [
      { label: "CISA: The attack on Colonial Pipeline, what we've learned", url: 'https://www.cisa.gov/news-events/news/attack-colonial-pipeline-what-weve-learned-what-weve-done-over-past-two-years' },
      { label: 'CISA advisory AA21-131A: DarkSide ransomware', url: 'https://www.cisa.gov/news-events/cybersecurity-advisories/aa21-131a' }
    ]
  },
  {
    title: 'Photo metadata reveals a location (2012)',
    summary: 'In December 2012, a photo published online of John McAfee, who was avoiding authorities, still contained EXIF GPS metadata that indicated he was in Guatemala.',
    failure: 'The original image file was shared with location metadata intact.',
    lesson: 'Strip location data from photos before sharing, and assume original files contain more than you can see.',
    links: [
      { label: "WIRED: Did Vice just give away John McAfee's location with photo metadata?", url: 'https://www.wired.com/2012/12/oops-did-vice-just-give-away-john-mcafees-location-with-this-photo/' }
    ]
  },
  {
    title: 'Support desks social-engineered (2012)',
    summary: 'Technology journalist Mat Honan described how attackers combined information obtained from Amazon and Apple customer support to take over his Apple ID, remotely erase his iPhone, iPad, and MacBook, and hijack his Twitter account. Many personal photos were lost because he had no backup.',
    failure: 'Linked accounts with weak recovery processes, and no backups.',
    lesson: 'Secure recovery options, use MFA, compartmentalize important accounts, and keep backups.',
    links: [
      { label: 'WIRED: How Apple and Amazon security flaws led to my epic hacking', url: 'https://www.wired.com/2012/08/apple-amazon-mat-honan-hacking/' },
      { label: 'WIRED: How I resurrected my digital life after an epic hacking', url: 'https://www.wired.com/2012/08/mat-honan-data-recovery/' }
    ]
  },
  {
    title: 'Third-party vendor access (Target, 2013)',
    summary: "Attackers used network credentials stolen from a heating and air-conditioning vendor to get into Target's network, then stole payment card data from about 40 million cards during the 2013 holiday season.",
    failure: 'Third-party access was not well separated from sensitive systems.',
    lesson: 'Limit access on a need-to-know basis and separate (compartmentalize) systems.',
    links: [
      { label: 'Krebs on Security: Target hackers broke in via HVAC company', url: 'https://krebsonsecurity.com/2014/02/target-hackers-broke-in-via-hvac-company/' }
    ]
  }
];
