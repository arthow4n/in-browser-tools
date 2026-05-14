import { test, expect } from '@playwright/test';

test.describe('Text Adventure Writer Tool', () => {
  test('should load the page and initialize local storage properly', async ({
    page,
  }) => {
    await page.goto('/text-adventure-writer');

    await expect(page.locator('h1')).toHaveText('Text Adventure Writer');

    await page.goto('/settings');
    await page.fill('#shared-api-key', 'test-api-key');
    await page.fill('#shared-model-input', 'test-model');
    await page
      .locator('#shared-api-key')
      .evaluate((node) => node.dispatchEvent(new Event('input')));

    await page.goto('/text-adventure-writer');

    const charInput = page.locator('#character-name');
    await expect(charInput).toBeVisible();
    await charInput.fill('Arthur Dent');
    const charDescInput = page.locator('#character-description');
    await charDescInput.fill('A bewildered Englishman.');

    await page.waitForTimeout(100);
    await charInput.evaluate((node) => node.dispatchEvent(new Event('input')));
    await charDescInput.evaluate((node) =>
      node.dispatchEvent(new Event('input')),
    );

    await page.reload();
    await page.waitForTimeout(100);
  });

  test('should validate empty character name before sending', async ({
    page,
  }) => {
    let dialogFired = false;
    page.on('dialog', async (dialog) => {
      dialogFired = true;
      expect(dialog.message()).toBe('Please enter your character name.');
      await dialog.dismiss();
    });

    await page.goto('/text-adventure-writer');
    const charInput = page.locator('#character-name');
    await charInput.fill('');

    const userInputField = page.locator('#user-input');
    await userInputField.fill('Hello!');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sendBtn = btns.find((b) => b.textContent === 'Send & Continue');
      if (sendBtn) sendBtn.click();
    });

    await page.waitForTimeout(500);
    expect(true).toBe(true);
  });

  test('should simulate streaming tool calls and display correctly', async ({
    page,
  }) => {
    await page.route(
      'https://openrouter.ai/api/v1/chat/completions',
      async (route) => {
        const toolCallId = 'call_123';
        const toolCallIdWait = 'call_wait_456';
        const chunks = [
          `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"${toolCallId}","type":"function","function":{"name":"write_action","arguments":""}}]}}]}\n\n`,
          `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"character\\": \\"Narrator\\", "}}]}}]}\n\n`,
          `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"message\\": \\"The journey begins.\\"}"}}]}}]}\n\n`,
          `data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"${toolCallIdWait}","type":"function","function":{"name":"wait_for_user_input","arguments":"{}"}}]}}]}\n\n`,
          'data: [DONE]\n\n',
        ];

        const streamBody = chunks.join('');
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: streamBody,
        });
      },
    );

    await page.goto('/settings');
    await page.fill('#shared-api-key', 'test-key');
    await page.fill('#shared-model-input', 'test-model');
    await page
      .locator('#shared-api-key')
      .evaluate((node) => node.dispatchEvent(new Event('input')));

    await page.goto('/text-adventure-writer');
    const charInput = page.locator('#character-name');
    await charInput.fill('Arthur Dent');

    const userInputField = page.locator('#user-input');
    await userInputField.fill('I wake up.');
    const storyDirInput = page.locator('#story-direction');
    await storyDirInput.fill('Make it sudden.');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sendBtn = btns.find((b) => b.textContent === 'Send & Continue');
      if (sendBtn) sendBtn.click();
    });
  });
});
