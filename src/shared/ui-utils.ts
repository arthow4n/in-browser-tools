export async function runWithUIState(
  button: HTMLButtonElement | null,
  statusElement: HTMLElement | null,
  loadingText: string,
  action: () => Promise<void>,
  successText?: string,
): Promise<void> {
  const originalButtonText = button?.textContent || '';
  const originalButtonDisabled = button?.disabled ?? false;

  if (button) {
    button.disabled = true;
    button.textContent = loadingText;
  }
  if (statusElement) {
    statusElement.textContent = loadingText;
    statusElement.style.color = '#0066cc'; // Using a default neutral/loading color, e.g. blueish
  }

  try {
    await action();
    if (statusElement && successText) {
      statusElement.textContent = successText;
      statusElement.style.color = 'green';
    } else if (statusElement) {
      statusElement.textContent = '';
    }
  } catch (error: any) {
    if (statusElement) {
      statusElement.textContent = `Error: ${error.message || String(error)}`;
      statusElement.style.color = 'red';
    }
  } finally {
    if (button) {
      button.disabled = originalButtonDisabled;
      button.textContent = originalButtonText;
    }
  }
}
