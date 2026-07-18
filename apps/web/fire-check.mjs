import { chromium } from '@playwright/test';
const OUT = process.env.OUT_DIR;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`${process.env.BASE}/?dev#lat=40&lon=-110&alt=6000&layers=imagery%2Cwildfires`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const s = window.__earthos?.getContext('wildfires')?.providers.handle('eonet-wildfires')?.get();
  return Array.isArray(s?.data?.fires);
}, undefined, { timeout: 60000, polling: 1000 }).catch(() => {});
const n = await page.evaluate(() => window.__earthos?.getContext('wildfires')?.providers.handle('eonet-wildfires')?.get()?.data?.fires?.length);
console.log('WILDFIRES LOADED:', n);
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT}/fires.png` });
await browser.close();
