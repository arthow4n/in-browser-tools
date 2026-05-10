import { PDFDocument } from 'pdf-lib';
import { runWithUIState } from '../shared/ui-utils.js';

const fileInput = document.getElementById('pdf-files');
const fileList = document.getElementById('file-list');
const mergeBtn = document.getElementById('merge-btn');
const statusDiv = document.getElementById('status');
const outputDiv = document.getElementById('output');

if (!(fileInput instanceof HTMLInputElement))
  throw new Error('File input not found');
if (!(fileList instanceof HTMLUListElement))
  throw new Error('File list not found');
if (!(mergeBtn instanceof HTMLButtonElement))
  throw new Error('Merge button not found');
if (!(statusDiv instanceof HTMLDivElement))
  throw new Error('Status div not found');
if (!(outputDiv instanceof HTMLDivElement))
  throw new Error('Output div not found');

// Keep track of selected files
let selectedFiles: File[] = [];

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files || []);
  selectedFiles = selectedFiles.concat(files);
  renderFileList();
  // Clear input so same file can be selected again if needed
  fileInput.value = '';
});

function renderFileList() {
  fileList.innerHTML = '';
  selectedFiles.forEach((file, index) => {
    const li = document.createElement('li');
    li.textContent = file.name;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.style.marginLeft = '10px';
    removeBtn.addEventListener('click', () => {
      selectedFiles.splice(index, 1);
      renderFileList();
    });
    li.appendChild(removeBtn);
    fileList.appendChild(li);
  });
}

mergeBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0) {
    statusDiv.textContent = 'Please select at least one PDF file.';
    return;
  }

  outputDiv.innerHTML = '';

  await runWithUIState(
    mergeBtn,
    statusDiv,
    'Merging PDFs...',
    async () => {
      const mergedPdf = await PDFDocument.create();

      for (const file of selectedFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(
          pdfDoc,
          pdfDoc.getPageIndices(),
        );
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.pdf';
      a.textContent = 'Download Merged PDF';

      outputDiv.appendChild(a);
    },
    'Done merging!',
  );
});
