#!/usr/bin/env node
/**
 * Fetch the optional 8k texture set (Solar System Scope, CC BY 4.0,
 * NASA-derived) into apps/web/public/textures/full/. That directory is
 * gitignored: the repo ships 2k textures, deployments run this script for a
 * 16x sharper globe. The app auto-detects the files at runtime.
 */
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { get } from 'node:https';
import { dirname, join } from 'node:path';

const BASE = 'https://www.solarsystemscope.com/textures/download';
const FILES = {
  '8k_earth_daymap.jpg': 'day',
  '8k_earth_nightmap.jpg': 'night lights',
  '8k_earth_clouds.jpg': 'clouds',
};

const outDir = join(dirname(new URL(import.meta.url).pathname), '../apps/web/public/textures/full');
mkdirSync(outDir, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u, redirects = 0) => {
      get(u, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          redirects < 5
        ) {
          follow(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        const file = createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

for (const [name, label] of Object.entries(FILES)) {
  const dest = join(outDir, name);
  if (existsSync(dest)) {
    console.log(`skip ${name} (exists)`);
    continue;
  }
  process.stdout.write(`fetching ${label} (${name})... `);
  try {
    await download(`${BASE}/${name}`, dest);
    console.log('ok');
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
  }
}
console.log('Done. Textures credit: Solar System Scope (CC BY 4.0), NASA imagery.');
