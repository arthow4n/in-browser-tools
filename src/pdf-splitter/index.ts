import { PDFDocument } from 'pdf-lib';
import { getRequiredElement } from '../shared/dom-utils.js';
import { runWithUIState } from '../shared/ui-utils.js';

const fileInput = getRequiredElement<HTMLInputElement>(
  'pdf-file',
  HTMLInputElement,
);
const pagesInput = getRequiredElement<HTMLInputElement>(
  'pages',
  HTMLInputElement,
);
const splitBtn = getRequiredElement<HTMLButtonElement>(
  'split-btn',
  HTMLButtonElement,
);
const statusDiv = getRequiredElement<HTMLDivElement>('status', HTMLDivElement);
const outputList = getRequiredElement<HTMLUListElement>(
  'output-list',
  HTMLUListElement,
);

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) {
    statusDiv.textContent = `Input file selected: ${file.name} (${formatBytes(file.size)})`;
  } else {
    statusDiv.textContent = '';
  }
});

splitBtn.addEventListener('click', async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    statusDiv.textContent = 'Please select a PDF file first.';
    return;
  }

  const pagesPerSplit = parseInt(pagesInput.value, 10);
  if (isNaN(pagesPerSplit) || pagesPerSplit <= 0) {
    statusDiv.textContent = 'Please enter a valid number of pages.';
    return;
  }

  outputList.innerHTML = '';

  let successMessage = '';
  await runWithUIState(
    splitBtn,
    statusDiv,
    `Processing ${file.name} (${formatBytes(file.size)})...`,
    async () => {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const totalPages = pdfDoc.getPageCount();

      if (totalPages === 0) {
        throw new Error('The selected PDF has no pages.');
      }

      const numChunks = Math.ceil(totalPages / pagesPerSplit);
      statusDiv.textContent = `Splitting into ${numChunks} file(s)...`;

      for (let i = 0; i < numChunks; i++) {
        const newPdf = await PDFDocument.create();
        const startPage = i * pagesPerSplit;
        const endPage = Math.min(startPage + pagesPerSplit, totalPages);

        const pageIndices = [];
        for (let j = startPage; j < endPage; j++) {
          pageIndices.push(j);
        }

        const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const fileSizeFormatted = formatBytes(blob.size);

        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = url;

        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const downloadName = `${baseName}_part${i + 1}.pdf`;

        a.download = downloadName;
        a.textContent = `Download ${downloadName} (${fileSizeFormatted})`;
        li.appendChild(a);
        outputList.appendChild(li);
      }

      successMessage = `Done splitting ${file.name} (${formatBytes(file.size)})! Generated ${numChunks} files.`;
    },
    undefined,
  );

  if (successMessage && !statusDiv.textContent?.startsWith('Error')) {
    statusDiv.textContent = successMessage;
    statusDiv.style.color = 'green';
  }
});
