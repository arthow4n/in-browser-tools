const inputText = document.getElementById('input-text');
const outputText = document.getElementById('output-text');

if (!(inputText instanceof HTMLTextAreaElement)) {
  throw new Error('Input text area not found');
}
if (!(outputText instanceof HTMLDivElement)) {
  throw new Error('Output text div not found');
}

function createCharBox(char: string): HTMLDivElement {
  const box = document.createElement('div');
  box.className = 'char-box';

  const valSpan = document.createElement('span');
  valSpan.className = 'char-val';

  const codeSpan = document.createElement('span');
  codeSpan.className = 'char-code';

  const codePoint = char.codePointAt(0);
  const hexCode = codePoint
    ? `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`
    : '';
  codeSpan.textContent = hexCode;

  if (char === ' ') {
    valSpan.textContent = '·';
    box.classList.add('whitespace');
  } else if (char === '\n') {
    valSpan.textContent = '↵';
    box.classList.add('whitespace');
  } else if (char === '\t') {
    valSpan.textContent = '⇥';
    box.classList.add('whitespace');
  } else if (char === '\r') {
    valSpan.textContent = '␍';
    box.classList.add('whitespace');
  } else {
    valSpan.textContent = char;
  }

  box.appendChild(valSpan);
  box.appendChild(codeSpan);

  return box;
}

inputText.addEventListener('input', () => {
  outputText.innerHTML = '';
  const text = inputText.value;

  // Use Array.from to correctly iterate over surrogate pairs
  const chars = Array.from(text);
  for (const char of chars) {
    outputText.appendChild(createCharBox(char));
  }
});

// Initialize with any existing text
if (inputText.value) {
  inputText.dispatchEvent(new Event('input'));
}
