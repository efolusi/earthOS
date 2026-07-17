// One-off visual capture used during development: real Chromium, real rAF.
import { chromium } from '@playwright/test';

const url = process.env.CAPTURE_URL ?? 'http://localhost:3100';
const out = process.env.CAPTURE_OUT ?? 'capture.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(url);
await page.waitForSelector('canvas', { timeout: 30_000 });
await page.waitForTimeout(Number(process.env.CAPTURE_WAIT_MS ?? 12_000));
const fps = await page
  .getByTestId('fps')
  .textContent()
  .catch(() => 'n/a');
console.log('fps readout:', fps);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
