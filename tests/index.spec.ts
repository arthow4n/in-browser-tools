import { test, expect } from '@playwright/test';

test('homepage has title and tools list', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('In-Browser Tools');
  await expect(page.locator('#tools-list')).toBeAttached();
});
