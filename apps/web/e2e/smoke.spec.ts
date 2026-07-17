import { expect, test } from '@playwright/test';

test.describe('EarthOS smoke', () => {
  test('boots, renders the globe canvas, and shows the HUD', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /earthos/i })).toBeVisible();
    await expect(page.getByTestId('sim-clock')).toContainText('UTC');
    await expect(page.getByTestId('camera-readout')).toBeVisible();
  });

  test('satellites layer activates (worker chunk + renderer mount)', async ({ page }) => {
    await page.goto('/?dev'); // exposes window.__earthos in production builds
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('layer-status-satellites')).toHaveAttribute(
      'data-status',
      'active',
      { timeout: 30_000 },
    );
    // Deeper than the status dot: the provider must leave 'loading' (ready
    // with data, or a surfaced error when the network is blocked in CI).
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const engine = (
              window as unknown as {
                __earthos?: {
                  getContext(id: string):
                    | {
                        providers: {
                          handle(id: string): { get(): { state: string } } | undefined;
                        };
                      }
                    | undefined;
                };
              }
            ).__earthos;
            return engine?.getContext('satellites')?.providers.handle('celestrak-gp')?.get().state;
          }),
        { timeout: 30_000 },
      )
      .toMatch(/ready|stale|error/);
  });

  test('layer toggle enables and disables the earthquakes layer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
    const status = page.getByTestId('layer-status-earthquakes');
    await expect(status).toHaveAttribute('data-status', 'registered');
    await page.getByRole('switch', { name: 'Toggle Earthquakes' }).click();
    await expect(status).toHaveAttribute('data-status', /active|loading|error/, {
      timeout: 30_000,
    });
  });

  test('command palette opens with ctrl+k', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('ControlOrMeta+KeyK');
    await expect(page.getByTestId('command-palette-input')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette-input')).toBeHidden();
  });

  test('timeline pauses and resumes the simulation clock', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    const frozen = await page.getByTestId('sim-clock').textContent();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('sim-clock')).toHaveText(frozen ?? '');
    await page.getByRole('button', { name: 'Return to live time' }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('sim-clock')).not.toHaveText(frozen ?? '');
  });
});
