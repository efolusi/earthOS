#!/usr/bin/env node
/**
 * Single-instance rule enforcement.
 *
 * `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei` and
 * `maplibre-gl` must appear only as peerDependencies (or devDependencies for
 * local testing) in every publishable package. If any of them lands in
 * `dependencies`, consumers can end up with duplicate Three/React instances,
 * which silently breaks R3F context identity and `instanceof` checks.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SINGLETONS = [
  'react',
  'react-dom',
  'three',
  '@react-three/fiber',
  '@react-three/drei',
  'maplibre-gl',
];

const GROUPS = ['packages', 'plugins', 'sdk'];
const root = new URL('..', import.meta.url).pathname;

const violations = [];
for (const group of GROUPS) {
  const groupDir = join(root, group);
  if (!existsSync(groupDir)) continue;
  for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(groupDir, entry.name, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      if (SINGLETONS.includes(dep)) {
        violations.push(`${group}/${entry.name}: "${dep}" must be a peerDependency, not a dependency`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Single-instance rule violations:\n' + violations.map((v) => `  - ${v}`).join('\n'));
  process.exit(1);
}
console.log('check-peers: OK');
