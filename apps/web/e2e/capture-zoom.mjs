// Dev-time capture: fly low over Jakarta and screenshot streamed imagery.
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(process.env.CAPTURE_URL ?? 'http://localhost:3000/?dev');
await page.waitForSelector('canvas', { timeout: 60_000 });
await page.waitForTimeout(6_000);

const target = {
  lat: Number(process.env.LAT ?? -6.2),
  lon: 106.8,
  altKm: Number(process.env.ALT ?? 350),
};
await page.evaluate((t) => {
  window.__earthos.events.emit('core:camera:flyTo', { ...t, durationMs: 1200 });
}, target);
await page.waitForTimeout(Number(process.env.WAIT ?? 15_000)); // tiles stream
await page.screenshot({ path: process.env.CAPTURE_OUT ?? 'zoom.png' });
await browser.close();
console.log('saved');
