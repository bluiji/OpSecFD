// Copies the pinned supabase-js browser build into public/vendor/ so the app
// serves it from its own origin instead of a third-party CDN.
// Usage: npm install && npm run vendor   (re-run after changing the pinned version)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const pinned = pkg.dependencies['@supabase/supabase-js'];
const installed = JSON.parse(readFileSync(join(root, 'node_modules/@supabase/supabase-js/package.json'), 'utf8')).version;

if (!/^\d+\.\d+\.\d+$/.test(pinned)) {
  console.error(`package.json must pin an exact @supabase/supabase-js version (found "${pinned}")`);
  process.exit(1);
}
if (installed !== pinned) {
  console.error(`Installed supabase-js ${installed} does not match pinned ${pinned}. Run npm install first.`);
  process.exit(1);
}

const src = readFileSync(join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'));
const sha384 = createHash('sha384').update(src).digest('base64');
const header = `/*! @supabase/supabase-js ${installed} (MIT) — vendored by scripts/vendor.mjs; sets window.supabase. sha384-${sha384} of the original file */\n`;

mkdirSync(join(root, 'public/vendor'), { recursive: true });
writeFileSync(join(root, 'public/vendor/supabase-js.js'), header + src);
console.log(`public/vendor/supabase-js.js written (supabase-js ${installed}, ${src.length} bytes)`);
