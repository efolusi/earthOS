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
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
    // Enabled by default: the status dot must reach active (or error if the
    // network is blocked, but the layer itself must come up).
    await expect(page.getByTestId('layer-status-satellites')).toHaveAttribute(
      'data-status',
      /active|loading/,
      { timeout: 30_000 },
    );
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
