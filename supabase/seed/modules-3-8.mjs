// Structured starter lessons for Modules 3–8.
// Each lesson has all six parts filled with a short, accurate starting point
// so admins can expand them in the Lesson Manager.
// Compact quiz format: [question, options[], answerIndex, explanation]

const L = (title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz) => ({
  title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect,
  quiz: quiz.map(([question, options, answer, explanation]) => ({ question, options, answer, explanation }))
});

export const module3 = [
  L('Strong Passwords',
    'A strong password is long, unique to one account, and hard to guess, even for a computer trying billions of guesses.',
    'Weak or reused passwords are one of the most common reasons accounts get taken over.',
    'Attackers guess passwords using lists of common and leaked passwords plus predictable patterns (Name2024!, qwerty). Length adds the most strength: each extra character multiplies the number of possibilities. A passphrase of four or more random, unrelated words is both strong and memorable.\n\nCurrent NIST guidance (SP 800-63B) favors length and checking against breached-password lists over forced complexity rules and routine periodic changes.',
    'Kim uses "Summer2025!" everywhere. It meets most complexity rules but follows a very common pattern and appears in guessing lists, so it falls quickly in an offline attack.',
    '- Use at least 12–16 characters; longer for important accounts.\n- Use a random passphrase or let a password manager generate one.\n- Never reuse passwords across accounts.\n- Change a password when there is a reason (a breach or suspicion), not on a fixed calendar.',
    [
      ['Which usually adds the most strength to a password?', ['Adding one symbol', 'Making it longer', 'Capitalizing the first letter', 'Adding the current year'], 1, 'Length increases the number of possible combinations the most.'],
      ['Why is "Summer2025!" weak?', ['It is too long', 'It follows a common, predictable pattern', 'It has no letters', 'It is random'], 1, 'Season + year + symbol is a pattern attackers try early.'],
      ['Reusing one strong password on many sites is:', ['Safe if it is long', 'Risky, because one breach exposes every account', 'Recommended', 'Required by MFA'], 1, 'Reuse lets one leak unlock many accounts.']
    ]),
  L('Password Managers',
    'A password manager is an app that generates, stores, and auto-fills unique passwords for you, protected by one strong master password (and ideally MFA).',
    'It is practically impossible to remember dozens of unique strong passwords. A manager makes "unique everywhere" achievable.',
    'Your vault is encrypted on your device with a key derived from your master password. Reputable managers are designed so the provider cannot read your vault. Browser extensions and apps auto-fill only on the domain the password was saved for, which also helps catch phishing.',
    'After a breach at a shopping site, Paolo only has to change that one site\'s password, because his manager gave every account a different one.',
    '- Choose a well-known, actively maintained password manager.\n- Protect it with a long, unique master passphrase and MFA.\n- Store your recovery/emergency kit somewhere safe offline.\n- Move your most important accounts (email, banking) in first.',
    [
      ['What protects a password manager\'s vault?', ['Nothing', 'Encryption tied to your master password', 'Your phone number only', 'The website\'s security'], 1, 'The vault is encrypted using a key derived from your master password.'],
      ['Why can a password manager help against phishing?', ['It blocks emails', 'It only auto-fills on the matching domain', 'It changes your IP', 'It scans attachments'], 1, 'If auto-fill does not trigger, the site may be fake.'],
      ['The master password should be:', ['Short and simple', 'Long, unique, and not used anywhere else', 'Your email password', 'Written on your monitor'], 1, 'It guards everything else, so it must be strong and unique.']
    ]),
  L('Multi-Factor Authentication (MFA)',
    'MFA requires two or more kinds of proof to log in: something you know (password), something you have (phone, security key), or something you are (fingerprint, face).',
    'With MFA, a stolen password alone is usually not enough to break in.',
    'Common methods, roughly from weaker to stronger: SMS codes, email codes, authenticator-app codes (TOTP), push approvals with number matching, and passkeys or hardware security keys (FIDO2/WebAuthn). SMS can be undermined by SIM-swap attacks. Codes and push approvals can still be phished or abused by "MFA fatigue" spam, while passkeys and security keys are designed to resist phishing because they are bound to the real website.',
    'An attacker with Dee\'s password triggers repeated login push prompts at 2 a.m., hoping she taps "Approve" to make them stop. She denies them and changes her password.',
    '- Turn on MFA for email, banking, e-wallets, and social media first.\n- Prefer passkeys, security keys, or an authenticator app over SMS when available.\n- Never approve a login prompt you did not start.\n- Save backup codes somewhere safe.',
    [
      ['Which is generally the most phishing-resistant MFA option?', ['SMS code', 'Email code', 'Passkey or hardware security key', 'Security question'], 2, 'Passkeys and FIDO2 keys are bound to the real site, so fake sites cannot use them.'],
      ['You get a login approval prompt you did not request. You should:', ['Approve it', 'Deny it and change your password', 'Ignore it forever', 'Forward it'], 1, 'An unexpected prompt suggests someone has your password.'],
      ['A known weakness of SMS codes is:', ['They are too long', 'SIM-swap attacks can redirect them', 'They need internet', 'They cannot be typed'], 1, 'Attackers can sometimes trick carriers into moving your number to their SIM.']
    ]),
  L('Account Recovery Security',
    'Account recovery is how you regain access when you forget a password or lose a device: recovery email, phone number, backup codes, and security questions.',
    'Attackers often skip your strong password and attack the weaker recovery path instead.',
    'If your recovery email is old or insecure, or your security answers are on social media, an attacker can reset your password. Recovery phone numbers can be hijacked by SIM swaps.',
    'Lina\'s security question was "Mother\'s maiden name." Her mother\'s maiden name appears in public family posts, so an attacker answered it and reset her account.',
    '- Keep recovery emails and phone numbers current and secured with MFA.\n- Treat security questions like passwords: use random answers stored in your password manager.\n- Store backup codes offline.\n- Ask your mobile carrier about a SIM/port-out PIN or lock if offered.',
    [
      ['Why do attackers target recovery options?', ['They are often weaker than the main password', 'They are encrypted', 'They are illegal to use', 'They expire'], 0, 'A weak recovery path bypasses a strong password.'],
      ['A good answer to a security question is:', ['The true, public answer', 'A random answer saved in your password manager', 'Your birthday', 'Leave it blank'], 1, 'True answers are often findable; random ones are not.'],
      ['Backup codes should be stored:', ['In a public post', 'Somewhere safe, such as offline or in your password manager', 'In your email subject line', 'Nowhere'], 1, 'They are a key to your account and must be kept private.']
    ]),
  L('Credential Stuffing and Brute-Force Attacks',
    '- Brute force: trying many possible passwords until one works.\n- Credential stuffing: taking email/password pairs leaked from one site and automatically trying them on other sites.',
    'Huge lists of leaked credentials circulate online. If you reuse passwords, stuffing can unlock your accounts without any guessing.',
    'Online attacks against a login page are slowed by rate limits and lockouts. Offline attacks happen when attackers steal a database of password hashes and guess at very high speed on their own hardware, which is why long unique passwords matter. Stuffing uses bots that rotate IP addresses to avoid detection.',
    'A streaming service notices thousands of logins from different IPs, each using credentials leaked from an unrelated site. Accounts with reused passwords are hijacked and resold.',
    '- Use unique passwords everywhere (password manager).\n- Enable MFA.\n- Check breach-notification services such as Have I Been Pwned for your email.\n- Change any password that appears in a known breach.',
    [
      ['Credential stuffing relies mainly on:', ['Password reuse', 'Long passphrases', 'MFA', 'Encryption'], 0, 'It reuses leaked pairs on other sites.'],
      ['An "offline" attack means attackers:', ['Must be at your house', 'Guess against stolen password hashes on their own hardware', 'Need your phone', 'Use only email'], 1, 'Offline guessing is not slowed by website lockouts.'],
      ['Best single defense against credential stuffing?', ['Unique passwords per site', 'Changing your username', 'Clearing cookies', 'Using incognito'], 0, 'A leaked password from one site will not work elsewhere.']
    ]),
  L('Protecting Your Digital Identity',
    'Your digital identity is the set of accounts, identifiers, and records that prove who you are online: email, phone number, government IDs, financial accounts, and social profiles.',
    'Identity theft lets criminals open accounts, take loans, or commit fraud in your name, and it can take a long time to clean up.',
    'Thieves combine leaked data, phishing, and public information. Photos of IDs, selfies holding IDs, and copies sent over chat are especially valuable to them.',
    'Rafa sends a photo of his ID to a "seller" to "verify" a marketplace deal. The image is later used in an attempt to open an online loan account.',
    '- Share ID copies only with verified organizations, and watermark them with the purpose and date when possible.\n- Monitor bank and e-wallet statements and enable transaction alerts.\n- Use a separate email for important accounts.\n- Where available in your country, consider credit monitoring or a credit freeze.',
    [
      ['Which is most valuable to an identity thief?', ['A weather app', 'A photo of your government ID', 'Your favorite color', 'A public news article'], 1, 'ID images can be used to impersonate you.'],
      ['Watermarking an ID copy helps by:', ['Making it illegal to view', 'Limiting reuse for other purposes', 'Encrypting it', 'Deleting it later'], 1, 'A purpose/date watermark makes misuse harder and more obvious.'],
      ['Transaction alerts help you:', ['Spend more', 'Spot unauthorized activity quickly', 'Avoid MFA', 'Hide accounts'], 1, 'Early detection limits damage.']
    ])
];

export const module4 = [
  L('Operating System Updates',
    'Updates are fixes and improvements from your device or software maker, including security patches for known flaws.',
    'Once a flaw is publicly fixed, attackers can study the patch and target devices that have not updated.',
    'Patches close vulnerabilities in the operating system, browser, and apps. Devices that no longer receive security updates ("end of life") stay vulnerable permanently.',
    'A ransomware campaign spreads through a flaw that was patched months earlier. Updated computers are unaffected; unpatched ones are encrypted.',
    '- Turn on automatic updates for your OS, browser, and apps.\n- Restart when prompted so updates finish installing.\n- Check whether your phone or computer still receives security updates.\n- Uninstall apps you no longer use.',
    [
      ['Why delay in updating is risky:', ['Updates slow devices', 'Attackers target known, already-fixed flaws', 'Updates delete data', 'It is not risky'], 1, 'Published fixes reveal what to attack on unpatched devices.'],
      ['An "end-of-life" device:', ['Gets extra updates', 'No longer receives security patches', 'Is always safe', 'Is brand new'], 1, 'Without patches, new flaws stay open.'],
      ['Which should be updated?', ['Only the OS', 'OS, browser, and apps', 'Only games', 'Nothing'], 1, 'Any software can contain vulnerabilities.']
    ]),
  L('Malware, Spyware, Ransomware, and Trojans',
    '- Malware: any malicious software.\n- Spyware: secretly monitors activity, messages, or location.\n- Ransomware: encrypts or locks your files and demands payment.\n- Trojan: malware disguised as something useful.',
    'Malware can steal passwords and money, spy on you, or destroy your files.',
    'Malware usually arrives through phishing attachments, fake or pirated software, malicious ads, or apps from unofficial sources. Stalkerware may be installed by someone with physical access to your phone.',
    'A free "video downloader" from an unofficial site works as promised but also installs a password-stealing trojan.',
    '- Install software only from official stores or developer sites.\n- Avoid pirated software and "cracks."\n- Keep devices updated and use built-in security tools.\n- Keep backups to recover from ransomware.',
    [
      ['A trojan is malware that:', ['Spreads only by USB', 'Disguises itself as legitimate software', 'Only affects phones', 'Is harmless'], 1, 'Like the Trojan horse, it hides inside something wanted.'],
      ['Ransomware typically:', ['Shows ads', 'Encrypts files and demands payment', 'Speeds up your PC', 'Updates apps'], 1, 'It holds your data hostage.'],
      ['A common malware source is:', ['Official app stores', 'Pirated software and cracks', 'OS updates', 'Your password manager'], 1, 'Cracked software is a common carrier for malware.']
    ]),
  L('Antivirus and Endpoint Protection',
    'Antivirus and endpoint protection software detect and block known and suspicious malicious activity on your device.',
    'It is a safety net that can catch threats your other habits miss.',
    'Modern tools combine signature detection (known malware) with behavior monitoring (suspicious actions, such as mass file encryption). Windows includes Microsoft Defender, and macOS includes built-in protections such as XProtect and Gatekeeper.',
    'An employee opens a malicious attachment. Endpoint protection detects the file trying to encrypt documents and stops the process.',
    '- Keep built-in protection turned on and updated.\n- Run only one real-time antivirus to avoid conflicts.\n- Do not disable protection because a download "asks" you to.\n- Remember it is a layer, not a guarantee.',
    [
      ['Behavior-based detection looks for:', ['File names only', 'Suspicious actions like mass encryption', 'Your password', 'Screen brightness'], 1, 'It flags malicious behavior even from unknown files.'],
      ['A download that asks you to disable antivirus is:', ['Normal', 'A strong warning sign', 'Required', 'Safer'], 1, 'Malware often tries to switch off protection.'],
      ['Antivirus should be treated as:', ['A complete solution', 'One layer of defense', 'Unnecessary', 'A replacement for updates'], 1, 'Defense in depth uses several layers.']
    ]),
  L('Disk Encryption',
    'Full-disk encryption scrambles everything stored on a device so it can only be read after you unlock it with your password, PIN, or key.',
    'If your laptop or phone is lost or stolen, encryption keeps your files private.',
    'Modern phones encrypt storage when a passcode is set. Computers use tools such as BitLocker or Device Encryption (Windows) and FileVault (macOS). Protection applies when the device is powered off or locked; a stolen unlocked device is still exposed.',
    'Two laptops are stolen from a car. One has FileVault enabled; its data is unreadable. The other is unencrypted, and the thief can remove the drive and read every file.',
    '- Set a strong passcode on your phone.\n- Turn on BitLocker/Device Encryption or FileVault.\n- Store the recovery key safely; losing it can mean losing your data.\n- Lock or shut down devices when unattended.',
    [
      ['Disk encryption mainly protects data when:', ['The device is lost or stolen', 'You are browsing', 'You send email', 'You charge it'], 0, 'It protects data at rest on the device.'],
      ['FileVault is the built-in encryption for:', ['Windows', 'macOS', 'Android', 'Routers'], 1, 'FileVault is Apple\'s macOS disk encryption.'],
      ['Why store the recovery key safely?', ['It is decorative', 'Without it, you may permanently lose access to your data', 'It speeds up boot', 'It is not needed'], 1, 'The recovery key is your backup way in.']
    ]),
  L('USB Safety',
    'USB devices, including flash drives and cables, can carry malware or be built to act maliciously when plugged in.',
    'Unknown USB drives have been used to deliver malware, and some devices can pretend to be a keyboard and type commands.',
    'A drive can contain infected files. Specially built devices can emulate a keyboard and run commands within seconds. Public charging ports carry a theoretical risk of data access ("juice jacking"), which charge-only cables or your own adapter avoid.',
    'A USB drive labeled "Salaries 2026" is left in a company parking lot. A curious employee plugs it in, and it installs remote-access malware.',
    '- Never plug in USB drives you found or did not expect.\n- Use your own charger and power adapter, or a charge-only cable, in public places.\n- Disable autorun features and scan removable drives.\n- Give found drives to IT, not your computer.',
    [
      ['You find a USB drive in a parking lot. You should:', ['Plug it in to find the owner', 'Hand it to IT/security without plugging it in', 'Keep it', 'Format it on your PC'], 1, 'Found drives are a known attack method.'],
      ['Some malicious USB devices can:', ['Only store photos', 'Pretend to be a keyboard and type commands', 'Charge faster', 'Fix viruses'], 1, 'Keystroke-injection devices act like keyboards.'],
      ['A safer way to charge in public is:', ['Any unknown cable', 'Your own adapter and cable, or a charge-only cable', 'Bluetooth', 'Borrowing a stranger\'s laptop'], 1, 'Using your own power adapter avoids data connections.']
    ]),
  L('Secure Device Configuration',
    'Secure configuration means adjusting device settings to reduce risk: screen lock, app permissions, Bluetooth, sharing settings, and installed apps.',
    'Default settings often favor convenience over privacy and security.',
    'Every enabled feature or permission is a possible way in. Reducing unnecessary permissions and services shrinks your "attack surface."',
    'A flashlight app requests access to contacts, location, and the microphone. None are needed for a flashlight, so the request is a red flag.',
    '- Use a strong screen lock and short auto-lock time.\n- Review app permissions (location, camera, microphone, contacts) regularly.\n- Turn off Bluetooth, AirDrop/Nearby Share, and file sharing when not needed, or limit them to contacts.\n- Remove unused apps.\n- Enable "Find My" or "Find My Device."',
    [
      ['"Attack surface" refers to:', ['Screen size', 'All the ways a system could be attacked', 'Battery life', 'Case material'], 1, 'Fewer features and permissions mean fewer entry points.'],
      ['A flashlight app asking for contacts access is:', ['Necessary', 'A red flag', 'Required by law', 'Normal for all apps'], 1, 'Permissions should match what the app actually does.'],
      ['Which helps if your phone is lost?', ['Disabling the lock', 'Enabling Find My / Find My Device', 'Turning off updates', 'Removing the SIM PIN'], 1, 'It lets you locate, lock, or erase the device.']
    ]),
  L('Physical Device Security',
    'Physical security means protecting devices from being stolen, tampered with, or viewed by others.',
    'Someone with physical access can read your screen, install stalkerware, or steal the device itself.',
    'Risks include shoulder surfing, unattended unlocked devices, theft in public places, and tampering. Encryption and screen locks reduce the damage; awareness prevents many incidents.',
    'At a café, a person behind Mia watches her type her phone PIN, then later snatches the phone and unlocks it.',
    '- Lock your screen whenever you step away (Windows+L, Ctrl+Cmd+Q on Mac).\n- Shield your PIN and password entry in public.\n- Consider a privacy screen filter.\n- Never leave devices unattended in public.\n- Watch for signs of tampering or unknown apps.',
    [
      ['Shoulder surfing is:', ['A water sport', 'Watching someone\'s screen or keypad to steal information', 'A Wi-Fi attack', 'A type of malware'], 1, 'It is visual spying in person.'],
      ['The keyboard shortcut to lock a Windows PC is:', ['Ctrl+C', 'Windows+L', 'Alt+F4', 'Ctrl+Z'], 1, 'Windows+L locks the screen immediately.'],
      ['Physical access can allow someone to:', ['Nothing important', 'Install stalkerware or steal data', 'Only charge it', 'Update it'], 1, 'Physical access is often enough to compromise a device.']
    ])
];

export const module5 = [
  L('How the Internet Works',
    'The internet is a global network of networks that sends data in small packets between devices using shared rules called protocols (such as TCP/IP).',
    'Understanding the basics shows where your data travels and who can see it along the way.',
    'Your device connects to a router, then to your internet service provider (ISP), then through many other networks to the server. DNS translates names like example.com into IP addresses. Without encryption, anyone along the path could read the data; with HTTPS, they mostly see where you connect, not what you send.',
    'When Joy visits her bank\'s website, her request passes her home router, her ISP, and several other networks before reaching the bank. HTTPS keeps the content private along that route.',
    '- Use HTTPS sites (most browsers can warn or upgrade automatically).\n- Remember that your network provider can usually see which sites or services you connect to.\n- Keep your home router secure (see the router lesson).',
    [
      ['DNS is used to:', ['Encrypt email', 'Translate domain names into IP addresses', 'Block ads', 'Store passwords'], 1, 'DNS is like the internet\'s address book.'],
      ['Data travels across the internet in:', ['One big file', 'Small packets', 'Radio only', 'Letters'], 1, 'Data is split into packets and reassembled.'],
      ['With HTTPS, your ISP can generally see:', ['Your passwords', 'Which site you connect to, but not page contents', 'Everything you type', 'Nothing at all'], 1, 'HTTPS hides contents, but connection metadata is still visible.']
    ]),
  L('Public Wi-Fi Risks',
    'Public Wi-Fi is any network shared with strangers: cafés, airports, hotels, malls.',
    'You do not control the network, and you do not know who else is on it.',
    'Risks include fake "evil twin" hotspots with convincing names, fake captive-portal login pages, and attacks against devices on the same network. Widespread HTTPS has reduced the risk of simple eavesdropping, but fake portals and unpatched devices are still concerns.',
    'At an airport, Leo connects to "Airport_Free_WiFi_Fast." It is a hotspot run from someone\'s laptop that shows a fake login page asking for his email password.',
    '- Confirm the official network name with staff.\n- Never enter account passwords on a Wi-Fi sign-in page.\n- Prefer your mobile data or hotspot for sensitive tasks.\n- Set public networks as "Public" so file sharing is off.\n- Forget networks after use to avoid auto-reconnecting.',
    [
      ['An "evil twin" is:', ['A backup router', 'A fake hotspot imitating a real one', 'A VPN', 'A firewall rule'], 1, 'It lures users with a familiar or appealing name.'],
      ['A Wi-Fi sign-in page asks for your email password. You should:', ['Enter it', 'Refuse; that is not normal', 'Use a different password', 'Restart'], 1, 'Captive portals should not need your account credentials.'],
      ['For banking on the go, a safer option is usually:', ['Any open Wi-Fi', 'Your mobile data', 'A shared computer', 'An unknown hotspot'], 1, 'Mobile data avoids the shared network.']
    ]),
  L('VPNs: What They Do and Don\'t Do',
    'A VPN (Virtual Private Network) creates an encrypted tunnel between your device and a VPN server, which then connects to websites for you.',
    'VPNs are often marketed as complete privacy solutions. Knowing their limits avoids false confidence.',
    'A VPN hides your traffic from the local network and your ISP and shows websites the VPN\'s IP address instead of yours. However, the VPN provider can now see your connection metadata, so you shift trust to them. A VPN does not stop phishing, malware, tracking by logged-in accounts, or browser fingerprinting, and it does not make you anonymous.',
    'Nico uses a VPN on café Wi-Fi, which protects him from the local network. He is still tracked by the social site he is logged into, and a VPN would not have stopped the phishing link he nearly clicked.',
    '- Use a VPN when you do not trust the local network, or for work access if required.\n- Choose a reputable provider with a clear privacy policy and independent audits; be cautious of free VPNs that monetize your data.\n- Do not rely on a VPN for anonymity or malware protection.',
    [
      ['A VPN mainly protects you from:', ['Phishing', 'The local network and ISP seeing your traffic', 'All tracking', 'Malware'], 1, 'It encrypts traffic between you and the VPN server.'],
      ['When you use a VPN, who can see your connection metadata?', ['No one', 'The VPN provider', 'Only you', 'Only the website'], 1, 'You shift trust from your ISP to the VPN provider.'],
      ['Does a VPN make you anonymous?', ['Yes, completely', 'No; logins, cookies, and fingerprinting still identify you', 'Only on weekends', 'Only on mobile'], 1, 'Many tracking methods do not depend on your IP address.']
    ]),
  L('DNS and HTTPS',
    '- DNS converts names (example.com) into IP addresses.\n- HTTPS is HTTP secured with TLS encryption, protecting data between your browser and a website.',
    'Unprotected DNS can reveal which sites you visit and can be manipulated; HTTPS prevents eavesdropping and tampering with page contents.',
    'Traditional DNS queries are unencrypted. DNS over HTTPS (DoH) and DNS over TLS (DoT) encrypt them. HTTPS uses certificates to prove the server controls the domain, but a certificate does not prove the site is honest; scammers can get certificates for their own look-alike domains.',
    'On a compromised network, an attacker tampers with DNS so a bank name resolves to a fake server. Because the attacker cannot get a valid certificate for the real bank domain, the browser shows a certificate warning, which the user should not bypass.',
    '- Do not click through certificate warnings on sensitive sites.\n- Enable "HTTPS-Only" or "Always use secure connections" in your browser.\n- Consider enabling encrypted DNS (DoH) in your browser or OS.\n- Remember: padlock = encrypted connection, not proof of legitimacy.',
    [
      ['DNS over HTTPS (DoH) does what?', ['Speeds up downloads', 'Encrypts DNS queries', 'Blocks all ads', 'Replaces passwords'], 1, 'It hides DNS lookups from the local network.'],
      ['A certificate warning on your bank\'s site means you should:', ['Click "proceed anyway"', 'Stop and not continue', 'Refresh until it disappears', 'Disable HTTPS'], 1, 'It may indicate interception or a fake site.'],
      ['HTTPS proves that:', ['The site is honest', 'The connection is encrypted to the server for that domain', 'The site has no malware', 'The site is government-approved'], 1, 'It authenticates the domain, not the owner\'s intentions.']
    ]),
  L('Router Security',
    'Your home router connects your devices to the internet and is the front door of your home network.',
    'A compromised router can redirect traffic, spy on devices, or be used in botnets.',
    'Routers often ship with default admin passwords, outdated firmware, and features such as WPS or remote management turned on. Attackers scan the internet for routers with these weaknesses.',
    'An old router still uses the default admin password printed on its label. Malware logs in, changes its DNS settings, and sends household devices to fake websites.',
    '- Change the router admin password from the default.\n- Update firmware, or replace routers that no longer receive updates.\n- Use WPA3, or WPA2-AES if WPA3 is unavailable, with a strong Wi-Fi password.\n- Disable WPS and remote administration if you do not need them.\n- Use a separate guest network for visitors and smart devices.',
    [
      ['Which Wi-Fi security setting is best if supported?', ['WEP', 'Open', 'WPA3', 'WPS'], 2, 'WPA3 is the current standard; WEP is broken.'],
      ['Why change the router\'s default admin password?', ['Defaults are often known or easy to find', 'It increases speed', 'It is decorative', 'It updates firmware'], 0, 'Attackers try default credentials automatically.'],
      ['A guest network is useful for:', ['Making Wi-Fi faster', 'Separating visitors and smart devices from your main devices', 'Removing passwords', 'Disabling updates'], 1, 'Segmentation limits what a compromised device can reach.']
    ]),
  L('Network Sniffing and Man-in-the-Middle Attacks',
    '- Sniffing: capturing network traffic to read it.\n- Man-in-the-middle (MITM): secretly sitting between two parties to read or alter their communication.',
    'Unencrypted traffic can reveal passwords, messages, and session data.',
    'On shared networks, attackers can try ARP spoofing, rogue access points, or DNS tampering to position themselves in the middle. Encryption such as HTTPS and certificate checks make intercepted data unreadable and reveal many tampering attempts.',
    'At a conference, an attacker sets up a rogue access point. Users who ignore certificate warnings on a login page have their credentials captured.',
    '- Use HTTPS everywhere and heed certificate warnings.\n- Prefer trusted networks or mobile data for sensitive activity.\n- Keep devices updated.\n- Use a VPN on networks you do not trust.',
    [
      ['A man-in-the-middle attacker:', ['Breaks your screen', 'Secretly intercepts communication between two parties', 'Only sends spam', 'Repairs networks'], 1, 'They sit between you and the destination.'],
      ['What makes sniffed traffic far less useful?', ['Encryption such as HTTPS', 'A bigger screen', 'Faster Wi-Fi', 'Bluetooth'], 0, 'Encrypted data is unreadable without keys.'],
      ['A certificate warning during login might indicate:', ['A normal page', 'Possible interception', 'A faster site', 'A software update'], 1, 'MITM attempts often trigger certificate errors.']
    ]),
  L('Firewall Fundamentals',
    'A firewall controls which network connections are allowed into or out of a device or network, based on rules.',
    'It blocks unwanted incoming connections that could exploit services on your device.',
    'Your router typically blocks unsolicited incoming connections from the internet. Operating systems include host firewalls (Windows Defender Firewall, macOS Application Firewall) that can block apps or services, especially on public networks.',
    'A laptop with file sharing turned on joins hotel Wi-Fi. Because the network is set to "Public," the firewall blocks other guests from reaching the shared folders.',
    '- Keep your OS firewall turned on.\n- Mark untrusted networks as Public.\n- Only allow apps through the firewall when you understand why.\n- Avoid opening router ports unless necessary.',
    [
      ['A firewall\'s job is to:', ['Speed up the internet', 'Allow or block connections based on rules', 'Store passwords', 'Scan photos'], 1, 'It filters network traffic.'],
      ['Setting a network to "Public" usually:', ['Turns off security', 'Applies stricter firewall rules and disables sharing', 'Shares your files', 'Disables Wi-Fi'], 1, 'Public profiles are more restrictive.'],
      ['Opening router ports should be done:', ['Always', 'Only when necessary and understood', 'Never possible', 'For speed'], 1, 'Each open port exposes a service to the internet.']
    ])
];

export const module6 = [
  L('Browser Fingerprinting',
    'Browser fingerprinting identifies your browser by combining many small details: screen size, fonts, time zone, language, graphics hardware, and settings.',
    'It can track you across sites even without cookies and even when you change IP address.',
    'Each detail is common, but the combination can be rare enough to recognize you. Scripts collect these values and compute an identifier. Some browsers reduce fingerprinting by standardizing or randomizing values.',
    'Sam clears cookies daily and uses a VPN, yet ad networks still recognize his browser because its combination of fonts, extensions, and settings is unusual.',
    '- Use a browser with fingerprinting protections (for example, Firefox, Brave, or Tor Browser).\n- Avoid installing many unusual extensions, which can make you more unique.\n- Keep browser privacy protections enabled.\n- Accept that complete protection is difficult.',
    [
      ['Fingerprinting can track you:', ['Only with cookies', 'Even without cookies', 'Only offline', 'Only on phones'], 1, 'It uses device and browser characteristics instead of stored files.'],
      ['Installing many rare extensions may:', ['Make you less unique', 'Make your fingerprint more unique', 'Have no effect', 'Block all tracking'], 1, 'Unusual configurations stand out.'],
      ['A VPN alone stops fingerprinting:', ['True', 'False'], 1, 'Fingerprinting does not rely on your IP address.']
    ]),
  L('Cookies and Tracking',
    'Cookies are small files websites store in your browser. First-party cookies come from the site you visit (keeping you logged in); third-party cookies come from other domains, often advertisers, and can track you across sites.',
    'Tracking builds detailed profiles of your interests, habits, and sometimes sensitive topics.',
    'Trackers use cookies, pixels, scripts, and logged-in accounts to link your activity. Many browsers now restrict third-party cookies by default, but trackers also use other techniques.',
    'After reading about a medical condition on a health site, Nina sees related ads on unrelated websites and social media.',
    '- Block third-party cookies in your browser settings.\n- Use tracker-blocking browsers or reputable extensions.\n- Reject non-essential cookies in consent banners.\n- Log out of, or separate, accounts used for sensitive browsing.',
    [
      ['Third-party cookies are mainly used for:', ['Keeping you logged in on the same site', 'Tracking across different sites', 'Encrypting traffic', 'Speeding up pages'], 1, 'They are set by domains other than the one you are visiting.'],
      ['A tracking pixel is:', ['A screen defect', 'A tiny embedded image or script that reports your visit', 'A password', 'A firewall'], 1, 'Pixels quietly signal that content was loaded.'],
      ['Being logged into a large platform while browsing can:', ['Prevent tracking', 'Help that platform link your activity', 'Delete cookies', 'Hide your IP'], 1, 'Logged-in identity is a strong tracking signal.']
    ]),
  L('Search Engine Privacy',
    'Search engines can log your queries, IP address, and clicks, and link them to your account.',
    'Searches can reveal health concerns, finances, relationships, and plans.',
    'Search history may be stored and used for personalization and ads. Privacy-focused search engines (for example, DuckDuckGo, Startpage, or Brave Search) say they do not build personal search profiles. Check each provider\'s current policy.',
    'Tom searches for symptoms and loan options while logged into his account. That history is saved and visible to anyone who later accesses his account.',
    '- Review and auto-delete search history in your account settings.\n- Use a privacy-focused search engine for sensitive topics.\n- Search while logged out when appropriate.',
    [
      ['Search queries can reveal:', ['Nothing', 'Health, financial, and personal interests', 'Only weather', 'Your password'], 1, 'Queries are very personal data.'],
      ['One way to limit stored search history is:', ['Searching more', 'Turning on auto-delete in account settings', 'Using all caps', 'Using more tabs'], 1, 'Many providers offer history controls.'],
      ['Privacy-focused search engines claim to:', ['Hack trackers', 'Not build personal search profiles', 'Replace browsers', 'Block all ads everywhere'], 1, 'Read each provider\'s policy to understand its claims.']
    ]),
  L('Metadata and EXIF Data',
    'Metadata is data about data. EXIF metadata in photos can include the camera model, date and time, and sometimes GPS coordinates.',
    'A photo can reveal where you live or where you were, even if the image itself shows nothing identifying.',
    'Phones may embed location in photos if location access is enabled for the camera. Many large social platforms remove EXIF data on upload, but files sent as documents, by email, or through some apps and websites may keep it. Documents can also contain author names and edit history.',
    'Someone sells an item online and attaches original photos taken at home. The files still contain GPS coordinates that point to their house.',
    '- Turn off location tagging for your camera app if you do not need it.\n- Remove location before sharing (most phones offer an option in the share sheet).\n- Check document properties for author names before sending.\n- Assume the original file contains more than you can see.',
    [
      ['EXIF data can include:', ['GPS location', 'Your bank PIN', 'Your browser history', 'Nothing useful'], 0, 'Photos can contain location coordinates.'],
      ['Do all sharing methods remove EXIF?', ['Yes, always', 'No; some keep the original file\'s metadata', 'Only email removes it', 'Only USB'], 1, 'Behavior varies by platform and method.'],
      ['A simple way to reduce photo metadata risk is:', ['Taking blurrier photos', 'Disabling camera location tagging', 'Using bigger files', 'Renaming files'], 1, 'If location is never recorded, it cannot leak.']
    ]),
  L('Location Sharing Risks',
    'Location sharing includes live location in maps or messaging apps, check-ins, location-tagged posts, and fitness apps that record routes.',
    'Real-time or habitual location data can expose your home, routine, and when you are away.',
    'Apps may share location continuously with contacts or publicly. Fitness apps can reveal start and end points of runs, often your home.',
    'A runner\'s public fitness profile shows the same route each morning starting and ending at one address, revealing where they live and when they leave.',
    '- Review which apps have "Always" location access and reduce it to "While using" or "Never."\n- Share live location only with trusted people and for a limited time.\n- Set privacy zones around your home in fitness apps.\n- Avoid real-time location tags in public posts.',
    [
      ['Fitness app routes can reveal:', ['Your home and routine', 'Nothing', 'Only distance', 'Your password'], 0, 'Start and end points often reveal your home.'],
      ['A safer location permission for most apps is:', ['Always', 'While using the app', 'Shared publicly', 'Shared with everyone'], 1, 'Limit background access to what is needed.'],
      ['Privacy zones in fitness apps:', ['Hide the parts of routes near chosen places', 'Make routes public', 'Speed up GPS', 'Delete the app'], 0, 'They mask sensitive start and end points.']
    ]),
  L('Social Media Privacy',
    'Social media privacy is control over who can see your posts, profile details, friends list, and tagged content.',
    'Profiles are a main source for scammers, stalkers, and identity thieves.',
    'Default settings often make content public. Old posts, tagged photos, and friend lists can reveal relationships, schools, workplaces, and routines.',
    'A scammer studies a person\'s public family photos and names, then messages their grandparent pretending to be that person in an emergency.',
    '- Run each platform\'s privacy checkup.\n- Limit old posts to friends.\n- Hide your friends list and contact details.\n- Require approval for tags.\n- Think about who could see a post before sharing.',
    [
      ['A public friends list can help scammers:', ['Do nothing', 'Identify family and contacts to target or impersonate', 'Improve your privacy', 'Block spam'], 1, 'It maps your relationships.'],
      ['Requiring tag approval:', ['Lets you review posts that mention you before they appear on your profile', 'Deletes your account', 'Makes everything public', 'Has no effect'], 0, 'It gives you control over tagged content.'],
      ['A good regular habit is:', ['Making all posts public', 'Running the platform\'s privacy checkup', 'Sharing your phone number', 'Accepting all friend requests'], 1, 'Settings and defaults change over time.']
    ]),
  L('Tor, Private Browsing, and Anonymity Misconceptions',
    '- Private/incognito browsing: does not save history, cookies, or form data on your device after you close the window.\n- Tor Browser: routes traffic through three volunteer relays to hide your IP address from sites and your network provider from your destinations.',
    'Many people overestimate what these tools do, which leads to risky behavior.',
    'Incognito does not hide your activity from websites, your employer or school network, or your ISP. Tor provides strong network anonymity, but logging into personal accounts, sharing identifying details, or downloading and opening files can still reveal who you are. The Tor exit relay can see traffic that is not encrypted with HTTPS.',
    'Ana uses incognito mode at work, believing her employer cannot see what sites she visits. The company network logs every connection regardless.',
    '- Use incognito to avoid leaving history on a shared device, not for anonymity.\n- If you use Tor, do not log into personal accounts and keep using HTTPS.\n- Remember that behavior (what you say and log into) often identifies you more than technology does.',
    [
      ['Incognito mode prevents:', ['Your ISP from seeing your activity', 'Local history from being saved after closing', 'Websites from seeing you', 'Malware'], 1, 'It is a local privacy feature only.'],
      ['How many relays does a typical Tor circuit use?', ['One', 'Three', 'Ten', 'None'], 1, 'Tor circuits use guard, middle, and exit relays.'],
      ['What can still reveal your identity on Tor?', ['Logging into personal accounts', 'Using HTTPS', 'Closing the browser', 'Using default settings'], 0, 'Logging in tells the site exactly who you are.']
    ])
];

export const module7 = [
  L('Identifying Your Threat Model',
    'A threat model is a structured description of what you are protecting, from whom, and how much effort it is worth.',
    'Security advice is not one-size-fits-all. A journalist, a small business owner, and a student face different threats.',
    'Answer five questions: What do I want to protect? Who do I want to protect it from? How likely is it that I will need to protect it? How bad are the consequences if I fail? How much trouble am I willing to go through to prevent them? (These questions are adapted from EFF\'s Surveillance Self-Defense guide.)',
    'Mara\'s main concern is an ex-partner who knows her old passwords and devices. Her threat model leads her to change passwords, check for stalkerware, review location sharing, and log out of all sessions, rather than buying expensive tools.',
    '- Write down your top assets and adversaries.\n- Match protections to realistic threats.\n- Revisit your model when your situation changes.\n- Use the Threat Modeling Simulator in Labs to practice.',
    [
      ['A threat model starts with:', ['Buying tools', 'What you want to protect', 'Deleting accounts', 'Changing ISPs'], 1, 'You must first know your assets.'],
      ['Why is threat modeling personal?', ['Everyone faces the same threats', 'Different people have different assets and adversaries', 'It is required by law', 'It is not personal'], 1, 'Protections should match your actual risks.'],
      ['Which is part of a threat model?', ['How much trouble you will accept to prevent harm', 'Your favorite app color', 'Your phone brand only', 'Your typing speed'], 0, 'Effort and cost matter in choosing protections.']
    ]),
  L('Risk Assessment',
    'Risk assessment is ranking risks by likelihood and impact so you can decide what to fix first.',
    'You have limited time and money. Assessment focuses effort on the biggest risks.',
    'List threats and vulnerabilities, rate each for likelihood and impact (for example, 1–3), and multiply. Address high scores first, and accept or monitor low scores.',
    'Jun rates "email takeover" as likely (3) and severe (3) = 9, and "laptop theft at home" as unlikely (1) but severe (3) = 3. He secures his email with MFA first.',
    '- Use a simple likelihood × impact grid.\n- Fix the highest scores first.\n- Re-assess after big changes.\n- Document decisions so you remember why you made them.',
    [
      ['Likelihood 3 × Impact 2 gives a score of:', ['5', '6', '1', '32'], 1, '3 × 2 = 6.'],
      ['Which risk should be addressed first?', ['Score 2', 'Score 9', 'Score 4', 'Score 1'], 1, 'Highest likelihood × impact first.'],
      ['Low-score risks can be:', ['Ignored forever without thought', 'Accepted or monitored consciously', 'Always fixed first', 'Made public'], 1, 'Accepting a small risk is a valid, deliberate choice.']
    ]),
  L('Compartmentalization',
    'Compartmentalization means separating parts of your digital life so a problem in one area does not spread to others.',
    'If everything is linked to one email and one password, a single breach exposes everything.',
    'Use separate emails, browsers or browser profiles, devices, or accounts for different purposes: banking, work, shopping, social, and sign-ups.',
    'Lia uses one email for banking, another for shopping and newsletters. When a shopping site is breached, phishing floods that inbox, but her banking email remains unknown to attackers.',
    '- Use a dedicated email for financial accounts.\n- Use email aliases or a secondary address for sign-ups.\n- Separate work and personal devices or accounts.\n- Use different browser profiles for different activities.',
    [
      ['Compartmentalization limits:', ['Internet speed', 'How far a single breach can spread', 'Battery life', 'Screen time'], 1, 'Separation contains damage.'],
      ['A dedicated email for banking helps because:', ['It is free', 'Fewer people know it, so it receives fewer targeted attacks', 'It removes MFA', 'It is faster'], 1, 'Less exposure means less targeting.'],
      ['Which is a form of compartmentalization?', ['Using one password everywhere', 'Separate browser profiles for work and personal use', 'Sharing accounts', 'Posting everything publicly'], 1, 'Profiles keep cookies and logins separate.']
    ]),
  L('The Need-to-Know Principle',
    'Need-to-know means sharing information only with people who actually need it to do their part.',
    'Every extra person who knows something is another possible leak, by accident or on purpose.',
    'Before sharing, ask: Does this person need this specific information? Do they need all of it? For how long? This applies to family plans, work data, and passwords.',
    'An office shares the admin password for its main account in a group chat with 40 people. When one member\'s phone is stolen, the password is exposed.',
    '- Share the minimum information needed.\n- Use password managers\' sharing features instead of chat messages.\n- Remove access when people no longer need it.\n- Avoid discussing sensitive plans in public places.',
    [
      ['Need-to-know means:', ['Tell everyone for transparency', 'Share only with those who need it, and only what they need', 'Never share anything', 'Share publicly'], 1, 'Minimize who knows and how much.'],
      ['A safer way to share a password with a coworker is:', ['Group chat', 'A password manager\'s secure sharing feature', 'Email subject line', 'Sticky note'], 1, 'Secure sharing can be controlled and revoked.'],
      ['When someone no longer needs access, you should:', ['Leave it', 'Remove their access', 'Give more access', 'Post the password'], 1, 'Regularly review and revoke access.']
    ]),
  L('Information Classification',
    'Information classification means labeling information by how sensitive it is, so you know how to handle it.',
    'Treating everything the same leads to either overprotecting trivial data or underprotecting critical data.',
    'A simple personal scheme: Public (fine to share), Internal (family/friends only), Confidential (ID numbers, finances, health), and Restricted (passwords, recovery codes, private keys). Each level has handling rules.',
    'Ella classifies her scanned passport as Confidential: stored encrypted, never sent over chat, and shared only with verified organizations when required.',
    '- Define three or four levels for your own information.\n- Decide where each level may be stored and how it may be shared.\n- Encrypt Confidential and Restricted data.\n- Shred or securely delete sensitive data you no longer need.',
    [
      ['Recovery codes would most likely be classified as:', ['Public', 'Internal', 'Restricted', 'Unimportant'], 2, 'They grant direct access to accounts.'],
      ['Why classify information?', ['To apply the right protection to the right data', 'To make files bigger', 'For fun only', 'To share more'], 0, 'Protection should match sensitivity.'],
      ['Confidential data should usually be:', ['Posted online', 'Stored encrypted and shared only when necessary', 'Sent in group chats', 'Printed and left out'], 1, 'Sensitive data needs stronger handling rules.']
    ]),
  L('Secure Communication',
    'Secure communication protects the content of your messages and calls from being read by others, and helps confirm who you are talking to.',
    'Messages can contain sensitive details. Interception, compromised accounts, or the wrong recipient can expose them.',
    'End-to-end encryption (E2EE) means only the sender and recipients can read messages; the service provider cannot. Signal uses E2EE by default; WhatsApp also uses E2EE for chats. Regular SMS is not end-to-end encrypted. Even with E2EE, metadata (who you talk to and when) may still be visible to the provider, and anyone who can open your unlocked phone can read your messages.',
    'Two colleagues verify each other\'s Signal safety numbers in person before discussing a confidential project, confirming no one is impersonating either of them.',
    '- Prefer E2EE messengers for sensitive conversations.\n- Verify safety numbers or security codes for important contacts.\n- Use disappearing messages where appropriate.\n- Protect devices with strong locks; E2EE does not protect an unlocked phone.',
    [
      ['End-to-end encryption means:', ['The provider can read messages', 'Only the sender and recipients can read messages', 'Messages are public', 'No internet is needed'], 1, 'Keys exist only on participants\' devices.'],
      ['Regular SMS is:', ['End-to-end encrypted', 'Not end-to-end encrypted', 'Anonymous', 'Untraceable'], 1, 'SMS can be accessed by carriers and sometimes intercepted.'],
      ['Even with E2EE, what may still be visible to the provider?', ['Message content', 'Metadata such as who you talk to and when', 'Your password', 'Nothing'], 1, 'Metadata can still be revealing.']
    ]),
  L('OpSec Failures and Real-World Case Studies',
    'Studying real incidents shows how small mistakes lead to large consequences.',
    'Case studies make abstract advice concrete and memorable.',
    'Common themes: oversharing (public fitness or photo data), weak or reused credentials without MFA, social engineering of support staff, and third-party access. The Reference Hub includes case summaries such as the 2018 fitness heatmap revelations, the 2020 Twitter phone-spear-phishing incident, and the 2021 Colonial Pipeline ransomware attack.',
    'In January 2018, researchers noticed that a fitness app\'s public global heatmap revealed activity patterns around sensitive military locations, because personnel recorded their runs with default sharing settings.',
    '- For each case, ask: What was the critical information? Which vulnerability was used? What simple countermeasure would have helped?\n- Apply the same questions to your own habits.',
    [
      ['The 2018 fitness heatmap issue was mainly caused by:', ['A data breach', 'Users sharing activity data with default/public settings', 'Ransomware', 'A router flaw'], 1, 'The data was shared publicly through normal app features.'],
      ['A common lesson across many incidents is:', ['Small, ordinary mistakes can have big effects', 'Only experts make mistakes', 'Security tools always prevent breaches', 'Nothing can be learned'], 0, 'Basic failures often enable major incidents.'],
      ['When studying a case, a useful question is:', ['Who is to blame?', 'What simple countermeasure would have helped?', 'How famous was it?', 'How expensive was it?'], 1, 'Focus on lessons you can apply.']
    ])
];

export const module8 = [
  L('Recognizing Compromised Accounts',
    'A compromised account is one that someone else has accessed or controls without your permission.',
    'Spotting compromise early limits damage to you and to contacts who might be scammed in your name.',
    'Warning signs: login alerts you did not trigger, password reset emails you did not request, sent messages or posts you did not make, changed recovery details, unfamiliar devices or sessions, and contacts reporting strange messages from you.',
    'Friends tell Carlo that "he" asked them for money on a chat app. He checks his active sessions and finds an unknown device logged in from another country.',
    '- Review active sessions and devices regularly.\n- Turn on login alerts.\n- Act immediately on warning signs: change the password, sign out of all sessions, enable MFA, and check recovery options.',
    [
      ['Which is a sign of account compromise?', ['A login alert you did not trigger', 'A normal newsletter', 'Your own post', 'A software update'], 0, 'Unexpected login alerts should be investigated.'],
      ['Where can you often see unknown devices?', ['Active sessions or device list in account settings', 'Your phone wallpaper', 'Calculator', 'Camera roll'], 0, 'Most major services list active sessions.'],
      ['First steps after suspected compromise include:', ['Waiting a week', 'Changing the password and signing out all sessions', 'Deleting your phone', 'Posting about it publicly first'], 1, 'Cut off the attacker\'s access quickly.']
    ]),
  L('Steps After a Data Breach',
    'A data breach is when an organization\'s data, possibly including yours, is accessed or leaked without authorization.',
    'Leaked details can be used for credential stuffing, phishing, and identity fraud.',
    'Find out what data was exposed (email, password, phone, ID numbers, payment details). The right response depends on what leaked.',
    'An online shop announces a breach of emails and hashed passwords. Mika changes that password, and any other account where she reused it, and watches for phishing emails mentioning the shop.',
    '- Read the official breach notice to learn what leaked.\n- Change the affected password and any reused copies.\n- Enable MFA.\n- Watch for targeted phishing referencing the breach.\n- If payment or ID data leaked, contact your bank and monitor statements.',
    [
      ['After a breach, which passwords should you change?', ['None', 'The breached site\'s password and anywhere you reused it', 'Only your Wi-Fi password', 'Your phone PIN only'], 1, 'Reused passwords are at risk everywhere.'],
      ['Why expect more phishing after a breach?', ['Attackers can use leaked details to make messages convincing', 'Breaches stop phishing', 'Email providers send more ads', 'They do not'], 0, 'Leaked data fuels targeted scams.'],
      ['The response depends mostly on:', ['What data was exposed', 'The weather', 'Your phone brand', 'The time of day'], 0, 'Different data requires different actions.']
    ]),
  L('Securing a Compromised Device',
    'A compromised device has malware, stalkerware, or unauthorized access.',
    'A compromised device can capture new passwords as you type them, so you must clean it or use another device for recovery.',
    'Signs include unknown apps, unusual battery drain or data use, disabled security settings, or pop-ups. Remediation ranges from removing apps and running security scans to a full factory reset.',
    'Dani suspects stalkerware after her ex knew details from her private messages. She contacts a support organization for advice, then changes passwords from a different trusted device before deciding how to deal with the phone.',
    '- Use a known-clean device to change important passwords.\n- Update the OS, remove unknown apps, and run security scans.\n- If in doubt, back up personal files (not apps) and factory reset.\n- If you suspect stalkerware, consider your safety first; removing it may alert the person who installed it. Seek help from specialized support organizations.',
    [
      ['Why change passwords from a different device?', ['It is faster', 'The compromised device may capture new passwords', 'It is required by law', 'It saves battery'], 1, 'Keyloggers or spyware could record new credentials.'],
      ['A strong remediation for a badly infected device is:', ['Ignoring it', 'Factory reset after backing up personal files', 'Changing the wallpaper', 'Turning off Wi-Fi only'], 1, 'A reset removes most software-based compromise.'],
      ['Before removing suspected stalkerware, you should:', ['Consider personal safety, since removal may alert the abuser', 'Post about it', 'Ignore it', 'Share your password'], 0, 'Safety planning matters in abuse situations.']
    ]),
  L('Account Recovery Procedures',
    'Account recovery procedures are the official steps a service provides to regain control of an account you have lost.',
    'Knowing the official route in advance saves time and helps you avoid fake "recovery" services.',
    'Most providers offer recovery forms, identity verification, backup codes, or trusted contacts. Recovery may take days. Use only official help pages, which you should reach by typing the address yourself or through the official app.',
    'After losing access to his social media account, Ken searches online and finds a "recovery expert" asking for payment. He instead uses the platform\'s official recovery form and backup codes.',
    '- Save backup codes and keep recovery info current before you need it.\n- Use only official help pages and in-app options.\n- Never pay strangers to recover accounts.\n- After recovery: change the password, review sessions, enable MFA, and check for changes the attacker made.',
    [
      ['A stranger offers to recover your account for a fee. This is likely:', ['Official support', 'A scam', 'Required', 'Free help'], 1, 'Recovery scams target people in distress.'],
      ['What should you do after regaining access?', ['Nothing', 'Change the password, review sessions, enable MFA, and check settings', 'Delete your email', 'Share the password'], 1, 'Remove the attacker\'s foothold and changes.'],
      ['When is the best time to set up recovery options?', ['After losing access', 'Before you need them', 'Never', 'Only on holidays'], 1, 'Preparation makes recovery possible.']
    ]),
  L('Backups and Disaster Recovery',
    'A backup is a separate copy of your data that you can restore after loss, theft, hardware failure, or ransomware.',
    'Without backups, a single incident can permanently erase photos, documents, and work.',
    'The 3-2-1 rule: keep 3 copies of your data, on 2 different types of storage, with 1 copy off-site (for example, in the cloud or another location). Keep at least one backup disconnected or versioned so ransomware cannot encrypt it too. Test restoring occasionally.',
    'Ransomware encrypts Rico\'s laptop and the external drive that was plugged in. His cloud backup with version history lets him restore files from before the attack.',
    '- Follow the 3-2-1 rule.\n- Use cloud backup with version history and an external drive you disconnect after backing up.\n- Test restoring a file periodically.\n- Back up phone photos and two-factor recovery codes too.',
    [
      ['In the 3-2-1 rule, the "1" means:', ['One password', 'One copy off-site', 'One device', 'One day'], 1, 'An off-site copy survives local disasters.'],
      ['Why keep a backup disconnected?', ['To save power', 'So ransomware cannot encrypt it too', 'It is faster', 'No reason'], 1, 'Connected drives can be encrypted along with the computer.'],
      ['Why test restoring?', ['To confirm backups actually work', 'To waste time', 'It deletes old files', 'It is not useful'], 0, 'Untested backups may fail when needed.']
    ]),
  L('Reporting Cybercrime',
    'Reporting cybercrime means notifying the right organizations: your bank or e-wallet, the platform involved, and law enforcement or a national cybercrime authority.',
    'Fast reporting can sometimes freeze stolen funds, take down scam accounts, and help protect others.',
    'Contact your bank or e-wallet first if money is involved, since transfers may sometimes be stopped if reported quickly. Report the account or message to the platform. Then file a report with the relevant authority. In the Philippines, the Cybercrime Investigation and Coordinating Center (CICC) runs the 24/7 Inter-Agency Response Center hotline 1326; the PNP Anti-Cybercrime Group and NBI Cybercrime Division also receive complaints. In the United States, reports go to the FBI\'s Internet Crime Complaint Center (ic3.gov). Check your own country\'s official channels.',
    'Within minutes of realizing she was scammed, Liza calls her e-wallet provider to report the transfer, reports the scammer\'s profile to the platform, and files a report with the national cybercrime hotline, keeping screenshots as evidence.',
    '- Act quickly when money is involved.\n- Keep evidence: screenshots, transaction IDs, usernames, phone numbers, links, and dates.\n- Report to your bank or e-wallet, the platform, and the official cybercrime authority.\n- Beware of fake "recovery" agents who contact you after you report.',
    [
      ['If money was stolen, who should you usually contact first?', ['Your bank or e-wallet provider', 'A recovery agent you found online', 'No one', 'The scammer'], 0, 'Quick reporting may allow a transfer to be stopped.'],
      ['Which evidence should you keep?', ['Screenshots, transaction IDs, usernames, links, and dates', 'Nothing', 'Only your feelings', 'Only the final balance'], 0, 'Details help investigators and providers.'],
      ['In the Philippines, the CICC\'s 24/7 cybercrime hotline number is:', ['911', '1326', '8888', '117'], 1, 'The Inter-Agency Response Center hotline is 1326.']
    ]),
  L('Building Your Personal OpSec Checklist',
    'A personal OpSec checklist is a short list of security habits and settings tailored to your own threat model.',
    'A checklist turns knowledge into action and helps you keep habits over time.',
    'Combine what you learned: protect critical accounts, secure devices, manage your footprint, prepare for incidents. Review it every few months and after big life changes.',
    'Ivy builds her checklist: password manager set up, MFA on email and banking, phone encrypted with a strong PIN, backups weekly, privacy settings reviewed, recovery codes stored. She sets a calendar reminder to review it quarterly.',
    '- Use the Security Checklist on your Dashboard; it syncs to your account.\n- Start with high-impact items: email MFA, unique passwords, updates, backups.\n- Add items specific to your threat model.\n- Review every 3–6 months.',
    [
      ['A personal checklist should be:', ['Identical for everyone', 'Tailored to your threat model', 'Kept secret from yourself', 'Done once and forgotten'], 1, 'Your risks shape your checklist.'],
      ['Which is a high-impact first item?', ['Changing wallpaper', 'Enabling MFA on your email', 'Buying a new phone', 'Deleting all apps'], 1, 'Email protects most other accounts.'],
      ['How often should you review your checklist?', ['Never', 'Every few months and after major changes', 'Every hour', 'Only after being hacked'], 1, 'Regular reviews keep it current.']
    ])
];
