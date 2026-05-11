const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/text-adventure-writer');
  await page.waitForSelector('#regenerate-last-btn');
  console.log('Button found!');
  await browser.close();
})();
