const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/text-adventure-writer');
  await page.waitForLoadState('networkidle');

  await page.screenshot({ path: '/app/screenshot.png', fullPage: true });

  await browser.close();
})();