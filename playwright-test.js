import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: { dir: 'videos/' }
  });
  const page = await context.newPage();

  // Navigate to the app
  await page.goto('http://localhost:3000/agent-workflow-designer');

  // mock route since we don't have api key
  await page.route('https://openrouter.ai/api/v1/chat/completions', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: {"choices":[{"delta":{"content":"Test response"}}]}\n\ndata: [DONE]\n\n'
    });
  });

  // Enter settings
  await page.fill('#shared-api-key', 'test-api-key');
  await page.fill('#shared-model-input', 'test-model');

  // Fill text and click send
  await page.fill('#user-input', 'test message 1');

  await page.click('#send-btn');

  await page.waitForTimeout(2000); // wait for streaming to finish
  await page.screenshot({ path: 'screenshot_before_undo.png' });

  // click undo
  await page.click('#undo-btn');

  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'screenshot_after_undo.png' });

  await context.close();
  await browser.close();
})();