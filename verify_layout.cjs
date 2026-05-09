const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/text-adventure-writer');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'layout.png', fullPage: true });
  await browser.close();
})();
