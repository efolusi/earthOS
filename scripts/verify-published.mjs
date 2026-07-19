#!/usr/bin/env node
/**
 * Post-publish gate: assert every publishable package is actually resolvable on
 * the public npm registry at the version in this repo.
 *
 * `changeset publish` can report success (and even push git tags) while the
 * registry ends up without the package, for example when a scope does not exist
 * or a package lands restricted. That silent partial release is worse than a
 * loud failure: the meta package ships with dependencies nobody can install.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const root = join(dirname(new URL(import.meta.url).pathname), '..');
const REGISTRY = process.env.NPM_REGISTRY ?? 'https://registry.npmjs.org';

function publishable() {
  const out = [];
  for (const group of ['packages', 'plugins', 'sdk']) {
    const dir = join(root, group);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const manifest = join(dir, name, 'package.json');
      if (!existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      if (pkg.private) continue;
      out.push({ name: pkg.name, version: pkg.version });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function isPublished({ name, version }) {
  const url = `${REGISTRY}/${name.replace('/', '%2F')}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) return { ok: false, reason: `registry returned ${res.status}` };
  const doc = await res.json();
  if (!doc.versions?.[version]) {
    return {
      ok: false,
      reason: `version ${version} absent (latest: ${doc['dist-tags']?.latest ?? 'none'})`,
    };
  }
  return { ok: true };
}

const pkgs = publishable();
console.log(`Verifying ${pkgs.length} publishable packages against ${REGISTRY}\n`);

const missing = [];
for (const pkg of pkgs) {
  const { ok, reason } = await isPublished(pkg);
  console.log(
    `  ${ok ? 'ok     ' : 'MISSING'} ${pkg.name}@${pkg.version}${ok ? '' : `  (${reason})`}`,
  );
  if (!ok) missing.push({ ...pkg, reason });
}

if (missing.length) {
  console.error(`\n${missing.length} of ${pkgs.length} packages are NOT on the public registry:`);
  for (const m of missing) console.error(`  - ${m.name}@${m.version}: ${m.reason}`);
  console.error(
    '\nA partial release leaves the meta package depending on things nobody can install.',
  );
  console.error(
    'Common causes: the @earthos org does not exist, or the packages published restricted.',
  );
  process.exit(1);
}

console.log(`\nAll ${pkgs.length} packages are live on the public registry.`);
