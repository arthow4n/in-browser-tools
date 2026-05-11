import { LLMCore } from './llm-core.js';

export function setupLLMSettings(container: HTMLElement, core: LLMCore) {
  // Since we moved OpenRouter settings to the central page, we just show a link and the current model here.
  container.innerHTML = `
    <div style="padding: 15px; background: #eef5fb; border: 1px solid #b3d4fc; border-radius: 4px; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0; font-size: 14px;">
        <strong>Current Model:</strong> <span id="shared-model-display"></span>
      </p>
      <p style="margin: 0; font-size: 14px;">
        <a href="./settings.html" style="color: #0066cc; text-decoration: none;">⚙️ Configure OpenRouter API Key and Models in Settings</a>
      </p>
    </div>
  `;

  const modelDisplay = container.querySelector('#shared-model-display');
  if (modelDisplay) {
    modelDisplay.textContent = core.model || 'Not configured';
  }
}
