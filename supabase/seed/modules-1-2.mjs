// Fully written lessons for Modules 1 and 2 (expanded edition).
// Text format: blank line = new paragraph, lines starting with "- " = bullet list.
// quiz: { question, options[], answer (0-based index), explanation }
// Quiz content is unchanged from the original file.

export const module1 = [
  {
    title: 'What is OpSec?',
    what_is_it:
      'Operational Security (OpSec) is the habit of looking at your own life the way an attacker would, so you can spot which small pieces of information or behavior could be used against you, and then protect them.\n\nThe term grew out of military practice, where planners realized that enemies often learned more from ordinary, unclassified details than from secret documents. The same idea applies to everyone today. Your passwords, your home address, your daily routine, the name of your gym, and even a photo of your boarding pass are all pieces of information someone could misuse.\n\nOpSec is not about being secretive or paranoid. It is about being deliberate. You decide what matters, who could benefit from it, and what you are willing to do to keep it safe.',
    why_it_matters:
      'Most people are not hacked by genius-level attacks. They are harmed because ordinary details were easy to find and easy to combine: a birthday on social media, a reused password, a pet\'s name that doubles as a security answer, or a work badge visible in the background of a video call.\n\nAttackers rarely need one dramatic secret. They collect many small facts, each harmless on its own, and assemble them into a believable picture. Once they have that picture, they can impersonate you, guess your passwords, or write a message that you are much more likely to trust.\n\nOpSec helps you decide what is worth protecting before something goes wrong, instead of reacting afterward. It also gives you a calm, repeatable way to think about new apps, new accounts, and new situations, so you do not have to rely on fear or luck.',
    how_it_works:
      'OpSec is a way of thinking, not a product. It works by asking a few simple questions over and over:\n\n- What do I have that someone might want (money, accounts, identity, location, reputation)?\n- Who might want it, and how could they get it?\n- Which of my habits make that easier?\n- What is the simplest change that makes it harder?\n\nTechnical tools (password managers, encryption, updates) are part of the answer, but so are physical habits (locking your screen), human behavior (not oversharing), and situational awareness (noticing who is looking over your shoulder). A good OpSec mindset treats each of these as one layer. No single layer is perfect, but together they make attacks far more expensive and less likely to succeed.\n\nThe questions also work in reverse. If you notice that something you share would be useful to a stranger, you have found a place to act.',
    real_world_scenario:
      'Ana posts a photo celebrating her new job. The photo shows her company ID badge, her face, and the office lobby. A scammer now knows her full name, employer, and what the badge looks like. A week later, a coworker receives an email "from Ana" asking for an urgent gift-card purchase for a client.\n\nNothing was hacked. The attacker simply collected information Ana shared without thinking about who else could see it. The badge made the impersonation more convincing, because the scammer could reference the real lobby and the real company name.\n\nIf Ana had used OpSec thinking before posting, she could have cropped the badge out of the photo, checked her privacy settings, and told her coworkers in advance that real requests for gift cards would never come by email.',
    how_to_protect:
      '- Before you share something, ask: "Who else can see this, and what could they do with it?"\n- Treat small details (badges, tickets, addresses, routines, school or workplace logos) as pieces of a larger puzzle.\n- Check what is visible in the background of photos and video calls before you post or join.\n- Start with the basics covered in this course: strong unique passwords, multi-factor authentication, updates, and healthy skepticism.\n- Agree with family and coworkers on a simple rule for money requests, such as "always confirm by phone."\n- Remember the motto: you do not need to know everything, only what to protect, what can go wrong, and how to reduce the risk.',
    quiz: [
      {
        question: 'Which statement best describes OpSec?',
        options: [
          'A type of antivirus software',
          'A way of thinking about what to protect and how it could be exposed',
          'A government-only security clearance',
          'A method for hacking into accounts'
        ],
        answer: 1,
        explanation: 'OpSec is a mindset and process for identifying and protecting critical information. Tools help, but OpSec itself is not a product.'
      },
      {
        question: 'Which of these is an example of an OpSec mistake?',
        options: [
          'Using a password manager',
          'Locking your phone with a PIN',
          'Posting a photo that clearly shows your work ID badge',
          'Installing system updates'
        ],
        answer: 2,
        explanation: 'A visible ID badge reveals your name, employer, and badge design, which can be used for impersonation or social engineering.'
      },
      {
        question: 'OpSec covers which areas?',
        options: [
          'Only computers and networks',
          'Only physical locks and doors',
          'Technical, physical, behavioral, and informational habits',
          'Only what you post on social media'
        ],
        answer: 2,
        explanation: 'OpSec includes technical security, physical security, human behavior, information handling, and situational awareness.'
      }
    ]
  },
  {
    title: 'Why OpSec Matters',
    what_is_it:
      'This lesson explains why ordinary people, not just companies or governments, are targets, and why small precautions have a large effect.\n\nMany people assume that cybercrime is aimed at large organizations with valuable data. In reality, a large share of attacks are low-effort and opportunistic. Criminals send huge volumes of messages and run automated checks, then focus their time on the accounts that respond. Being an ordinary person is not a shield; it can even be an advantage for an attacker, because ordinary people often have weaker protections.\n\nThe practical result is simple: if you have an account, a phone, or money that can be reached, you are part of the target pool.',
    why_it_matters:
      'Criminals often work at scale. They send millions of phishing messages, test leaked passwords against many websites automatically, and buy and sell personal data. You do not have to be famous or rich to be a target; you just have to be reachable.\n\nThe consequences are real: drained bank or e-wallet accounts, stolen social media accounts used to scam your friends, identity theft, harassment, or loss of irreplaceable photos and files. Some harms are emotional as well as financial. Victims often feel embarrassed, which can delay reporting and make recovery harder.\n\nThe good news is that attackers are looking for the easiest target. Small, consistent habits move you out of that group, and that effect is much larger than most people expect.',
    how_it_works:
      'Most attacks against individuals follow the path of least resistance. Attackers look for:\n\n- Reused passwords that already appeared in a data breach\n- Accounts without multi-factor authentication\n- People who can be rushed or frightened into acting quickly\n- Devices that are missing security updates\n- Personal details that are public and can answer security questions\n\nBecause attackers go for easy targets, each basic protection you add pushes you out of the "easy" group. You do not have to be perfectly secure, just harder to exploit than the average target.\n\nThis is why the most effective steps are often the most boring ones: unique passwords, MFA on email, prompt updates, and a habit of pausing before acting on urgent messages. These steps defeat the automated, high-volume attacks that make up much of the threat.',
    real_world_scenario:
      'Marco reused the same password for an old online forum and his email. The forum suffered a data breach, and the leaked email-and-password list was shared online. An automated tool tried that combination on popular email services and got in.\n\nFrom his email, the attacker reset his passwords for social media and an online shopping account. Marco was never personally "chosen"; his reused password made him an easy match.\n\nIf Marco had used a unique password for email and turned on MFA, the leaked forum password would have been useless against his inbox. The attacker would have moved on to someone else within minutes.',
    how_to_protect:
      '- Use a unique password for every important account (a password manager makes this practical).\n- Turn on multi-factor authentication for email, banking, and social media first.\n- Install updates on your phone and computer promptly.\n- Slow down when a message pushes urgency or fear.\n- Check whether your email address has appeared in a known breach, and change any password that did.\n- Back up the files you could not bear to lose.',
    quiz: [
      {
        question: 'Why are ordinary people targeted by cybercriminals?',
        options: [
          'Only because they are famous',
          'Because many attacks are automated and aimed at anyone who is reachable',
          'They are not; only companies are targeted',
          'Because ordinary people always have weak computers'
        ],
        answer: 1,
        explanation: 'Many attacks run at scale (mass phishing, automated password testing), so anyone with an account can be hit.'
      },
      {
        question: 'Marco\'s email was taken over mainly because:',
        options: [
          'His email provider was hacked directly',
          'He reused a password that leaked in a different site\'s breach',
          'He used a long passphrase',
          'He had multi-factor authentication enabled'
        ],
        answer: 1,
        explanation: 'Reused passwords leaked from one site can be tried on others. This is called credential stuffing.'
      },
      {
        question: 'What does "pushing yourself out of the easy group" mean?',
        options: [
          'Becoming impossible to hack',
          'Adding basic protections so automated or low-effort attacks fail against you',
          'Deleting all your online accounts',
          'Hiring a security company'
        ],
        answer: 1,
        explanation: 'No one is perfectly secure, but basic protections stop the most common, low-effort attacks.'
      },
      {
        question: 'Which account should you usually secure first?',
        options: ['An old game account', 'Your primary email account', 'A newsletter subscription', 'A weather app'],
        answer: 1,
        explanation: 'Your email is often used to reset every other password, so whoever controls it can take over many other accounts.'
      }
    ]
  },
  {
    title: 'The Five Steps of OpSec',
    what_is_it:
      'The classic OpSec process has five steps: (1) identify critical information, (2) analyze threats, (3) analyze vulnerabilities, (4) assess risk, and (5) apply countermeasures. It is a repeatable checklist for deciding what to protect and how.\n\nThe steps are meant to be walked through in order, but they also loop. A countermeasure you apply can reveal new information or new weaknesses, and that sends you back to step one. Think of the five steps as a cycle rather than a one-time project.',
    why_it_matters:
      'Without a process, security turns into random worrying or buying tools you do not need. The five steps help you focus effort where it matters most and give you a way to re-check your situation when your life changes (a new job, a move, a new device).\n\nThe process also protects you from two common traps. The first is protecting everything equally, which uses up time and money on low-value items. The second is protecting only the things you can easily imagine being attacked, which leaves hidden weaknesses unaddressed.',
    how_it_works:
      '- Step 1 — Identify critical information: What would hurt if it leaked or was lost? Examples: email login, bank details, home address, ID documents, private photos.\n- Step 2 — Analyze threats: Who might want it? Scammers, identity thieves, a stalker, a nosy acquaintance, automated bots.\n- Step 3 — Analyze vulnerabilities: How could they get it? Reused passwords, public social media posts, an unlocked phone, no backups.\n- Step 4 — Assess risk: For each threat and vulnerability, how likely is it and how bad would it be? Focus on the combinations that are both likely and harmful.\n- Step 5 — Apply countermeasures: Choose practical fixes, such as MFA, privacy settings, a screen lock, or backups, then revisit the steps periodically.\n\nA useful habit is to write each step down in a few lines. The written version is easier to revisit, and it helps you notice when a plan no longer matches your life.',
    real_world_scenario:
      'Lea is starting an online business and runs the five steps:\n\n- Critical information: her business email, payment account, and customer list.\n- Threats: phishing scammers and people trying to take over her business page.\n- Vulnerabilities: she uses SMS codes only, and her personal phone number is public on the page.\n- Risk: account takeover is likely and would stop her sales.\n- Countermeasures: she switches to an authenticator app, uses a separate business contact number, and enables login alerts.\n\nAfter a few months, Lea hires a part-time assistant. She returns to step one, realizes the assistant needs access to some accounts but not the payment account, and sets up separate logins. The cycle caught a new risk before it became a problem.',
    how_to_protect:
      '- Write down your top five pieces of critical information today.\n- For each, list one realistic threat and one weakness.\n- Fix the highest-risk item first; do not try to fix everything at once.\n- Repeat the process when something big changes in your life, such as a new job, a move, a new device, or a new family member who uses your accounts.',
    quiz: [
      {
        question: 'What is the first step of the OpSec process?',
        options: ['Apply countermeasures', 'Assess risk', 'Identify critical information', 'Buy security software'],
        answer: 2,
        explanation: 'You cannot protect something until you know what it is, so the process starts with identifying critical information.'
      },
      {
        question: '"My social media is public and shows my school and hometown" describes a:',
        options: ['Threat', 'Vulnerability', 'Countermeasure', 'Critical asset'],
        answer: 1,
        explanation: 'A vulnerability is a weakness that a threat could exploit. Public personal details are a weakness.'
      },
      {
        question: 'In risk assessment, which items should you usually fix first?',
        options: [
          'Ones that are unlikely and low impact',
          'Ones that are both likely and harmful',
          'Whichever is easiest to talk about',
          'Only the newest threats in the news'
        ],
        answer: 1,
        explanation: 'Risk combines likelihood and impact. Prioritize what is both likely to happen and damaging if it does.'
      },
      {
        question: 'Why should you repeat the five steps over time?',
        options: [
          'Because the law requires it every month',
          'Because your life, devices, and threats change',
          'Because the steps change every year',
          'You never need to repeat them'
        ],
        answer: 1,
        explanation: 'New jobs, devices, relationships, and threats change what you need to protect and how.'
      }
    ]
  },
  {
    title: 'Threats, Vulnerabilities, and Risks',
    what_is_it:
      'These three words are often mixed up:\n\n- A threat is someone or something that could cause harm (a scammer, malware, a thief, a flood).\n- A vulnerability is a weakness that the threat could use (a reused password, an unlocked door, an outdated app).\n- Risk is the chance that a threat will exploit a vulnerability, combined with how bad the result would be.\n\nA useful way to remember the difference: threats are the "who or what," vulnerabilities are the "how," and risk is the "how likely and how bad."',
    why_it_matters:
      'Knowing the difference keeps you from wasting effort. You usually cannot remove threats (scammers will always exist), but you can almost always reduce vulnerabilities, and that lowers your risk.\n\nPeople often worry about threats in the news, such as a famous new malware strain, while leaving their own vulnerabilities untouched. Shifting your attention to the weakness you control is one of the most productive security habits you can build.',
    how_it_works:
      'A simple way to think about it: Risk ≈ Likelihood × Impact.\n\nExample: a thief (threat) could steal your phone. If your phone has no screen lock (vulnerability), the impact is high because they can open your banking and email apps. Adding a strong PIN and remote-wipe does not stop thieves from existing, but it greatly reduces the impact, and therefore the risk.\n\nYou can respond to a risk in four ways: reduce it (add protections), avoid it (stop the risky activity), transfer it (for example, insurance or a bank\'s fraud protection), or accept it (if it is unlikely and minor). Most good decisions combine more than one response. For example, you might reduce the risk of car theft with a lock, transfer part of it with insurance, and accept the rest.',
    real_world_scenario:
      'Jo connects to free airport Wi-Fi to check email. The threat is someone on the same network trying to intercept traffic or running a fake hotspot. The vulnerability would be logging into a site that is not using HTTPS, or entering a password on a fake captive-portal page.\n\nBecause Jo\'s email uses HTTPS and MFA, and Jo checks the network name with airport staff, the likelihood and impact are both low, so the risk is acceptable. Jo would still avoid entering a password on any unusual sign-in page, and would switch to mobile data for banking.\n\nThis example shows that the same threat can produce very different risk depending on the vulnerabilities present.',
    how_to_protect:
      '- When you worry about a threat, ask: "Which of my weaknesses would it need?" Then fix that weakness.\n- Use the four responses (reduce, avoid, transfer, accept) consciously, and note which one you chose.\n- Focus on vulnerabilities you control: passwords, updates, settings, and habits.\n- Re-check your list when you change devices, apps, or networks.',
    quiz: [
      {
        question: 'A phishing scammer is an example of a:',
        options: ['Threat', 'Vulnerability', 'Risk', 'Countermeasure'],
        answer: 0,
        explanation: 'A threat is an actor or event that could cause harm.'
      },
      {
        question: 'An app that has not been updated in two years is an example of a:',
        options: ['Threat', 'Vulnerability', 'Risk transfer', 'Asset'],
        answer: 1,
        explanation: 'Outdated software may contain known, unpatched flaws, which makes it a vulnerability.'
      },
      {
        question: 'Which formula best summarizes risk?',
        options: ['Risk = Threat + Password', 'Risk ≈ Likelihood × Impact', 'Risk = Number of devices', 'Risk = Cost of antivirus'],
        answer: 1,
        explanation: 'Risk considers both how likely something is and how damaging it would be.'
      },
      {
        question: 'Buying travel insurance for a laptop is an example of which risk response?',
        options: ['Avoid', 'Accept', 'Transfer', 'Ignore'],
        answer: 2,
        explanation: 'Insurance transfers some of the financial impact to someone else.'
      }
    ]
  },
  {
    title: 'Understanding Your Digital Footprint',
    what_is_it:
      'Your digital footprint is the trail of information about you that exists online. It has two parts:\n\n- Active footprint: things you share on purpose (posts, photos, comments, profiles).\n- Passive footprint: things collected about you, often without you noticing (location history, cookies, app data, data broker profiles, other people tagging you).\n\nMost people focus only on the active part. The passive footprint is often larger, and it is harder to see because you did not write it yourself.',
    why_it_matters:
      'Pieces of your footprint can be combined to answer security questions, guess passwords, find where you live or work, impersonate you, or build a convincing scam aimed at you or your family. Once something is public, copies may exist that you can no longer delete.\n\nYour footprint also includes what other people share about you. A friend\'s group photo, a tagged comment, or a family member\'s post can reveal details you never published yourself. Managing your footprint therefore means managing your own posts and your influence over what others post.',
    how_it_works:
      'Information spreads and gets combined:\n\n- Search engines index public profiles and posts.\n- Screenshots and reposts can outlive deleted content.\n- Data brokers and "people search" sites compile records from many sources in some countries.\n- Photos can contain metadata such as the time and, sometimes, GPS location.\n- Friends and family can reveal things about you (tags, comments, group photos).\n- Apps may collect location, contacts, and usage data in the background.\n\nThe key idea is aggregation. Each fact on its own may seem trivial, but collected together they form a profile that is far more revealing than any single item.',
    real_world_scenario:
      'Searching for "Rina Santos" plus her city brings up her public social media profile, a running-club results page showing her usual race times, and a tagged photo outside her apartment building. Together, these reveal where she lives and when she is usually out jogging.\n\nNo single item seemed risky, but the combination exposes her routine. A stranger could now predict when her home is empty, recognize her in person, or use her interests to write a convincing message. Rina could reduce this by hiding the old tagged photo, making her race results visible only to her club, and avoiding real-time posts from her regular route.',
    how_to_protect:
      '- Search your own name (and usernames, email, and phone number) to see what is public.\n- Review privacy settings on each social account; limit old posts to friends.\n- Remove or untag photos that reveal your home, school, or routine.\n- Use different usernames for unrelated sites if you do not want them linked.\n- Think before posting in real time; post travel photos after you return.\n- Review app location permissions and delete accounts you no longer use.',
    quiz: [
      {
        question: 'Which is part of your passive digital footprint?',
        options: ['A selfie you posted', 'A comment you wrote', 'Location history collected by an app', 'Your public bio'],
        answer: 2,
        explanation: 'Passive footprint data is collected about you, often in the background, rather than shared on purpose.'
      },
      {
        question: 'Why can harmless-seeming posts become risky?',
        options: [
          'They use too much storage',
          'They can be combined to reveal routines, locations, or security answers',
          'Social networks sell them as photos',
          'They slow down your phone'
        ],
        answer: 1,
        explanation: 'Attackers combine small details to build a fuller picture of you.'
      },
      {
        question: 'A safer way to share vacation photos is to:',
        options: [
          'Post them live with location tags',
          'Post them after you return home',
          'Post your flight details',
          'Make your account fully public'
        ],
        answer: 1,
        explanation: 'Posting after the trip avoids advertising that your home is empty and where you are right now.'
      },
      {
        question: 'A good first step to understand your footprint is to:',
        options: ['Search your own name and usernames', 'Buy a VPN', 'Change your phone', 'Delete your email account'],
        answer: 0,
        explanation: 'Searching yourself shows what strangers can easily find.'
      }
    ]
  }
];

export const module2 = [
  {
    title: 'What is Social Engineering?',
    what_is_it:
      'Social engineering is manipulating people, rather than computers, into giving up information, money, or access. Instead of breaking a password, the attacker convinces you to hand it over.\n\nIt works because most of security depends on human judgment. A lock can be perfect and still be opened by someone who persuades the person holding the key. Social engineering is as old as fraud itself; digital tools have simply made it faster, cheaper, and easier to scale.',
    why_it_matters:
      'People are often the easiest way in. Strong passwords and encryption do not help if you read a one-time code to a caller who claims to be from your bank. Many major incidents have started with a convincing message or phone call.\n\nSocial engineering also targets people who feel confident about their own security. Smart, careful people are still vulnerable when they are busy, distracted, or trying to be helpful. Understanding the pattern helps you recognize the moment when your judgment is being steered.',
    how_it_works:
      'Social engineers typically:\n\n- Research the target (social media, company websites, leaked data).\n- Build a believable story (a pretext): delivery company, bank fraud team, IT support, a relative in trouble.\n- Create pressure: urgency, fear, authority, or a reward.\n- Ask for a specific action: click a link, share a code, send money, install an app, or open a door.\n\nThe channel can be email, text message, phone call, chat apps, social media, or in person. Many attacks combine channels. A fake email might be followed by a phone call to "confirm" the request, which makes the story feel more real.\n\nNotice that the attacker needs you to act before you verify. Slowing down is often enough to break the attack.',
    real_world_scenario:
      'A caller says, "This is your bank\'s fraud department. We detected a suspicious transfer. To block it, I\'ll send a code to your phone; please read it back to verify your identity."\n\nThe "code" is actually a one-time password the scammer triggered by logging into the victim\'s account. Reading it out gives the scammer access. The caller sounds calm and professional, and the request is framed as protecting the victim, which is what makes it effective.\n\nA careful response is simple: end the call, find the bank\'s number on the back of your card or on its official website, and call that number. Legitimate staff will understand, and they will never need you to read back a code.',
    how_to_protect:
      '- Never share one-time codes, PINs, or passwords with anyone who contacts you. Legitimate banks and services do not ask for them.\n- Hang up and call back using the number on your card or the official website.\n- Treat urgency as a warning sign, not a reason to hurry.\n- Verify unusual requests from friends or coworkers through a second channel, such as a call to a number you already know.\n- Tell family members about the pattern so they can recognize it too.',
    quiz: [
      {
        question: 'Social engineering mainly targets:',
        options: ['Computer hardware', 'Human trust and behavior', 'Wi-Fi routers only', 'Encryption algorithms'],
        answer: 1,
        explanation: 'Social engineering manipulates people into taking actions that help the attacker.'
      },
      {
        question: 'A caller from "your bank" asks you to read back a code just sent to your phone. What should you do?',
        options: [
          'Read it quickly to stop the fraud',
          'Hang up and call the bank using the number on your card',
          'Send it by text message instead',
          'Ask them to email it to you'
        ],
        answer: 1,
        explanation: 'One-time codes should never be shared. Contact the bank yourself through a trusted number.'
      },
      {
        question: 'Which is a common social engineering pressure tactic?',
        options: ['Giving you plenty of time', 'Urgency or fear', 'Encouraging you to verify', 'Using an official helpline you looked up'],
        answer: 1,
        explanation: 'Urgency and fear make people skip careful thinking.'
      }
    ]
  },
  {
    title: 'Phishing, Spear Phishing, and Smishing',
    what_is_it:
      '- Phishing: fraudulent messages, usually email, sent to many people to steal credentials, money, or install malware.\n- Spear phishing: a targeted phishing message tailored to a specific person or group, using details about them.\n- Smishing: phishing by SMS or text/chat message.\n- Vishing: phishing by voice call.\n\nThe names describe the channel or the level of targeting. The underlying goal is the same: make you act on a false message.',
    why_it_matters:
      'Phishing remains one of the most common ways accounts are compromised and malware is delivered. Text-message scams about deliveries, prizes, bank holds, or e-wallet problems are widespread because people tap links on phones quickly.\n\nSpear phishing is especially dangerous in workplaces, because a message that appears to come from a manager or a trusted supplier can bypass the caution people normally apply to strangers.',
    how_it_works:
      'A phishing message usually links to a fake login page that looks like a real service, or carries an attachment that installs malware. Spear phishing adds personal details (your name, your boss\'s name, a real project) to make it believable.\n\nOn phones, it is harder to see the real link address, and sender names can be spoofed, so smishing is especially effective. A fake page often copies logos and layouts exactly, and it may ask for your password, one-time code, or card number in a way that looks routine.\n\nAttackers also use "sense of urgency" and "sense of routine" together. A message that looks like an ordinary notification, arriving at a time when you expect one, is harder to question.',
    real_world_scenario:
      'A text arrives: "Your parcel is on hold due to an unpaid fee of 35.00. Pay within 24 hours: parcel-redelivery-help.example." The page asks for card details and then a one-time code "to confirm."\n\nIn a spear-phishing version, an email to an accounts clerk appears to come from her manager, mentions a real supplier, and asks her to update the supplier\'s bank details before Friday\'s payment run. The clerk recognizes the project name and the manager\'s writing style, which makes the request feel safe. The only problem is that the bank details lead to the attacker.\n\nIn both cases, the safe move is the same: stop, check through a separate channel, and report the message.',
    how_to_protect:
      '- Do not tap links in unexpected messages; open the official app or type the website address yourself.\n- Check the real domain carefully (look-alike spellings and extra words are common).\n- Be suspicious of small "fees," prizes, or account holds that require immediate action.\n- Verify payment-detail changes by phone using a number you already have.\n- Use a password manager: it will not auto-fill on a fake domain, which is a useful warning.\n- Report phishing to your provider and delete it.',
    quiz: [
      {
        question: 'Smishing is phishing delivered by:',
        options: ['Email', 'Text or chat message', 'Postal mail', 'USB drive'],
        answer: 1,
        explanation: 'Smishing combines SMS and phishing.'
      },
      {
        question: 'What makes spear phishing different from regular phishing?',
        options: [
          'It is always sent by phone',
          'It is tailored to a specific person or group using personal details',
          'It never contains links',
          'It is legal'
        ],
        answer: 1,
        explanation: 'Spear phishing is targeted and uses research to seem believable.'
      },
      {
        question: 'Why can a password manager help detect phishing?',
        options: [
          'It blocks all emails',
          'It will not auto-fill credentials on a domain that does not match the saved one',
          'It deletes suspicious texts',
          'It calls the bank for you'
        ],
        answer: 1,
        explanation: 'Auto-fill is tied to the exact website. If it does not fill, double-check the address.'
      },
      {
        question: 'A supplier emails asking to change their bank account for the next payment. Best response?',
        options: [
          'Update it immediately',
          'Reply to the email to confirm',
          'Call the supplier using a phone number you already had on file',
          'Forward it to a friend'
        ],
        answer: 2,
        explanation: 'Replying may reach the attacker. Verify through an independent, known channel.'
      }
    ]
  },
  {
    title: 'Pretexting and Impersonation',
    what_is_it:
      'Pretexting is creating a made-up scenario (a pretext) to get someone to share information or grant access. Impersonation is pretending to be a trusted person or organization, such as IT support, a delivery driver, a government agency, or a family member.\n\nThe two often appear together. The impersonation provides the identity, and the pretext provides the reason the request makes sense.',
    why_it_matters:
      'People are naturally helpful and respect authority. A believable role can get an attacker past security that would stop a direct request. Impersonation also happens online through fake social media profiles and cloned accounts that message your friends.\n\nBecause the story is built around your good intentions, victims often feel they were simply being kind. That is why it is important to focus on the request itself, not on how polite or official the person sounds.',
    how_it_works:
      'The attacker gathers enough details to sound legitimate, then plays a role:\n\n- "IT helpdesk" asking you to install remote-access software.\n- A "new employee" who forgot their badge and asks you to hold the door.\n- A cloned profile of a friend asking to borrow money or for a code "sent to your number by mistake."\n- A "government official" threatening fines or arrest unless you pay now.\n\nA key warning sign is a mismatch between the role and the request. Real IT staff rarely need you to install unfamiliar software, and real government agencies rarely demand immediate payment by unusual methods.',
    real_world_scenario:
      'Someone creates a new account using your cousin\'s name and profile photo, then messages relatives: "New account, lost my old phone. Can you send me the 6-digit code you\'ll receive? It\'s for my account recovery."\n\nThe code is actually for taking over the relative\'s own messaging account. The fake profile looked familiar, the story was plausible, and the request seemed like a simple favor. Relatives who paused and called the cousin on a known number would have discovered the impersonation immediately.',
    how_to_protect:
      '- Verify identity through a channel you already trust (call the person, ask a question only they would know).\n- Do not install remote-access apps because someone called or messaged you.\n- Politely refuse to let unknown people follow you through secure doors; direct them to reception.\n- Government agencies and banks generally do not demand immediate payment by gift cards, crypto, or e-wallet transfers.\n- Never share a verification code, no matter who asks for it.\n- Report cloned profiles to the platform and warn your contacts.',
    quiz: [
      {
        question: 'A "pretext" in social engineering is:',
        options: ['A type of malware', 'A made-up story used to justify a request', 'An encrypted message', 'A backup file'],
        answer: 1,
        explanation: 'The pretext is the believable scenario the attacker uses.'
      },
      {
        question: 'A friend\'s "new account" asks you for a verification code you just received. This is most likely:',
        options: ['A normal request', 'An account takeover attempt', 'A software update', 'A delivery notice'],
        answer: 1,
        explanation: 'Codes sent to your number are for your account. Sharing them can let someone take it over.'
      },
      {
        question: 'Someone without a badge asks you to hold the office door. The best response is to:',
        options: [
          'Let them in to be polite',
          'Direct them to reception or security',
          'Give them your badge',
          'Ignore company policy'
        ],
        answer: 1,
        explanation: 'Following someone through a secure door is called tailgating. Reception can verify them.'
      }
    ]
  },
  {
    title: 'Recognizing Suspicious Links and Emails',
    what_is_it:
      'This lesson teaches the practical checks you can do on any message before you trust it: who really sent it, where links really go, and whether the request makes sense.\n\nNo single check is decisive. The goal is to combine several small checks so that a fake message is caught by at least one of them.',
    why_it_matters:
      'Display names, logos, and formatting are easy to fake. The details that are harder to fake, like the actual domain, are what reveal most phishing.\n\nOnce you know what to look for, these checks take only a few seconds. They can prevent losses that would take months to recover from.',
    how_it_works:
      'Key checks:\n\n- Sender address: the display name can say anything; look at the actual address after the @. "NorthBank Security <alerts@northbank-verify.example>" is not northbank.example.\n- Reply-To: a mismatch between From and Reply-To can be a warning sign.\n- Link destination: on a computer, hover over the link to preview the real address. On a phone, long-press to preview. The real domain is the registered name just before the first single slash that follows the address. Everything to the left of it is a subdomain you can freely invent. In "northbank.example.login-secure.example/account", the real domain is "login-secure.example", because that is the name the owner registered.\n- Look-alike characters: "rn" can look like "m", and "0" like "o".\n- Attachments: be wary of unexpected files, especially archives, macro-enabled documents, or files that ask you to "enable content."\n- Context: Were you expecting this? Does the request match how this organization normally contacts you?\n\nWhen several checks disagree, treat the message as suspicious until verified.',
    real_world_scenario:
      'An email says: "Your CloudDrive storage is full. Click to keep your files." The sender shows "CloudDrive Support," but the address is support@clouddrive-storage-alert.example, and hovering over the button reveals http://clouddrive.example.account-verify.example/login.\n\nThe real domain is account-verify.example, not clouddrive.example. It is phishing. The attacker used the familiar word "clouddrive" as a subdomain to make the link look legitimate at a glance, which is why reading the full address matters.',
    how_to_protect:
      '- Hover or long-press before clicking.\n- Find the real domain (the registered name just before the first single "/").\n- Do not trust a padlock alone; phishing sites can use HTTPS too.\n- When unsure, go to the service directly through a bookmark or the official app.\n- Report suspicious messages using your email provider\'s "Report phishing" option.',
    quiz: [
      {
        question: 'In the link "https://northbank.example.secure-login.example/verify", what is the real domain?',
        options: ['northbank.example', 'secure-login.example', 'verify', 'https'],
        answer: 1,
        explanation: 'The registered domain is the last part before the first single slash: secure-login.example. "northbank.example" is just a subdomain label.'
      },
      {
        question: 'The padlock icon (HTTPS) in a browser means:',
        options: [
          'The website is definitely legitimate',
          'The connection is encrypted, but the site could still be fake',
          'The site has been approved by your bank',
          'The site has no malware'
        ],
        answer: 1,
        explanation: 'HTTPS encrypts the connection. Anyone, including scammers, can get a certificate for their own domain.'
      },
      {
        question: 'How can you preview a link on a phone?',
        options: ['Tap it quickly', 'Long-press it', 'Shake the phone', 'Forward it to yourself'],
        answer: 1,
        explanation: 'Long-pressing usually shows the destination without opening it.'
      },
      {
        question: 'Which attachment request is a strong warning sign?',
        options: [
          'A PDF receipt you expected',
          'A document that asks you to "enable content" or macros',
          'A photo from a family member you were waiting for',
          'A calendar invite from your known coworker'
        ],
        answer: 1,
        explanation: 'Macros can run code. Unexpected requests to enable them are a common malware delivery method.'
      },
      {
        question: 'An email shows the display name "IT Support" but the address is from an unknown domain. You should:',
        options: [
          'Trust the display name',
          'Treat it as suspicious and verify through your real IT department',
          'Reply with your password',
          'Click the link to check'
        ],
        answer: 1,
        explanation: 'Display names are trivial to fake. The actual address and an independent check matter.'
      }
    ]
  },
  {
    title: 'Psychological Manipulation Tactics',
    what_is_it:
      'Attackers rely on well-known principles of persuasion and emotion. Recognizing these levers helps you notice manipulation while it is happening.\n\nThese principles are not inherently bad. Urgency, authority, and reciprocity are used in legitimate marketing and everyday life. Manipulation happens when they are used to override your judgment rather than inform it.',
    why_it_matters:
      'Smart, careful people still fall for scams when they are rushed, scared, excited, or tired. Knowing the tactics lets you pause at the right moment.\n\nThe most useful skill is not memorizing a list of tricks. It is noticing the feeling that someone is pushing you to act now, and treating that feeling as information.',
    how_it_works:
      'Common levers:\n\n- Urgency: "Act within 1 hour or your account will be closed."\n- Fear: threats of arrest, fines, or losing money.\n- Authority: pretending to be a boss, police, bank, or government.\n- Scarcity / reward: "Only 3 slots left," "You have won a prize."\n- Social proof: "Everyone in your team has already done this."\n- Liking and familiarity: friendly chat, shared interests, flattery, or romance built over weeks.\n- Reciprocity: doing you a small favor first so you feel you owe them.\n- Commitment: getting a small "yes" first, then escalating the request.\n\nMost scams combine several of these. A friendly start builds liking, a small early win builds commitment, and a deadline creates urgency.',
    real_world_scenario:
      'An online "investment mentor" is friendly for weeks, shares screenshots of profits, and helps with a small first investment that appears to grow. Then the mentor urges a much larger deposit "before the window closes." When the victim tries to withdraw, they are told to pay "taxes" or "fees" first.\n\nThis uses liking, social proof, commitment, and urgency together. Each step felt reasonable on its own, which is why the pattern is hard to see from the inside. A friend asking "what is this really for?" at the start would have been a useful check.',
    how_to_protect:
      '- Name the emotion: "I feel rushed / scared / excited. Why?"\n- Introduce a pause: legitimate requests can wait while you verify.\n- Talk it through with someone you trust before sending money.\n- Be very cautious of investment or romance contacts who only exist online and steer you to transfers or crypto.\n- If you must pay a fee to receive a prize or withdraw money, it is a scam warning sign.',
    quiz: [
      {
        question: '"Your account will be suspended in 30 minutes" mainly uses:',
        options: ['Reciprocity', 'Urgency', 'Liking', 'Scarcity of products'],
        answer: 1,
        explanation: 'A tight deadline is designed to make you act before thinking.'
      },
      {
        question: 'Being asked to pay a fee to withdraw your own investment "profits" is a sign of:',
        options: ['A normal bank process', 'A likely scam', 'High interest rates', 'Tax law'],
        answer: 1,
        explanation: 'Demanding new payments before releasing funds is a common scam pattern.'
      },
      {
        question: 'Which is the most effective general defense against manipulation?',
        options: [
          'Responding as fast as possible',
          'Pausing and verifying through an independent channel',
          'Trusting anyone who sounds official',
          'Keeping it secret from family'
        ],
        answer: 1,
        explanation: 'Manipulation depends on rushing you. Pausing and verifying breaks the pattern.'
      }
    ]
  },
  {
    title: 'Avoiding Online Scams',
    what_is_it:
      'Online scams are schemes that trick you into sending money, goods, or personal data. Common types include fake online shops, marketplace scams, job and task scams, romance scams, investment scams, prize scams, and tech-support scams.\n\nMost scams share a basic shape: the victim is offered something good, asked to pay or share something first, and then faces new demands before receiving anything. Recognizing that shape is more useful than memorizing every variation.',
    why_it_matters:
      'Scams cause large financial losses and are often hard to reverse, especially when payment is made by bank transfer, e-wallet, gift cards, or cryptocurrency. Victims also lose personal data that can be reused in later scams.\n\nScam victims are sometimes targeted again. Fake recovery services and "asset recovery" offers often contact people who have already been defrauded, which adds insult to injury.',
    how_it_works:
      'Typical patterns:\n\n- Fake shops: prices far below normal, new websites, pressure to pay by direct transfer.\n- Marketplace scams: "buyers" who overpay and ask for a refund, or "sellers" who want payment outside the platform.\n- Task/job scams: easy pay for liking videos or rating products, then a demand to "top up" to unlock earnings.\n- Tech-support scams: pop-ups or calls claiming your computer is infected, asking you to call a number or install remote-access software.\n- Recovery scams: people offering to recover money you lost to an earlier scam, for a fee.\n\nA common thread is payment. Scammers prefer methods that are fast and hard to reverse, so an unusual payment request is often the clearest warning sign.',
    real_world_scenario:
      'Ben applies for an online "part-time job" that pays for completing simple tasks. After a few small payouts, he is told he must deposit money to unlock a higher-paying "premium task." The balance shown on the site grows, but withdrawals are always blocked until he pays more.\n\nThe early payouts were bait to build trust. The growing balance was a number on a screen, not money in his account. Ben could have protected himself by asking whether the job was listed by a company he could verify, and by noticing that any job requiring a deposit is a warning sign.',
    how_to_protect:
      '- If an offer is far better than normal, research it before paying.\n- Keep transactions inside the marketplace\'s official payment system.\n- Prefer payment methods with buyer protection.\n- Never pay to get a job, a prize, or your own money back.\n- Close scary pop-ups; real security warnings do not ask you to call a phone number.\n- If you were scammed, contact your bank or e-wallet provider immediately and report it to the authorities (covered in Module 8).',
    quiz: [
      {
        question: 'A "job" requires you to deposit money to unlock your earnings. This is:',
        options: ['Normal onboarding', 'A task/job scam warning sign', 'A tax requirement', 'A bonus program'],
        answer: 1,
        explanation: 'Legitimate employers do not require you to pay to receive your wages.'
      },
      {
        question: 'A pop-up says your computer is infected and to call a support number. You should:',
        options: ['Call immediately', 'Close the browser tab or window and run your normal security software', 'Install the software they suggest', 'Pay for the repair'],
        answer: 1,
        explanation: 'Tech-support scam pop-ups are fake. Close them; do not call or install anything.'
      },
      {
        question: 'Why should you keep marketplace payments inside the platform?',
        options: [
          'It is always cheaper',
          'You may lose buyer protection and dispute options when you pay outside it',
          'It is required by law everywhere',
          'Outside payments are faster'
        ],
        answer: 1,
        explanation: 'Platforms can usually only help with transactions they processed.'
      },
      {
        question: 'Someone offers to recover money you lost to a scam, for an upfront fee. This is most likely:',
        options: ['A legitimate law firm', 'A recovery scam', 'Your bank', 'Insurance'],
        answer: 1,
        explanation: 'Scam victims are often targeted again by fake recovery services.'
      }
    ]
  }
];