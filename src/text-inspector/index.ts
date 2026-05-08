const inputText = document.getElementById('input-text');
const outputText = document.getElementById('output-text');

if (!(inputText instanceof HTMLTextAreaElement)) {
  throw new Error('Input text area not found');
}
if (!(outputText instanceof HTMLDivElement)) {
  throw new Error('Output text div not found');
}

inputText.addEventListener('input', () => {
  outputText.textContent = inputText.value;
});
