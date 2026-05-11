const { chromium } = require('playwright');
const http = require('http');
const handler = require('serve-handler');

const server = http.createServer((request, response) => {
  return handler(request, response, { public: 'dist' });
});

server.listen(8080, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:8080/repo-chat.html');

  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'verify-repo-chat.png' });

  await browser.close();
  server.close();
});
