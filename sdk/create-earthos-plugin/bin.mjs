#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { templates } from './templates.mjs';

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('Usage: create-earthos-plugin <kebab-case-name>');
  process.exit(1);
}
const dir = join(process.cwd(), `earthos-plugin-${name}`);
if (existsSync(dir)) {
  console.error(`${dir} already exists`);
  process.exit(1);
}

const pascal = name
  .split('-')
  .map((p) => p[0].toUpperCase() + p.slice(1))
  .join('');

const files = templates(name, pascal);
for (const [path, content] of Object.entries(files)) {
  const full = join(dir, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

console.log(`Scaffolded ${dir}`);
console.log('Next steps:');
console.log(`  cd earthos-plugin-${name}`);
console.log('  pnpm install');
console.log('  pnpm test     # contract suite runs offline');
console.log('  pnpm build');
