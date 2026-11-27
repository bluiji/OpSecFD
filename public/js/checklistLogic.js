// Security Checklist items and the pure logic for its two-stage flow.
// No DOM or Supabase imports, so it can be unit-tested in Node.

export const CHECKLIST = [
  { key: 'pw_manager', group: 'Accounts', text: 'Set up a password manager' },
  { key: 'unique_pw', group: 'Accounts', text: 'Use unique passwords for email, banking, and social media' },
  { key: 'mfa_email', group: 'Accounts', text: 'Turn on MFA for my primary email' },
  { key: 'mfa_finance', group: 'Accounts', text: 'Turn on MFA for banking and e-wallet apps' },
  { key: 'recovery', group: 'Accounts', text: 'Update recovery email/phone and save backup codes' },
  { key: 'os_updates', group: 'Devices', text: 'Enable automatic updates on phone and computer' },
  { key: 'screen_lock', group: 'Devices', text: 'Use a strong screen lock with short auto-lock' },
  { key: 'encryption', group: 'Devices', text: 'Turn on disk encryption (BitLocker / FileVault)' },
  { key: 'find_device', group: 'Devices', text: 'Enable Find My / Find My Device' },
  { key: 'router', group: 'Network', text: 'Change router admin password and update firmware' },
  { key: 'wifi_wpa', group: 'Network', text: 'Use WPA3 or WPA2-AES with a strong Wi-Fi password' },
  { key: 'privacy_social', group: 'Privacy', text: 'Run a privacy checkup on each social account' },
  { key: 'location', group: 'Privacy', text: 'Review app location permissions' },
  { key: 'self_search', group: 'Privacy', text: 'Search my own name and remove what I can' },
  { key: 'backups', group: 'Recovery', text: 'Set up 3-2-1 backups and test a restore' },
  { key: 'report_plan', group: 'Recovery', text: 'Save my bank fraud line and national cybercrime hotline' }
];

export const CHECKLIST_KEYS = new Set(CHECKLIST.map((c) => c.key));

/**
 * Where the user is in the checklist journey.
 *   'baseline' — hasn't saved the "Before you start" audit yet
 *   'learning' — baseline saved, still working through the modules
 *   'final'    — finished all modules, re-evaluation not saved yet
 *   'done'     — re-evaluation saved (can still be updated)
 */
export function checklistPhase(status, courseComplete) {
  if (!status?.baseline_completed_at) return 'baseline';
  if (!courseComplete) return 'learning';
  if (!status.final_completed_at) return 'final';
  return 'done';
}

/** Counts checked items that are on the current checklist (ignores retired keys). */
export function score(checkedKeys) {
  let n = 0;
  for (const k of checkedKeys) if (CHECKLIST_KEYS.has(k)) n += 1;
  return n;
}

/** Compares baseline and final selections. */
export function compareStages(baselineKeys, finalKeys) {
  const before = new Set([...baselineKeys].filter((k) => CHECKLIST_KEYS.has(k)));
  const after = new Set([...finalKeys].filter((k) => CHECKLIST_KEYS.has(k)));
  return {
    before: before.size,
    after: after.size,
    total: CHECKLIST.length,
    added: CHECKLIST.filter((c) => after.has(c.key) && !before.has(c.key)),
    dropped: CHECKLIST.filter((c) => before.has(c.key) && !after.has(c.key)),
    remaining: CHECKLIST.filter((c) => !after.has(c.key))
  };
}

/** True once every module has lessons and every lesson is completed. */
export function isCourseComplete(modules, progress) {
  if (!modules.length) return false;
  return modules.every((m) => m.lessons.length && m.lessons.every((l) => progress.get(l.id)?.completed));
}
